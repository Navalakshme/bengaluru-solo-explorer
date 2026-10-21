const QLOO_BASE_URL = 'https://hackathon.api.qloo.com';

export const DISCOVERY_CATEGORIES = [
  { id: 'coffee', name: 'Coffee & cafés', icon: '☕', terms: ['coffee', 'cafe'], intent: 'Cafés, coffee houses, roasters, tea rooms, and places where someone can sit for a drink. Exclude restaurants without a café focus, malls, parks, and landmarks.', mood: 'unhurried and cozy', ambience: 'An easy stop for a slow catch-up or a little solo pause.', company: 'Suggested 1–3 people; confirm seating at the venue.', budget: 'Rough guide ₹150–₹600 per person; check the current menu.' },
  { id: 'south-indian', name: 'South Indian favourites', icon: '⌁', terms: ['South Indian cuisine', 'dosa'], intent: 'Restaurants and tiffin spots serving South Indian food, dosa, idli, meals, or filter coffee. Exclude non-food venues.', mood: 'comforting and familiar', ambience: 'A food-led stop shaped around local flavours.', company: 'Suggested 1–4 people; confirm seating at the venue.', budget: 'Rough guide ₹100–₹400 per person; check the current menu.' },
  { id: 'global-food', name: 'Global food & dining', icon: '✳', terms: ['restaurants', 'international cuisine'], intent: 'Restaurants and dining venues with cuisines beyond traditional South Indian food. Exclude malls unless the candidate itself is a named restaurant, and exclude non-food venues.', mood: 'curious and flavour-first', ambience: 'A meal stop for exploring different cuisines.', company: 'Suggested 2–6 people; confirm table size and booking.', budget: 'Rough guide ₹300–₹1,200 per person; check the current menu.' },
  { id: 'bakeries', name: 'Bakeries & sweet treats', icon: '✧', terms: ['bakery', 'dessert'], intent: 'Bakeries, patisseries, dessert shops, ice-cream parlours, and sweet shops. Exclude general malls, parks, and landmarks.', mood: 'light and indulgent', ambience: 'A casual treat stop for a break in the day.', company: 'Suggested 1–4 people; confirm seating at the venue.', budget: 'Rough guide ₹100–₹500 per person; check the current menu.' },
  { id: 'gardens', name: 'Gardens & green escapes', icon: '❋', terms: ['botanical garden', 'public park', 'urban green space', 'nature reserve'], intent: 'Public gardens, botanical gardens, parks, lakeside green spaces, nature reserves, and forest trails. Include only places whose primary experience is outdoor nature or greenery. Strictly exclude malls, shopping centres, restaurants, museums, monuments, and civic buildings.', mood: 'slow, leafy, and restorative', ambience: 'Green space for an easy walk and an open-air pause.', company: 'Suggested 1–8+ people; check park rules and group access.', budget: 'Rough guide ₹0–₹200 per person; confirm entry fees.' },
  { id: 'art', name: 'Art, museums & culture', icon: '▧', terms: ['art museum', 'art gallery', 'culture'], intent: 'Art galleries, museums, photography spaces, theatres, and cultural institutions. Exclude general malls, parks, and unrelated landmarks.', mood: 'curious and creative', ambience: 'A thoughtful indoor cultural stop; exhibits vary by venue.', company: 'Suggested 1–4 people; confirm group booking rules.', budget: 'Rough guide ₹0–₹500 per person; check current ticket prices.' },
  { id: 'heritage', name: 'Architecture & heritage', icon: '⌂', terms: ['architecture', 'historic landmark', 'heritage'], intent: 'Historic buildings, heritage sites, palaces, monuments, and architecturally notable civic places. Exclude malls, restaurants, and parks.', mood: 'curious and history-minded', ambience: 'A city-story stop for noticing Bengaluru’s built character.', company: 'Suggested 1–8 people; check access and group rules.', budget: 'Rough guide ₹0–₹500 per person; check access and entry rules.' },
  { id: 'music', name: 'Live music & nightlife', icon: '♫', terms: ['live music', 'music venue', 'nightlife'], intent: 'Live music venues, concert halls, clubs, performance spaces, and nightlife venues. Exclude malls, parks, and daytime landmarks.', mood: 'lively and social', ambience: 'An evening-shaped pick; performance schedules can change.', company: 'Suggested 2–6 people; confirm capacity and reservations.', budget: 'Rough guide ₹500–₹2,000+ per person; confirm cover charges.' },
  { id: 'books', name: 'Bookshops & reading nooks', icon: '▤', terms: ['bookstore', 'books'], intent: 'Bookshops, libraries open to visitors, and book cafés or reading spaces. Exclude general retail malls and unrelated shops.', mood: 'quiet and curious', ambience: 'A browse-and-linger kind of stop.', company: 'Suggested 1–3 people; check seating and shop policy.', budget: 'Rough guide ₹0–₹1,000+ per person; depends on purchases.' },
  { id: 'outdoors', name: 'Adventure & activities', icon: '↗', terms: ['go karting', 'bowling alley', 'arcade', 'climbing gym', 'escape room', 'trampoline park', 'paintball', 'adventure sports'], intent: 'Bookable, active things to do: go-kart tracks, bowling alleys, arcades and gaming cafés, VR arenas, escape rooms, climbing gyms, trampoline parks, paintball, skating, adventure sports, and activity centres. Parks and trails are acceptable only when the candidate is an actual named outdoor activity venue or organized adventure provider. Strictly exclude landmarks, civic buildings, ordinary parks, malls as a whole, and restaurants.', mood: 'playful, active, and energising', ambience: 'A do-something-together pick; check session times and booking details.', company: 'Suggested 2–8 people; verify activity capacity and age rules.', budget: 'Rough guide ₹300–₹2,000+ per person; confirm activity and booking costs.' },
  { id: 'wellness', name: 'Wellness & slow living', icon: '☼', terms: ['wellness', 'yoga', 'spa'], intent: 'Yoga studios, spas, wellness centres, meditation spaces, and restorative services. Exclude malls, parks, and unrelated venues.', mood: 'calm and restorative', ambience: 'A slower reset; services and atmosphere vary by venue.', company: 'Suggested 1–4 people; confirm session capacity.', budget: 'Rough guide ₹500–₹3,000+ per person; confirm with the provider.' },
  { id: 'shopping', name: 'Design, shopping & local finds', icon: '◇', terms: ['design', 'shopping', 'local market'], intent: 'Independent design shops, craft stores, markets, and locally distinctive shopping. Prefer named shops or markets over general malls.', mood: 'playful and exploratory', ambience: 'A browse-friendly stop for design and local finds.', company: 'Suggested 1–4 people; confirm shop group policy.', budget: 'No set spend; depends on what you choose to buy.' }
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
    adventure: ['go karting', 'bowling', 'arcade', 'climbing gym']
  };
  for (const term of modeTerms[input.mode] || []) terms.add(term);
  const vocabulary = [
    [/\b(peaceful|calm|slow|relax|reset|quiet|green|leafy|nature|garden|park)\b/i, ['garden', 'nature', 'park']],
    [/\b(art|creative|gallery|museum|design|photography|architecture|culture)\b/i, ['art', 'museum', 'gallery']],
    [/\b(food|eat|dosa|meal|restaurant|cafe|coffee|bakery|brunch|breakfast|lunch|dinner)\b/i, ['restaurant', 'coffee']],
    [/\b(adventure|active|hike|hiking|climb|cycling|outdoors|trail|sport|kart|bowling|arcade|gaming|escape room|paintball|trampoline)\b/i, ['adventure activity', 'go karting', 'bowling', 'arcade']],
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
  const signalTerms = [...new Set([...searchTerms, ...baseTerms])].slice(0, 8);
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
