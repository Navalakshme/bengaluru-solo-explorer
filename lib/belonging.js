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

async function resolveTag(term) {
  const normalized = term.toLowerCase();
  if (!tagCache.has(normalized)) {
    const pending = qlooRequest('/v2/tags', { 'filter.query': term, take: 5 }).then(payload => {
      const tags = allTags(payload);
      const best = tags.find(tag => tagName(tag).toLowerCase() === normalized)
        || tags.find(tag => tagName(tag).toLowerCase().includes(normalized));
      return best ? { id: tagId(best), name: tagName(best) || term } : null;
    }).catch(error => {
      tagCache.delete(normalized);
      throw error;
    });
    tagCache.set(normalized, pending);
  }
  return tagCache.get(normalized);
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

function scoreOption(option, qlooTags, selectedThemes) {
  const optionCues = normalizeWords(`${option.tasteCues.join(' ')} ${option.themes.join(' ')}`);
  const optionTokens = new Set(optionCues);
  let score = 0;
  const bridges = [];
  for (const [index, tag] of qlooTags.entries()) {
    const name = tagName(tag);
    const tokens = normalizeWords(name);
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
    return {
      options: eligibleOptions.slice(0, 12).map(option => ({
        ...option,
        qlooScore: null,
        qlooBridge: [],
        qlooReason: 'This listing matches your selected activity filters. Qloo could not resolve a cultural signal for this type.'
      })),
      matchMode: 'activity-filter',
      eligibleCount: eligibleOptions.length,
      signals: [],
      message: 'Qloo could not resolve this activity type, so these listings are matched to your filters rather than taste-ranked.'
    };
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
    ...scoreOption(option, relatedTags, themes)
  })).filter(result => result.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 12)
    .map(({ option, score, bridges }) => ({
      ...option,
      qlooScore: Math.round(score * 100) / 100,
      qlooBridge: bridges.map(bridge => bridge.name),
      qlooReason: bridges.length
        ? `Qloo connected your chosen taste signals to ${bridges.map(bridge => bridge.name).join(' and ')}.`
        : 'Qloo matched this checked activity to your selected interests.'
    }));

  const hasCulturalMatches = ranked.length > 0;
  const fallbackOptions = hasCulturalMatches ? [] : eligibleOptions.slice(0, 12).map(option => ({
    ...option,
    qlooScore: null,
    qlooBridge: [],
    qlooReason: 'This listing matches your selected activity filters. Qloo returned no direct cultural link for it.'
  }));

  return {
    options: hasCulturalMatches ? ranked : fallbackOptions,
    matchMode: hasCulturalMatches ? 'qloo' : 'activity-filter',
    eligibleCount: eligibleOptions.length,
    signals: relatedTags.slice(0, 10).map((tag, index) => ({ name: tagName(tag), affinity: tagAffinity(tag, index) })),
    message: hasCulturalMatches ? '' : 'No direct Qloo cultural link matched these listings. Showing source-checked activities that fit your selected filters; add another interest or change an activity type for a closer match.'
  };
}
