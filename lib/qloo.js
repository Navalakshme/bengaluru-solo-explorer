const QLOO_BASE_URL = 'https://hackathon.api.qloo.com';

async function qlooGet(path, params) {
  const url = new URL(path, QLOO_BASE_URL);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  }
  const response = await fetch(url, {
    headers: { 'X-Api-Key': process.env.QLOO_API_KEY, Accept: 'application/json' },
    signal: AbortSignal.timeout(20_000)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || payload.error || `Qloo returned ${response.status}.`);
  return payload;
}

function searchResults(payload) {
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.results?.entities)) return payload.results.entities;
  if (Array.isArray(payload?.entities)) return payload.entities;
  return [];
}

async function resolveTasteSeeds(favorites) {
  const names = [...new Set((favorites || []).map(value => String(value).trim()).filter(Boolean))].slice(0, 5);
  if (!names.length) return [];
  const resolved = await Promise.all(names.map(async name => {
    try {
      const payload = await qlooGet('/search', { query: name, take: 1, sort_by: 'match' });
      const result = searchResults(payload)[0];
      return result?.entity_id || result?.id || result?.entity?.entity_id || result?.entity?.id || null;
    } catch {
      // Taste seeds are optional; a typo or non-indexed seed should not block the city plan.
      return null;
    }
  }));
  return resolved.filter(Boolean);
}

function moodTasteTerms(input) {
  const text = `${input.mood || ''} ${input.refinement || ''}`.toLowerCase();
  const terms = new Set();
  for (const term of input.interpretation?.tasteTerms || []) {
    if (typeof term === 'string' && term.trim()) terms.add(term.trim().toLowerCase());
  }
  const modeTerms = {
    food: ['restaurant', 'coffee'],
    sights: ['art', 'museum', 'garden'],
    adventure: ['outdoor recreation', 'nature']
  };
  for (const term of modeTerms[input.mode] || []) terms.add(term);
  const vocabulary = [
    [/\b(peaceful|calm|slow|relax|reset|quiet|green|leafy|nature|garden|park)\b/i, ['garden', 'nature', 'park']],
    [/\b(art|creative|gallery|museum|design|photography|architecture|culture)\b/i, ['art', 'museum', 'gallery']],
    [/\b(food|eat|dosa|meal|restaurant|cafe|coffee|bakery|brunch|breakfast|lunch|dinner)\b/i, ['restaurant', 'coffee']],
    [/\b(adventure|active|hike|hiking|climb|cycling|outdoors|trail|sport)\b/i, ['outdoor recreation', 'nature']],
    [/\b(music|gig|concert|live music|jazz|indie)\b/i, ['music', 'live music']],
    [/\b(book|reading|bookstore|literary)\b/i, ['bookstore', 'books']]
  ];
  for (const [pattern, matches] of vocabulary) if (pattern.test(text)) matches.forEach(term => terms.add(term));
  return [...terms].slice(0, 4);
}

async function resolveTasteTags(terms) {
  const tags = await Promise.all(terms.map(async term => {
    try {
      const payload = await qlooGet('/v2/tags', { 'filter.query': term, take: 5 });
      const results = payload?.results?.tags || payload?.results || payload?.tags || [];
      const list = Array.isArray(results) ? results : [];
      const normalizedTerm = term.toLowerCase();
      const best = list.find(tag => String(tag.name || '').toLowerCase() === normalizedTerm)
        || list.find(tag => String(tag.name || '').toLowerCase().includes(normalizedTerm))
        || list[0];
      return best?.tag_id || best?.tag_value || best?.id || null;
    } catch {
      // Mood-related tags are an extra signal; recommendations can still use location and favorite entities.
      return null;
    }
  }));
  return [...new Set(tags.filter(Boolean))].slice(0, 8);
}

export async function qlooPlaces(input) {
  const currentPoint = input.startArea === 'My current location' && input.coordinates
    ? `POINT(${input.coordinates.longitude} ${input.coordinates.latitude})`
    : null;
  const params = {
    'filter.type': 'urn:entity:place',
    ...(currentPoint
      ? { 'filter.location': currentPoint, 'signal.location': currentPoint }
      : { 'filter.location.query': input.startArea || 'Bengaluru', 'signal.location.query': input.startArea || 'Bengaluru' }),
    take: 30,
    'feature.explainability': true
  };
  const requestText = `${input.mood || ''} ${input.refinement || ''}`.toLowerCase();
  if (/hidden|lesser[- ]known|local gem|offbeat|under.?the.?radar/.test(requestText)) params['filter.popularity.max'] = 0.85;
  const moodSignals = moodTasteTerms(input);
  input.qlooTasteSignals = moodSignals;
  const [interests, tasteTags] = await Promise.all([
    resolveTasteSeeds(input.favorites),
    resolveTasteTags(moodSignals)
  ]);
  if (interests.length) params['signal.interests.entities'] = interests.join(',');
  if (tasteTags.length) params['signal.interests.tags'] = tasteTags.join(',');
  return qlooGet('/v2/insights', params);
}
