const QLOO_BASE_URL = 'https://hackathon.api.qloo.com';
import { catalogCandidates, enrichFromCatalog } from './catalog.js';

// Keep requests from one warm serverless instance from stampeding Qloo when a
// plan asks for several categories and taste signals at once.
let qlooRequestQueue = Promise.resolve();
let lastQlooRequestAt = 0;

function requestQloo(url, options) {
  const pending = qlooRequestQueue.then(async () => {
    const pause = Math.max(0, 500 - (Date.now() - lastQlooRequestAt));
    if (pause) await new Promise(resolve => setTimeout(resolve, pause));
    for (let attempt = 0; attempt < 2; attempt += 1) {
      lastQlooRequestAt = Date.now();
      const response = await fetch(url, options);
      const payload = await response.json().catch(() => ({}));
      if (response.status === 429 && attempt === 0) {
        const retryAfter = Number(response.headers.get('retry-after'));
        const delay = Number.isFinite(retryAfter) && retryAfter > 0
          ? Math.min(retryAfter * 1000, 4000)
          : 1200;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      if (!response.ok) {
        const error = new Error(payload.message || payload.error || `Qloo returned ${response.status}.`);
        error.status = response.status;
        throw error;
      }
      return payload;
    }
    throw new Error('Qloo rate limit exceeded. Please wait a moment and try again.');
  });
  qlooRequestQueue = pending.catch(() => {});
  return pending;
}

export const DISCOVERY_CATEGORIES = [
  { id: 'coffee', name: 'Coffee & cafés', icon: '☕', terms: ['coffee', 'cafe'], intent: 'Cafés, coffee houses, roasters, tea rooms, and places where someone can sit for a drink. Exclude restaurants without a café focus, malls, parks, and landmarks.', mood: 'unhurried and cozy', ambience: 'An easy stop for a slow catch-up or a little solo pause.', company: 'Suggested 1–3 people; confirm seating at the venue.', budget: 'Rough guide ₹150–₹600 per person; check the current menu.' },
  { id: 'south-indian', name: 'South Indian favourites', icon: '⌁', terms: ['South Indian cuisine', 'dosa'], intent: 'Restaurants and tiffin spots serving South Indian food, dosa, idli, meals, or filter coffee. Exclude non-food venues.', mood: 'comforting and familiar', ambience: 'A food-led stop shaped around local flavours.', company: 'Suggested 1–4 people; confirm seating at the venue.', budget: 'Rough guide ₹100–₹400 per person; check the current menu.' },
  { id: 'global-food', name: 'Beyond South Indian dining', icon: '✳', terms: ['restaurants', 'regional and international cuisine'], intent: 'Restaurants serving cuisines beyond South Indian food, including other Indian regional cuisines and international dining. Exclude cafés, bakeries, dessert shops, malls, and non-food venues.', mood: 'curious and flavour-first', ambience: 'A meal stop for exploring regional and international flavours.', company: 'Suggested 2–6 people; confirm table size and booking.', budget: 'Rough guide ₹300–₹1,200 per person; check the current menu.' },
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
  return requestQloo(url, {
    headers: { 'X-Api-Key': process.env.QLOO_API_KEY, Accept: 'application/json' },
    signal: AbortSignal.timeout(20_000)
  });
}

async function qlooPost(path, params, body) {
  const url = new URL(path, QLOO_BASE_URL);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  }
  return requestQloo(url, {
    method: 'POST',
    headers: { 'X-Api-Key': process.env.QLOO_API_KEY, Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000)
  });
}

const qlooTagCache = new Map();
const qlooEntityCache = new Map();

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
      const cacheKey = name.toLowerCase();
      let lookup = qlooEntityCache.get(cacheKey);
      if (!lookup) {
        lookup = qlooGet('/search', { query: name, take: 1, sort_by: 'match' }).then(payload => {
          const result = searchResults(payload)[0];
          return result?.entity_id || result?.id || result?.entity?.entity_id || result?.entity?.id || null;
        }).catch(error => {
          if (qlooEntityCache.get(cacheKey) === lookup) qlooEntityCache.delete(cacheKey);
          throw error;
        });
        qlooEntityCache.set(cacheKey, lookup);
      }
      return await lookup;
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
  const vocabulary = [
    [/\b(work|working|study|studying|laptop|focus|focused|peace|peaceful|calm|slow|relax|reset|quiet|cozy|cosy)\b/i, ['quiet cafe', 'work friendly cafe', 'coffee shop']],
    [/\b(green|leafy|nature|garden|park)\b/i, ['garden', 'nature', 'park']],
    [/\b(art|creative|gallery|museum|design|photography|architecture|culture)\b/i, ['art', 'museum', 'gallery']],
    [/\b(food|eat|dosa|meal|restaurant|cafe|coffee|bakery|brunch|breakfast|lunch|dinner)\b/i, ['restaurant', 'coffee']],
    [/\b(adventure|active|hike|hiking|climb|cycling|outdoors|trail|sport|kart|bowling|arcade|gaming|escape room|paintball|trampoline)\b/i, ['adventure activity', 'go karting', 'bowling', 'arcade']],
    [/\b(music|gig|concert|live music|jazz|indie)\b/i, ['music', 'live music']],
    [/\b(book|reading|bookstore|literary)\b/i, ['bookstore', 'books']]
  ];
  for (const [pattern, matches] of vocabulary) if (pattern.test(text)) matches.forEach(term => terms.add(term));
  if (!terms.size) {
    const modeTerms = {
      food: ['restaurant', 'coffee'],
      sights: ['art', 'museum', 'garden'],
      adventure: ['go karting', 'bowling', 'arcade', 'climbing gym']
    };
    for (const term of modeTerms[input.mode] || []) terms.add(term);
  }
  return [...terms].slice(0, 4);
}

async function resolveTasteTags(terms, { strict = false } = {}) {
  const tags = await Promise.all(terms.map(async term => {
    try {
      const cacheKey = `${strict ? 'strict' : 'loose'}:${term.toLowerCase()}`;
      let lookup = qlooTagCache.get(cacheKey);
      if (!lookup) {
        lookup = qlooGet('/v2/tags', { 'filter.query': term, take: 5 }).then(payload => {
          const results = payload?.results?.tags || payload?.results || payload?.tags || [];
          const list = Array.isArray(results) ? results : [];
          const normalizedTerm = term.toLowerCase();
          const best = list.find(tag => String(tag.name || '').toLowerCase() === normalizedTerm)
            || list.find(tag => String(tag.name || '').toLowerCase().includes(normalizedTerm))
            || (!strict ? list[0] : null);
          return best?.tag_id || best?.tag_value || best?.id || null;
        }).catch(error => {
          if (qlooTagCache.get(cacheKey) === lookup) qlooTagCache.delete(cacheKey);
          throw error;
        });
        qlooTagCache.set(cacheKey, lookup);
      }
      return await lookup;
    } catch {
      // Mood-related tags are an extra signal; recommendations can still use location and favorite entities.
      return null;
    }
  }));
  return [...new Set(tags.filter(Boolean))].slice(0, 8);
}

function groupTasteTerms(groupType) {
  const groups = {
    'just me': ['solo friendly', 'quiet places'],
    friends: ['good for groups', 'social places'],
    family: ['family friendly', 'good for kids'],
    'a date': ['romantic places', 'date night'],
    'a group': ['good for groups', 'social places']
  };
  return groups[groupType] || [];
}

function maxPriceLevel(budgetINR) {
  const budget = Number(budgetINR);
  if (!Number.isFinite(budget) || budget <= 0) return null;
  // Qloo's 1–4 price levels are relative tiers, not exact INR prices.
  if (budget <= 500) return 1;
  if (budget <= 1000) return 2;
  if (budget <= 2000) return 3;
  return 4;
}

function prioritizeBudget(places, budgetINR) {
  const target = maxPriceLevel(budgetINR);
  if (!target) return places;
  return places.map((place, index) => ({ place, index, level: Number(place.properties?.price_level ?? place.price_level) }))
    .sort((a, b) => {
      const aFit = Number.isInteger(a.level) ? (a.level <= target ? 0 : a.level - target) : 1;
      const bFit = Number.isInteger(b.level) ? (b.level <= target ? 0 : b.level - target) : 1;
      return aFit - bFit || a.index - b.index;
    }).map(entry => entry.place);
}

function hasRestaurantPriceTier(categoryId) {
  return ['coffee', 'south-indian', 'global-food', 'bakeries'].includes(categoryId);
}

async function queryCategory(categoryId, candidates, { startArea = 'Bengaluru', coordinates, budgetINR, tasteTagIds = [], groupTagIds = [], favoriteIds = [] } = {}) {
  const category = discoveryCategoryById.get(categoryId);
  const currentPoint = coordinates && Number.isFinite(Number(coordinates.latitude)) && Number.isFinite(Number(coordinates.longitude))
    ? `POINT(${Number(coordinates.longitude)} ${Number(coordinates.latitude)})`
    : null;
  const params = {
    'filter.type': 'urn:entity:place',
    ...(currentPoint
      ? { 'filter.location': currentPoint, 'signal.location': currentPoint }
      : { 'filter.location.query': startArea || 'Bengaluru', 'signal.location.query': startArea || 'Bengaluru' }),
    take: 50,
    'feature.explainability': true,
    ...([...tasteTagIds, ...groupTagIds].length
      ? { 'signal.interests.tags': [...new Set([...tasteTagIds, ...groupTagIds])].join(',') }
      : {}),
    ...(favoriteIds.length ? { 'signal.interests.entities': favoriteIds.join(',') } : {}),
    ...(hasRestaurantPriceTier(categoryId) && maxPriceLevel(budgetINR) ? { 'filter.price_level.max': maxPriceLevel(budgetINR) } : {})
  };
  const names = [...new Set(candidates.map(row => row['Place name']).filter(Boolean))];
  if (!names.length) return { category, places: [], expanded: false, signals: tasteTagIds };
  // Qloo scores only venues from the local Bengaluru catalogue. Editorial catalogue fields
  // are joined back after Qloo returns its affinity-ranked entities.
  const allEntities = [];
  // Qloo returns up to 50 affinity-ranked candidates per call. One call per
  // category keeps the planner inside the hackathon API's rate limits.
  const payload = await qlooPost('/v2/insights', params, { 'filter.results.entities.query': names });
  allEntities.push(...entityResults(payload));
  const places = dedupePlaces(allEntities)
    .map(place => enrichFromCatalog(place, candidates))
    .filter(Boolean);
  return { category, places, expanded: false, signals: [...new Set([...tasteTagIds, ...groupTagIds])] };
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

function fitsDiscoveryCategory(place, categoryId) {
  if (categoryId === 'all') return true;
  const metadataTags = [place.tags, place.properties?.tags, place.properties?.categories].flatMap(value => Array.isArray(value) ? value : []);
  const tagList = metadataTags.map(tag => String(typeof tag === 'string' ? tag : tag?.name || tag?.value || '').trim().toLowerCase()).filter(Boolean);
  const nameAndType = `${place.name || ''} ${place.type || ''} ${place.subtype || ''} ${place.properties?.subtype || ''} ${place.properties?.type || ''}`.toLowerCase();
  const venuePatterns = {
    coffee: /coffee shop|cafe|café|tea room|roaster|coffee house|coworking|work.?friendly|study.?friendly/,
    'south-indian': /south indian|dosa|idli|tiffin|udupi|filter coffee/,
    'global-food': /restaurant|dining|bistro|pizzeria|sushi|korean|mexican|thai|cuisine/,
    bakeries: /bakery|baker|patisserie|dessert|ice.?cream|sweet shop/,
    gardens: /park|garden|botanical|lake|forest|nature reserve|green space|trail/,
    art: /art|museum|gallery|theatre|theater|cultural|cinema|photography/,
    heritage: /landmark|historic|heritage|monument|architecture|palace|temple|church|fort/,
    music: /live music|music venue|concert|club|nightlife|performance/,
    books: /bookshop|bookstore|library|book cafe|reading/,
    outdoors: /go.?kart|bowling|arcade|gaming|virtual reality|\bvr\b|escape room|climb|trampoline|paintball|skating|adventure|activity centre|activity center|karting/,
    wellness: /wellness|yoga|spa|meditation|fitness|health club/,
    shopping: /design shop|craft market|boutique|independent shop|handicraft/
  };
  const tagPatterns = {
    coffee: /^(?:cafe|caf[eé]|coffee shop|coffeehouse|coffee house|tea house|tea room|roastery|coffee roaster|coworking space)$/,
    'south-indian': /south indian|dosa|idli|tiffin|udupi|karnataka cuisine/,
    'global-food': /restaurant|dining|bistro|pizzeria|sushi|korean|mexican|thai|cuisine|eatery/,
    bakeries: /bakery|baker|dessert|patisserie|ice.?cream|sweet shop/,
    gardens: /park|garden|botanical|lake|forest|nature reserve|urban green|green space/,
    art: /art|museum|gallery|theatre|theater|cultural institution|cinema|photography/,
    heritage: /historic|heritage|monument|palace|temple|church|fort|architecture|landmark/,
    music: /live music|music venue|concert|club|nightlife|performance/,
    books: /bookshop|bookstore|library|book cafe|reading/,
    outdoors: /go.?kart|bowling|arcade|gaming|virtual reality|\bvr\b|escape room|climb|trampoline|paintball|skating|adventure|activity centre|activity center/,
    wellness: /wellness|yoga|spa|meditation|fitness|health club/,
    shopping: /design shop|craft|market|boutique|handicraft|independent shop/
  };
  const venuePattern = venuePatterns[categoryId];
  const tagPattern = tagPatterns[categoryId];
  if (!venuePattern || !tagPattern) return false;
  const explicitVenueMatch = venuePattern.test(nameAndType);
  const explicitTagMatch = tagList.some(tag => tagPattern.test(tag));
  if (!explicitVenueMatch && !explicitTagMatch) return false;
  const parentVenue = /\bmall\b|shopping centre|shopping center|market city|nexus shantiniketan|phoenix marketcity|orion mall|forum mall|ub city/i;
  if (parentVenue.test(place.name || '') && !explicitVenueMatch) return false;
  if (categoryId === 'gardens' && /restaurant|museum|monument|civic building/.test(nameAndType)) return false;
  if (categoryId === 'outdoors' && /landmark|civic building|restaurant|park|garden|mall/.test(nameAndType)) return false;
  return true;
}

export async function qlooDiscoverPlaces({ categoryId = 'all', search = '', mood = '', startArea = 'Bengaluru', coordinates, favorites = [], groupType = '', budgetINR = 0, sharedSignals, sharedFavorites } = {}) {
  const category = discoveryCategoryById.get(categoryId);
  if (categoryId !== 'all' && !category) throw new Error('Choose one of the available discovery categories.');
  const searchText = String(search).trim().slice(0, 120);
  const moodTerms = [...new Set([...(searchText ? [searchText] : []), ...moodTasteTerms({ mood })])].slice(0, 1);
  const groupTerms = groupTasteTerms(groupType);
  const terms = [...new Set([...moodTerms, ...groupTerms])].slice(0, 8);
  const [tasteTags, groupTags, interests] = sharedSignals
    ? [sharedSignals.tasteTags || [], sharedSignals.groupTags || [], sharedFavorites || []]
    : await Promise.all([
      resolveTasteTags(moodTerms),
      Promise.resolve([]),
      resolveTasteSeeds((favorites || []).slice(0, 3))
    ]);
  const candidates = await catalogCandidates(categoryId, searchText);
  const queried = await queryCategory(categoryId, candidates, { startArea, coordinates, budgetINR, tasteTagIds: tasteTags, groupTagIds: groupTags, favoriteIds: interests });
  const places = prioritizeBudget(dedupePlaces([queried.places]), budgetINR).slice(0, 30);
  return {
    category: category || { id: 'all', name: 'All tastes', icon: '✳', mood: 'your own kind of curious', ambience: 'A mix of Bengaluru places, matched to the search.', company: 'Choose the places that fit your group', budget: 'Costs vary; check menus, tickets, and booking details.' },
    search: searchText,
    signals: [...terms, ...(category?.terms || [])],
    count: places.length,
    places,
    broadened: queried.expanded,
    budgetTier: maxPriceLevel(budgetINR),
    groupType
  };
}

function planCategoryIds(input) {
  const moodText = `${input.mood || ''} ${input.refinement || ''}`;
  if (input.mode === 'food') {
    const categories = [];
    if (/\b(south indian|dosa|idli|tiffin|thindi|udupi|darshini|filter coffee|bisi bele|ragi mudde)\b/i.test(moodText)) categories.push('south-indian');
    if (/\b(global|international|pizza|pasta|sushi|korean|mexican|thai|ramen|burger)\b/i.test(moodText)) categories.push('global-food');
    if (/\b(cafe|caf[eé]|coffee|tea|work|working|study|studying|laptop|focus|quiet|peace|peaceful|cozy|cosy)\b/i.test(moodText)) categories.push('coffee');
    if (/\b(bakery|bakeries|dessert|cake|pastry|patisserie|ice cream)\b/i.test(moodText)) categories.push('bakeries');
    if (categories.length) return [...new Set(categories)];
    return ['south-indian', 'global-food', 'coffee', 'bakeries'];
  }
  if (input.mode === 'sights') return ['gardens', 'art', 'heritage'];
  if (input.mode === 'adventure') return ['outdoors'];
  const explicit = [];
  if (/\b(garden|park|green|leafy|nature|lake|outdoors)\b/i.test(moodText)) explicit.push('gardens');
  if (/\b(museum|gallery|art|theatre|theater|culture|exhibition)\b/i.test(moodText)) explicit.push('art');
  if (/\b(heritage|architecture|palace|monument|history|historical)\b/i.test(moodText)) explicit.push('heritage');
  const asksForCoffeeOrWork = /\b(cafe|caf[eé]|coffee|tea|bakery|work|working|study|studying|laptop|focus)\b/i.test(moodText);
  const asksForQuietCafe = /\b(quiet|peace|peaceful|cozy|cosy)\b/i.test(moodText)
    && !/\b(garden|park|green|leafy|nature|lake|museum|gallery|art|heritage|architecture)\b/i.test(moodText);
  if (asksForCoffeeOrWork || asksForQuietCafe) explicit.push('coffee');
  if (/\b(adventure|kart|bowling|arcade|gaming|climbing|escape room|paintball|trampoline)\b/i.test(moodText)) explicit.push('outdoors');
  if (/\b(dosa|idli|tiffin|thindi|udupi|darshini|filter coffee|south indian|breakfast|lunch|dinner|meal|restaurant|food)\b/i.test(moodText)) explicit.push('south-indian');
  if (/\b(pizza|pasta|sushi|korean|mexican|thai|ramen|burger|international)\b/i.test(moodText)) explicit.push('global-food');
  if (/\b(book|reading|bookshop|bookstore|library)\b/i.test(moodText)) explicit.push('books');
  if (explicit.length) return [...new Set(explicit)];
  const cues = moodTasteTerms(input);
  if (cues.some(cue => /adventure|kart|bowling|arcade|climbing/.test(cue))) return ['outdoors'];
  if (cues.some(cue => /garden|nature|park/.test(cue))) return ['gardens'];
  if (cues.some(cue => /restaurant|coffee/.test(cue))) return ['coffee', 'south-indian'];
  if (cues.some(cue => /art|museum|gallery/.test(cue))) return ['art'];
  return ['coffee', 'gardens', 'art', 'south-indian'];
}

export async function qlooPlanPlaces(input) {
  const categoryIds = planCategoryIds(input);
  const tasteTerms = moodTasteTerms(input).slice(0, 1);
  const [tasteTags, favoriteIds] = await Promise.all([
    resolveTasteTags(tasteTerms),
    resolveTasteSeeds((input.favorites || []).slice(0, 3))
  ]);
  const sharedSignals = { tasteTags, groupTags: [] };
  const successful = [];
  const failures = [];
  // One category at a time prevents the planner from bursting the Qloo API.
  for (const categoryId of categoryIds) {
    try {
      successful.push(await qlooDiscoverPlaces({
        categoryId,
        mood: input.mood,
        startArea: input.startArea,
        coordinates: input.coordinates,
        groupType: input.groupType,
        budgetINR: input.budgetINR,
        sharedSignals,
        sharedFavorites: favoriteIds
      }));
    } catch (error) {
      failures.push(error);
      if (error?.status === 429) break;
    }
  }
  if (!successful.length) throw failures[0] || new Error('Qloo returned no relevant place matches.');
  const places = dedupePlaces(successful.map(result => result.places.slice(0, 15).map(place => ({ ...place, _agentCategory: result.category.id }))));
  return {
    results: { entities: places },
    categories: successful.map(result => result.category.id),
    signals: [...new Set(successful.flatMap(result => result.signals))],
    broadenedCategories: successful.filter(result => result.broadened).map(result => result.category.name),
    rateLimited: failures.some(error => error?.status === 429)
  };
}
