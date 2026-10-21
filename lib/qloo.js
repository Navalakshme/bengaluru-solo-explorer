const QLOO_BASE_URL = 'https://hackathon.api.qloo.com';

export const DISCOVERY_CATEGORIES = [
  { id: 'coffee', name: 'Coffee & cafés', icon: '☕', terms: ['coffee', 'cafe'], mood: 'unhurried and cozy', ambience: 'An easy stop for a slow catch-up or a little solo pause.', company: 'Suggested 1–3 people; confirm seating at the venue.', budget: 'Rough guide ₹150–₹600 per person; check the current menu.' },
  { id: 'south-indian', name: 'South Indian favourites', icon: '⌁', terms: ['South Indian cuisine', 'dosa'], mood: 'comforting and familiar', ambience: 'A food-led stop shaped around local flavours.', company: 'Suggested 1–4 people; confirm seating at the venue.', budget: 'Rough guide ₹100–₹400 per person; check the current menu.' },
  { id: 'global-food', name: 'Global food & dining', icon: '✳', terms: ['restaurants', 'international cuisine'], mood: 'curious and flavour-first', ambience: 'A meal stop for exploring different cuisines.', company: 'Suggested 2–6 people; confirm table size and booking.', budget: 'Rough guide ₹300–₹1,200 per person; check the current menu.' },
  { id: 'bakeries', name: 'Bakeries & sweet treats', icon: '✧', terms: ['bakery', 'dessert'], mood: 'light and indulgent', ambience: 'A casual treat stop for a break in the day.', company: 'Suggested 1–4 people; confirm seating at the venue.', budget: 'Rough guide ₹100–₹500 per person; check the current menu.' },
  { id: 'gardens', name: 'Gardens & green escapes', icon: '❋', terms: ['garden', 'park', 'botanical garden'], mood: 'slow, leafy, and restorative', ambience: 'Green space for an easy walk and an open-air pause.', company: 'Suggested 1–8+ people; check park rules and group access.', budget: 'Rough guide ₹0–₹200 per person; confirm entry fees.' },
  { id: 'art', name: 'Art, museums & culture', icon: '▧', terms: ['art museum', 'art gallery', 'culture'], mood: 'curious and creative', ambience: 'A thoughtful indoor cultural stop; exhibits vary by venue.', company: 'Suggested 1–4 people; confirm group booking rules.', budget: 'Rough guide ₹0–₹500 per person; check current ticket prices.' },
  { id: 'heritage', name: 'Architecture & heritage', icon: '⌂', terms: ['architecture', 'historic landmark', 'heritage'], mood: 'curious and history-minded', ambience: 'A city-story stop for noticing Bengaluru’s built character.', company: 'Suggested 1–8 people; check access and group rules.', budget: 'Rough guide ₹0–₹500 per person; check access and entry rules.' },
  { id: 'music', name: 'Live music & nightlife', icon: '♫', terms: ['live music', 'music venue', 'nightlife'], mood: 'lively and social', ambience: 'An evening-shaped pick; performance schedules can change.', company: 'Suggested 2–6 people; confirm capacity and reservations.', budget: 'Rough guide ₹500–₹2,000+ per person; confirm cover charges.' },
  { id: 'books', name: 'Bookshops & reading nooks', icon: '▤', terms: ['bookstore', 'books'], mood: 'quiet and curious', ambience: 'A browse-and-linger kind of stop.', company: 'Suggested 1–3 people; check seating and shop policy.', budget: 'Rough guide ₹0–₹1,000+ per person; depends on purchases.' },
  { id: 'outdoors', name: 'Adventure & outdoors', icon: '↗', terms: ['outdoor recreation', 'adventure', 'sports'], mood: 'active and energising', ambience: 'An activity-led pick; check conditions and booking details.', company: 'Suggested 2–8 people; verify activity capacity.', budget: 'Rough guide ₹300–₹2,000+ per person; confirm gear and booking costs.' },
  { id: 'wellness', name: 'Wellness & slow living', icon: '☼', terms: ['wellness', 'yoga', 'spa'], mood: 'calm and restorative', ambience: 'A slower reset; services and atmosphere vary by venue.', company: 'Suggested 1–4 people; confirm session capacity.', budget: 'Rough guide ₹500–₹3,000+ per person; confirm with the provider.' },
  { id: 'shopping', name: 'Design, shopping & local finds', icon: '◇', terms: ['design', 'shopping', 'local market'], mood: 'playful and exploratory', ambience: 'A browse-friendly stop for design and local finds.', company: 'Suggested 1–4 people; confirm shop group policy.', budget: 'No set spend; depends on what you choose to buy.' }
];

const discoveryCategoryById = new Map(DISCOVERY_CATEGORIES.map(category => [category.id, category]));

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

function entityResults(payload) {
  const entities = payload?.results?.entities || payload?.entities || payload?.results || [];
  return Array.isArray(entities) ? entities : [];
}

function dedupePlaces(groups) {
  const seen = new Set();
  return groups.flat().filter(place => {
    if (!place?.name) return false;
    const key = String(place.entity_id || place.id || `${place.name}|${place.properties?.address || place.properties?.geocode?.neighborhood || ''}`).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function qlooDiscoverPlaces({ categoryId = 'all', search = '', startArea = 'Bengaluru', favorites = [] } = {}) {
  const category = discoveryCategoryById.get(categoryId);
  if (categoryId !== 'all' && !category) throw new Error('Choose one of the available discovery categories.');
  const searchText = String(search).trim().slice(0, 120);
  const baseTerms = category?.terms || [];
  const searchTerms = searchText ? [searchText] : [];
  const signalTerms = [...new Set([...baseTerms, ...searchTerms])].slice(0, 5);
  const [tasteTags, interests] = await Promise.all([
    resolveTasteTags(signalTerms),
    resolveTasteSeeds(favorites)
  ]);
  const baseParams = {
    'filter.type': 'urn:entity:place',
    'filter.location.query': startArea || 'Bengaluru',
    'signal.location.query': startArea || 'Bengaluru',
    take: 30,
    'feature.explainability': true,
    ...(tasteTags.length ? { 'signal.interests.tags': tasteTags.join(',') } : {}),
    ...(interests.length ? { 'signal.interests.entities': interests.join(',') } : {})
  };

  const recommendationRequests = [qlooGet('/v2/insights', baseParams)];
  // If a broad multi-signal query is sparse, expand with its individual taste cues.
  if (tasteTags.length > 1) {
    for (const tag of tasteTags.slice(0, 3)) {
      recommendationRequests.push(qlooGet('/v2/insights', { ...baseParams, 'signal.interests.tags': tag }));
    }
  }
  if (searchText) {
    recommendationRequests.push(qlooGet('/search', { query: searchText, types: 'urn:entity:place', take: 20, sort_by: 'match' }).catch(() => null));
  }
  const settled = await Promise.allSettled(recommendationRequests);
  const groups = settled.filter(result => result.status === 'fulfilled' && result.value).map(result => entityResults(result.value));
  if (!groups.some(group => group.length)) throw settled.find(result => result.status === 'rejected')?.reason || new Error('Qloo returned no place matches.');
  const places = dedupePlaces(groups).slice(0, 30);
  return {
    category: category || { id: 'all', name: 'All tastes', icon: '✳', mood: 'your own kind of curious', ambience: 'A mix of Bengaluru places, matched to the search.', company: 'Choose the places that fit your group', budget: 'Costs vary; check menus, tickets, and booking details.' },
    search: searchText,
    signals: signalTerms,
    count: places.length,
    places
  };
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
