import { readFile } from 'node:fs/promises';

const QLOO_BASE_URL = 'https://hackathon.api.qloo.com';
const OPTIONS_URL = new URL('../data/bengaluru-community-options.json', import.meta.url);
const INTEREST_TAGS = {
  reading: ['books', 'reading'],
  creative: ['art', 'drawing'],
  volunteer: ['volunteering', 'community service'],
  nature: ['nature', 'environment'],
  learn: ['education', 'learning'],
  music: ['music', 'live music']
};
const THEME_CUES = {
  reading: ['book', 'reading', 'literature', 'story', 'writing', 'comic', 'poetry'],
  creative: ['art', 'drawing', 'design', 'craft', 'architecture', 'photography', 'creative', 'comic'],
  volunteer: ['volunteer', 'community', 'social impact', 'humanitarian', 'education', 'environment', 'animal', 'civic', 'charity'],
  nature: ['nature', 'environment', 'lake', 'wildlife', 'outdoor', 'city', 'drawing', 'conservation'],
  learn: ['learning', 'education', 'workshop', 'discussion', 'history', 'science', 'culture', 'story', 'architecture'],
  music: ['music', 'song', 'performance', 'concert', 'sound', 'singing', 'culture']
};
const WORD_ALIASES = new Map([
  ['books', 'book'], ['reading', 'read'], ['readers', 'read'], ['literature', 'book'],
  ['draw', 'drawing'], ['sketching', 'drawing'], ['arts', 'art'], ['artistic', 'art'],
  ['volunteering', 'volunteer'], ['volunteers', 'volunteer'], ['charitable', 'charity'],
  ['environmental', 'environment'], ['ecological', 'environment'], ['wildlife', 'animal'],
  ['workshops', 'workshop'], ['learn', 'learning'], ['educational', 'education'],
  ['stories', 'story'], ['comics', 'comic'], ['communities', 'community'], ['civic', 'city']
]);
let optionsPromise;
let requestQueue = Promise.resolve();
let lastRequestAt = 0;
const tagCache = new Map();

function qlooRequest(path, params, body = null) {
  const pending = requestQueue.then(async () => {
    const pause = Math.max(0, 450 - (Date.now() - lastRequestAt));
    if (pause) await new Promise(resolve => setTimeout(resolve, pause));
    lastRequestAt = Date.now();
    const url = new URL(path, QLOO_BASE_URL);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
    }
    const response = await fetch(url, {
      method: body ? 'POST' : 'GET',
      headers: {
        'X-Api-Key': process.env.QLOO_API_KEY,
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {})
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(15_000)
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.message || payload.error || `Qloo returned ${response.status}.`);
      error.status = response.status;
      throw error;
    }
    return payload;
  });
  requestQueue = pending.catch(() => {});
  return pending;
}

function allTags(payload) {
  const result = payload?.results;
  if (Array.isArray(result?.tags)) return result.tags;
  if (Array.isArray(result)) return result;
  if (Array.isArray(payload?.tags)) return payload.tags;
  return [];
}

function allEntities(payload) {
  const result = payload?.results;
  if (Array.isArray(result?.entities)) return result.entities;
  if (Array.isArray(result?.places)) return result.places;
  if (Array.isArray(result)) return result;
  if (Array.isArray(payload?.entities)) return payload.entities;
  return [];
}

function tagName(tag) {
  return String(tag?.name || tag?.value || tag?.tag_value || '').trim();
}

function tagId(tag) {
  return tag?.tag_id || tag?.id || tag?.tag_value || null;
}

function tagAffinity(tag, index) {
  const candidates = [tag?.query?.affinity, tag?.affinity, tag?.score, tag?.query?.score];
  for (const candidate of candidates) {
    const value = Number(candidate);
    if (Number.isFinite(value) && value > 0) return Math.min(value, 1);
  }
  return 1 / (index + 1);
}

async function resolveTag(term, preferRestaurant = false) {
  const normalized = term.toLowerCase();
  const cacheKey = `${preferRestaurant ? 'restaurant:' : ''}${normalized}`;
  if (!tagCache.has(cacheKey)) {
    const pending = qlooRequest('/v2/tags', { 'filter.query': term, take: 5 }).then(payload => {
      const tags = allTags(payload);
      const matches = tags.filter(tag => tagId(tag));
      const restaurantTag = preferRestaurant && matches.find(tag => /restaurant/i.test(String(tagId(tag))) || /restaurant/i.test(tagName(tag)));
      const best = restaurantTag || matches.find(tag => tagName(tag).toLowerCase() === normalized)
        || matches.find(tag => tagName(tag).toLowerCase().includes(normalized))
        || matches.find(tag => normalized.includes(tagName(tag).toLowerCase()));
      return best ? { id: tagId(best), name: tagName(best) || term } : null;
    }).catch(error => {
      tagCache.delete(cacheKey);
      throw error;
    });
    tagCache.set(cacheKey, pending);
  }
  return tagCache.get(cacheKey);
}

const CUISINE_TERMS = [
  ['korean', ['Korean restaurant', 'Korean cuisine', 'Korean']],
  ['japanese', ['Japanese restaurant', 'Japanese cuisine', 'Japanese']],
  ['thai', ['Thai restaurant', 'Thai cuisine', 'Thai']],
  ['chinese', ['Chinese restaurant', 'Chinese cuisine', 'Chinese']],
  ['vietnamese', ['Vietnamese restaurant', 'Vietnamese cuisine', 'Vietnamese']],
  ['indonesian', ['Indonesian restaurant', 'Indonesian cuisine', 'Indonesian']],
  ['malaysian', ['Malaysian restaurant', 'Malaysian cuisine', 'Malaysian']],
  ['italian', ['Italian restaurant', 'Italian cuisine', 'Italian']],
  ['mexican', ['Mexican restaurant', 'Mexican cuisine', 'Mexican']],
  ['south indian', ['South Indian restaurant', 'South Indian cuisine', 'South Indian']],
  ['north indian', ['North Indian restaurant', 'North Indian cuisine', 'North Indian']],
  ['indian', ['Indian restaurant', 'Indian cuisine', 'Indian']],
  ['mediterranean', ['Mediterranean restaurant', 'Mediterranean cuisine', 'Mediterranean']],
  ['middle eastern', ['Middle Eastern restaurant', 'Middle Eastern cuisine', 'Middle Eastern']],
  ['french', ['French restaurant', 'French cuisine', 'French']],
  ['american', ['American restaurant', 'American cuisine', 'American']],
  ['greek', ['Greek restaurant', 'Greek cuisine', 'Greek']],
  ['lebanese', ['Lebanese restaurant', 'Lebanese cuisine', 'Lebanese']],
  ['bengali', ['Bengali restaurant', 'Bengali cuisine', 'Bengali']],
  ['rajasthani', ['Rajasthani restaurant', 'Rajasthani cuisine', 'Rajasthani']],
  ['karnataka', ['Kannada restaurant', 'Karnataka cuisine', 'Karnataka']],
  ['ethiopian', ['Ethiopian restaurant', 'Ethiopian cuisine', 'Ethiopian']],
  ['afghan', ['Afghan restaurant', 'Afghan cuisine', 'Afghan']]
];

function matchingCuisineTerms(interests) {
  const query = ` ${interests.join(' ').toLowerCase().replace(/[^a-z0-9]+/g, ' ')} `;
  return CUISINE_TERMS.find(([name]) => query.includes(` ${name} `))?.[1] || [];
}

function placeProperties(entity) {
  return entity?.properties || entity || {};
}

function normalizePlace(entity) {
  const properties = placeProperties(entity);
  const rawTags = properties.tags || entity.tags || [];
  const tags = (Array.isArray(rawTags) ? rawTags : []).map(tag => String(tag?.name || tag?.value || tag || '').trim()).filter(Boolean);
  const geocode = properties.geocode || {};
  const address = properties.address || properties.formatted_address || properties.location?.address || '';
  const rating = properties.business_rating || properties.rating || entity.rating || null;
  const affinity = entity.query?.affinity ?? entity.affinity ?? null;
  const explainability = entity.query?.explainability;
  const qlooReason = explainability && typeof explainability === 'object'
    ? 'Qloo ranked this place using your taste signals and Bengaluru location.'
    : 'Recommended by Qloo from your taste signals and Bengaluru location.';
  return {
    id: entity.entity_id || entity.id || '',
    name: entity.name || properties.name || '',
    description: properties.description || '',
    address,
    area: geocode.name || geocode.neighborhood || properties.neighborhood || '',
    tags,
    priceLevel: properties.price_level || properties.priceLevel || null,
    rating,
    ratingCount: properties.business_rating_count || properties.rating_count || null,
    website: properties.website || properties.url || entity.url || '',
    image: properties.image?.url || properties.image || '',
    affinity,
    qlooReason
  };
}

const FOOD_PLACE_TAG = /\b(restaurant|cafe|café|coffee shop|coffeehouse|bakery|diner|eatery|food court|food truck|food stall|fast food|pizzeria|pizza restaurant|dessert shop|ice cream shop|tea house|juice bar)\b/i;
const NON_FOOD_NAME = /\b(residents? welfare|association|college|university|school|book ?store|clothing store|corporate office|health ?care|clinic|hospital|recruitment|evaluation private limited)\b/i;
const GENERIC_RESTAURANT_TAG = /^restaurant$/i;
const GENERIC_FOOD_WORDS = new Set(['food', 'foods', 'cuisine', 'cuisines', 'restaurant', 'restaurants', 'place', 'places', 'spot', 'spots', 'eat', 'eating', 'near', 'find', 'show', 'want', 'some', 'good', 'best', 'bengaluru', 'bangalore']);

function foodSearchWords(interests) {
  return [...new Set(interests.flatMap(value => normalizeWords(value)))]
    .filter(word => !GENERIC_FOOD_WORDS.has(word));
}

function filterFoodPlaces(places, interests) {
  const words = foodSearchWords(interests);
  return places.map((place, index) => {
    const foodTypeTags = place.tags.filter(tag => FOOD_PLACE_TAG.test(tag) && !GENERIC_RESTAURANT_TAG.test(tag.trim()));
    const tagText = foodTypeTags.join(' ');
    const hotelClass = place.tags.some(tag => /hotel class/i.test(tag));
    if (!foodTypeTags.length || NON_FOOD_NAME.test(place.name) || hotelClass && /\bhotel\b/i.test(place.name)) return null;
    const searchable = new Set(normalizeWords(`${place.name} ${place.description} ${tagText} ${place.tags.join(' ')}`));
    if (words.length && !words.some(word => searchable.has(word))) return null;
    const textScore = words.reduce((score, word) => score + (searchable.has(word) ? 1 : 0), 0)
      + words.reduce((score, word) => score + (normalizeWords(place.name).includes(word) ? 2 : 0), 0);
    return { place, index, textScore, affinity: Number(place.affinity) || 0 };
  }).filter(Boolean)
    .sort((a, b) => b.textScore - a.textScore || b.affinity - a.affinity || a.index - b.index)
    .map(({ place }) => place);
}

async function loadOptions() {
  if (!optionsPromise) {
    optionsPromise = readFile(OPTIONS_URL, 'utf8').then(text => JSON.parse(text)).catch(error => {
      optionsPromise = null;
      throw error;
    });
  }
  return optionsPromise;
}

function normalizeWords(value) {
  return String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/)
    .filter(word => word.length > 2)
    .map(word => WORD_ALIASES.get(word) || word);
}

function queryCurrentDate() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

function filterOptions(options, input) {
  const requestedThemes = [...new Set(input.themes || [])];
  const themes = requestedThemes.includes('any') ? Object.keys(THEME_CUES) : requestedThemes.filter(theme => THEME_CUES[theme]);
  const maxPrice = input.budget === 'free' ? 0 : Number(input.budget);
  const hasBudgetLimit = input.budget === 'free' || Number.isFinite(maxPrice) && maxPrice > 0;
  const area = String(input.area || '').trim().toLowerCase();
  const cityWideArea = ['bengaluru', 'bangalore'].includes(area);
  const today = queryCurrentDate();
  return options.filter(option => {
    if (option.activeUntil && option.activeUntil < today) return false;
    if (themes.length && !themes.some(theme => option.themes.includes(theme))) return false;
    if (hasBudgetLimit && (option.priceINR === null || option.priceINR > maxPrice)) return false;
    if (area && !cityWideArea && !option.area.toLowerCase().includes(area)) return false;
    if (input.joinStyle === 'beginner' && !/beginners? welcome|no prior experience|no drawing experience|without prior experience|welcome.*experience/i.test(option.newcomer)) return false;
    if (input.joinStyle === 'drop-in' && option.format !== 'drop-in') return false;
    if (input.joinStyle === 'ongoing' && option.format !== 'ongoing') return false;
    return true;
  });
}

function scoreOption(option, qlooTags, selectedThemes, interests) {
  const optionCues = normalizeWords(`${option.tasteCues.join(' ')} ${option.themes.join(' ')}`);
  const optionTokens = new Set(optionCues);
  const interestTokens = new Set(interests.flatMap(normalizeWords));
  const selectedThemeTokens = new Set(selectedThemes.flatMap(theme => normalizeWords(THEME_CUES[theme].join(' '))));
  let score = 0;
  const bridges = [];
  const broadPlaceTokens = new Set(['food', 'cafe', 'restaurant', 'hotel', 'tourist', 'attraction', 'shopping', 'retail', 'store', 'bar', 'alcohol', 'pizza', 'delivery', 'breakfast', 'dining', 'dishes', 'place', 'coffee', 'nightlife']);
  for (const [index, tag] of qlooTags.entries()) {
    const name = tagName(tag);
    const tokens = normalizeWords(name).filter(token => !broadPlaceTokens.has(token)
      && (interestTokens.has(token) || selectedThemeTokens.has(token)));
    if (!tokens.length) continue;
    const overlap = tokens.filter(token => optionTokens.has(token));
    const themeMatch = selectedThemes.some(theme => {
      const themeTokens = new Set(normalizeWords(THEME_CUES[theme].join(' ')));
      return tokens.some(token => themeTokens.has(token)) && option.themes.includes(theme);
    });
    const weight = tagAffinity(tag, index);
    if (overlap.length || themeMatch) {
      const contribution = weight * Math.min(1, overlap.length * 0.45 + (themeMatch ? 0.45 : 0));
      score += contribution;
      bridges.push({ name, contribution });
    }
  }
  return { score, bridges: bridges.sort((a, b) => b.contribution - a.contribution).slice(0, 2) };
}

export async function getBelongingMatches(input = {}) {
  if (!process.env.QLOO_API_KEY) {
    const error = new Error('Qloo is not configured. Add the Qloo hackathon key in the server environment.');
    error.status = 503;
    throw error;
  }
  const interests = [...new Set((input.interests || []).map(value => String(value).trim()).filter(Boolean))].slice(0, 3);
  const requestedThemes = [...new Set(input.themes || [])];
  const themes = requestedThemes.includes('any') ? Object.keys(THEME_CUES) : requestedThemes.filter(theme => THEME_CUES[theme]);
  if (!interests.length && !themes.length) {
    const error = new Error('Add at least one interest or choose an activity type to begin.');
    error.status = 400;
    throw error;
  }

  const options = await loadOptions();
  const eligibleOptions = filterOptions(options, { ...input, themes: requestedThemes.includes('any') ? [] : themes });
  if (!eligibleOptions.length) {
    return { options: [], signals: [], eligibleCount: 0, resolvedInterests: [], message: 'No checked activities meet every filter you selected. Widen one filter and try again.' };
  }

  const seedTags = [];
  if (!interests.length) {
    const signalThemes = requestedThemes.includes('any') ? ['creative', 'reading', 'volunteer'] : themes.slice(0, 3);
    for (const theme of signalThemes) {
      for (const term of INTEREST_TAGS[theme]) {
        try {
          const tag = await resolveTag(term);
          if (tag?.id) seedTags.push(tag);
          if (tag?.id) break;
        } catch (error) {
          if (error.status === 429) throw error;
        }
      }
    }
  }
  const interestTagIds = [...new Set(seedTags.map(tag => tag.id))];
  if (!interests.length && !interestTagIds.length) {
    return { options: [], matchMode: 'no-match', eligibleCount: eligibleOptions.length, signals: [], message: 'Qloo could not resolve a cultural signal for this activity type. Add a book, artist, film, or cause to get a taste-based match.' };
  }

  const insightParams = {
    'filter.type': 'urn:tag',
    take: 50,
    'feature.explainability': true,
    'signal.location.query': 'Bengaluru',
    ...(interestTagIds.length ? { 'signal.interests.tags': interestTagIds.join(',') } : {})
  };
  const insightBody = interests.length
    ? { 'signal.interests.entities.query': interests.map(name => ({ name, address: '' })) }
    : null;
  const insightPayload = await qlooRequest('/v2/insights', insightParams, insightBody);
  const relatedTags = allTags(insightPayload).filter(tag => tagName(tag));
  const ranked = eligibleOptions.map((option, index) => ({
    option,
    index,
    ...scoreOption(option, relatedTags, themes, interests)
  })).filter(result => result.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 30)
    .map(({ option, score, bridges }) => ({
      ...option,
      qlooScore: Math.round(score * 100) / 100,
      qlooBridge: bridges.map(bridge => bridge.name),
      qlooReason: bridges.length
        ? `Qloo connected your chosen taste signals to ${bridges.map(bridge => bridge.name).join(' and ')}.`
        : 'Qloo matched this checked activity to your selected interests.'
    }));

  const hasCulturalMatches = ranked.length > 0;

  return {
    options: ranked,
    matchMode: hasCulturalMatches ? 'qloo' : 'no-match',
    eligibleCount: eligibleOptions.length,
    signals: hasCulturalMatches ? [...new Set(ranked.flatMap(option => option.qlooBridge))].map(name => ({ name, affinity: null })) : [],
    message: hasCulturalMatches ? '' : 'Qloo found no direct cultural connection among the checked activities that meet every filter. Try another taste or widen one filter.'
  };
}

export async function getPlaceMatches(input = {}) {
  if (!process.env.QLOO_API_KEY) {
    const error = new Error('Qloo is not configured. Add the Qloo hackathon key in the server environment.');
    error.status = 503;
    throw error;
  }
  const interests = [...new Set((input.interests || []).map(value => String(value).trim()).filter(Boolean))].slice(0, 3);
  if (!interests.length) {
    const error = new Error('Enter a cuisine, dish, or taste to find Bengaluru places.');
    error.status = 400;
    throw error;
  }

  const cuisineTerms = matchingCuisineTerms(interests);
  const tasteTags = [];
  let restaurantTag = null;
  for (const term of cuisineTerms) {
    try {
      const tag = await resolveTag(term, true);
      if (tag?.id && (/restaurant/i.test(String(tag.id)) || /restaurant/i.test(tag.name))) {
        restaurantTag = tag;
        tasteTags.push(tag);
        break;
      }
    } catch (error) {
      if (error.status === 429) throw error;
    }
  }

  // Cuisine aliases cover common wording; resolve every other food or dish directly
  // through Qloo so searches like ramen, biryani, dumplings, or gelato are supported too.
  if (!tasteTags.length) {
    for (const interest of interests) {
      try {
        const tag = await resolveTag(interest, true);
        if (tag?.id) {
          if (/restaurant/i.test(String(tag.id)) || /restaurant/i.test(tag.name)) restaurantTag ||= tag;
          if (!tasteTags.some(existing => existing.id === tag.id)) tasteTags.push(tag);
        }
      } catch (error) {
        if (error.status === 429) throw error;
      }
    }
  }

  const params = {
    'filter.type': 'urn:entity:place',
    'filter.location.query': String(input.area || '').trim() || 'Bengaluru',
    take: 30,
    sort_by: 'affinity',
    'feature.explainability': true,
    ...(restaurantTag ? { 'filter.tags': restaurantTag.id } : {}),
    ...(Number(input.budget) >= 1 && Number(input.budget) <= 4 ? { 'filter.price_level.max': Number(input.budget) } : {})
  };
  const body = tasteTags.length
    ? { 'signal.interests.tags': tasteTags.map(tag => ({ tag: tag.id, weight: 10 })) }
    : { 'signal.interests.entities.query': interests.map(name => ({ name, address: '', resolve_to: 'both' })) };
  const payload = await qlooRequest('/v2/insights', params, body);
  const candidates = allEntities(payload).map(normalizePlace).filter(place => place.name);
  const places = filterFoodPlaces(candidates, interests);
  return {
    mode: 'places',
    options: places,
    eligibleCount: places.length,
    signals: tasteTags.map(tag => ({ name: tag.name, affinity: null })),
    message: places.length ? '' : candidates.length
      ? 'Qloo returned Bengaluru places, but none had matching food-place categories and food tags for this search. Try a broader dish or cuisine term.'
      : 'Qloo did not find close Bengaluru food places for this search and price level. Try another dish, cuisine, nearby area, or price level.'
  };
}
