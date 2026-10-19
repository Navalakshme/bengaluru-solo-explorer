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
  const interests = await resolveTasteSeeds(input.favorites);
  if (interests.length) params['signal.interests.entities'] = interests.join(',');
  return qlooGet('/v2/insights', params);
}
