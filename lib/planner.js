import { qlooPlaces } from './qloo.js';

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';

function extractGeminiText(payload) {
  const outputStep = payload.steps?.find(step => step.type === 'model_output') || payload.steps?.at(-1);
  const blocks = Array.isArray(outputStep?.content) ? outputStep.content : [];
  const text = blocks.map(block => block.text || '').join('') || payload.output_text || '';
  return { blocks, text: text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim() };
}

async function callGemini(body, timeout = 45_000) {
  const keys = [...new Set([process.env.GEMINI_API_KEY, process.env.GEMINI_FALLBACK_API_KEY].filter(Boolean))];
  let lastError;
  for (const [index, key] of keys.entries()) {
    try {
      const response = await fetch(GEMINI_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({ model: process.env.GEMINI_MODEL || 'gemini-3.8-flash', ...body }),
        signal: AbortSignal.timeout(timeout)
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error?.message || `Gemini returned ${response.status}.`);
      return { ...extractGeminiText(payload), usedFallbackKey: index > 0 };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('No Gemini API key is configured.');
}

function geminiPrompt(input, qlooPayload) {
  const candidates = qlooPayload?.results?.entities || qlooPayload?.entities || [];
  const places = candidates.map((place, index) => ({
    name: place.name, type: place.type, address: place.properties?.address,
    city: place.properties?.geocode?.city,
    category: place.tags?.map(tag => tag.name).filter(Boolean).slice(0, 6),
    affinity: place.affinity, popularity: place.popularity,
    qlooExplainability: place.query?.explainability,
    website: place.properties?.website, index
  }));
  return `You are the planning agent for Elsewhere, a Bengaluru discovery product for locals and visitors planning outings alone or with others. Create a useful, grounded recommendation using Qloo place recommendations as the cultural-fit shortlist and current Google Search results for practical facts. Make the city's identity specific when useful: Bengaluru neighborhoods, gardens, Vidhana Soudha, Namma Metro, BMTC and local food culture. Never invent opening hours, costs, current availability, safety claims, travel times, or a Qloo affinity score. If information is unclear, say so and link to a source or Google Maps. Adapt suggestions and practical notes to the requested company (${input.groupType || 'not specified'}) without assuming every outing is solo. Prefer a varied route with realistic buffers and no more than 4 stops for a day plan. Use the user’s budget in INR as a total target, and label any cost as an estimate.

Return only valid JSON with this shape: {"title":string,"summary":string,"dayPlan":boolean,"items":[{"name":string,"category":string,"time":string,"address":string,"estimatedCostINR":number|null,"reason":string,"qlooFit":string,"goodToKnow":string,"gettingThere":string,"sourceUrls":[string]}],"budgetNote":string,"travelNote":string,"followUpPrompt":string}. items should contain 1-4 places, be appropriate to the selected mode, and favor Qloo candidates when possible. qlooFit must explain cultural fit from available Qloo evidence or say the recommendation was from Qloo's Bengaluru place graph when no per-place explanation is returned. goodToKnow should offer relevant practical context for the selected group, such as booking, accessibility, or family suitability, only when verified. Use source URLs from Google Search or Google Maps annotations when possible; no fabricated links. Use Google Maps to ground the ordering and give approximate travel times and transport guidance that match the user's selected mode. If Maps cannot confirm a duration, say to check the linked route instead of guessing.

Qloo mood/taste terms resolved from the selected outing style and explicit interests: ${JSON.stringify(input.qlooTasteSignals || [])}. These are search signals, not a psychological diagnosis. Use Qloo's explainability metadata, when present, to describe cultural fit.

Interpretation of the user's request: ${JSON.stringify(input.interpretation || {})}. Keep inferred preferences tentative; honor explicit constraints and do not claim emotional certainty.

User request: ${JSON.stringify(input)}

Qloo place candidates (use these as the source of cultural fit; do not add made-up Qloo data): ${JSON.stringify(places)}`;
}

async function geminiPlan(input, qlooPayload) {
  const locationTool = input.coordinates
    ? { type: 'google_maps', latitude: input.coordinates.latitude, longitude: input.coordinates.longitude }
    : { type: 'google_maps' };
  const { blocks, text: clean, usedFallbackKey } = await callGemini({ input: geminiPrompt(input, qlooPayload), tools: [{ type: 'google_search' }, locationTool] });
  let plan;
  try { plan = JSON.parse(clean); } catch { throw new Error('Gemini returned a response that could not be read. Please try again.'); }
  const annotations = blocks.flatMap(block => block.annotations || []);
  const sources = annotations.map(annotation => ({ title: annotation.name || annotation.title || 'Source', platform: annotation.type === 'place_citation' ? 'Google Maps' : 'Web', url: annotation.url || annotation.uri })).filter(source => source.url);
  return { plan, sources, interpretation: input.interpretation, qlooTasteSignals: input.qlooTasteSignals || [], qlooCount: qlooPayload?.results?.entities?.length || qlooPayload?.entities?.length || 0, live: true, backupKeyUsed: usedFallbackKey };
}

export async function curateDiscoveryPlaces({ category, search = '', area = 'Bengaluru', signals = [], places = [] }) {
  if (!process.env.GEMINI_API_KEY && !process.env.GEMINI_FALLBACK_API_KEY) {
    throw new Error('Add the Gemini API key to curate Qloo place matches.');
  }
  const candidates = places.slice(0, 30).map((place, index) => ({
    index,
    name: place.name,
    type: place.type,
    address: place.properties?.address || place.properties?.formatted_address || place.properties?.geocode?.neighborhood || '',
    city: place.properties?.geocode?.city || '',
    tags: (Array.isArray(place.tags) ? place.tags : []).map(tag => tag?.name).filter(Boolean).slice(0, 10),
    qlooExplainability: place.query?.explainability || place.explainability || '',
    affinity: place.affinity
  }));
  const categoryName = category?.name || 'Bengaluru places matching the search';
  const categoryIntent = category?.intent || 'Select places that directly match the user’s search. Exclude unrelated categories.';
  const prompt = `You curate the place list for Elsewhere, a Bengaluru discovery app. Qloo has produced this candidate list from the user's selected theme and cultural taste signals. Your job is to keep only candidates that actually match the selected category and mood, then explain the fit clearly.

Selected page: ${categoryName}
Strict category intent: ${categoryIntent}
Mood: ${category?.mood || 'Follow the user search.'}
User's extra search text: ${search || '(none)'}
Area: ${area}
Qloo taste signals: ${JSON.stringify(signals)}

Rules:
- Return only candidates from the supplied list. Never invent, rename, or add places.
- Check each candidate's name, type, address, and Qloo tags against the strict category intent. When these do not support the category, leave it out.
- For Gardens & green escapes, only include actual parks, gardens, botanical gardens, nature reserves, lakeside green spaces, or forest trails. Exclude malls, restaurants, museums, monuments, and civic buildings.
- For Adventure & activities, prioritize actual activity venues and providers such as go-kart tracks, bowling alleys, arcades and gaming cafés, VR arenas, escape rooms, climbing gyms, trampoline parks, paintball, skating, and adventure-sport operators. Exclude landmarks, civic buildings, ordinary parks, malls as a whole, and restaurants.
- Do not assume a mall is a park, an attraction, or a standalone shop. Do not assume a park offers paid activities unless Qloo evidence says so.
- Be strict and relevant. Return as many good matches as possible, aiming for 10 when the candidate list supports it. Never pad the list with weak or unrelated matches.
- Write short, useful explanations from the user's mood and Qloo evidence. Do not invent opening hours, prices, activity availability, facilities, safety, or exact venue atmosphere. Mark subjective fit as a suggestion, not a fact.
- Use zero-based candidate indexes exactly as provided.

Return only valid JSON: {"matches":[{"index":0,"fit":"Why it matches the selected theme and Qloo taste cues","mood":"How this place could fit the requested mood","ambience":"Atmosphere suggested by the available category or Qloo evidence"}]}

Qloo candidates: ${JSON.stringify(candidates)}`;
  const { text } = await callGemini({ input: prompt }, 35_000);
  let output;
  try { output = JSON.parse(text); }
  catch { throw new Error('Gemini returned a place list that could not be read.'); }
  const seen = new Set();
  const matches = (Array.isArray(output.matches) ? output.matches : []).flatMap(match => {
    const index = Number(match.index);
    if (!Number.isInteger(index) || index < 0 || index >= places.length || seen.has(index)) return [];
    seen.add(index);
    const place = places[index];
    if (!place?.name) return [];
    return [{
      ...place,
      curatedFit: String(match.fit || '').slice(0, 360),
      curatedMood: String(match.mood || category?.mood || '').slice(0, 180),
      curatedAmbience: String(match.ambience || category?.ambience || '').slice(0, 220)
    }];
  });
  return { places: matches, geminiCurated: true };
}

const localPlaces = {
  day: [
    ['Lalbagh Botanical Garden', 'Garden', 'Mavalli'],
    ['Cubbon Park', 'Park', 'Sampangi Rama Nagar'],
    ['National Gallery of Modern Art', 'Art & culture', 'Vasanth Nagar']
  ],
  food: [
    ['Vidyarthi Bhavan', 'South Indian food', 'Basavanagudi'],
    ['Mavalli Tiffin Rooms', 'South Indian food', 'Lalbagh Road'],
    ['Brahmin’s Coffee Bar', 'Coffee & breakfast', 'Basavanagudi']
  ],
  sights: [
    ['Vidhana Soudha', 'Architecture & landmark', 'Ambedkar Veedhi'],
    ['Lalbagh Botanical Garden', 'Garden', 'Mavalli'],
    ['National Gallery of Modern Art', 'Art & culture', 'Vasanth Nagar']
  ],
  adventure: [
    ['Turahalli Forest', 'Nature & outdoors', 'South Bengaluru'],
    ['Ulsoor Lake', 'Lakeside walk', 'Halasuru'],
    ['Cubbon Park', 'Outdoor recreation', 'Sampangi Rama Nagar']
  ]
};

function placeKinds(place) {
  const tags = Array.isArray(place.tags) ? place.tags.map(tag => tag?.name || '').join(' ') : '';
  const text = `${place.name || ''} ${place.type || ''} ${tags}`.toLowerCase();
  const kinds = [];
  if (/\b(food|restaurant|cafe|café|coffee|bakery|dining|dosa|brunch|tea house)\b/.test(text)) kinds.push('food');
  if (/\b(park|garden|botanical|lake|forest|nature|trail|green space)\b/.test(text)) kinds.push('green');
  if (/\b(art|museum|gallery|theatre|theater|culture|cinema|photography)\b/.test(text)) kinds.push('art');
  if (/\b(adventure|sport|outdoor|climb|hike|recreation|cycling|kayak|activity)\b/.test(text)) kinds.push('outdoors');
  if (/\b(landmark|historic|historical|monument|architecture|palace|temple|church|fort)\b/.test(text)) kinds.push('sights');
  return kinds;
}

function requestedKinds(input) {
  const text = `${input.mood || ''} ${input.refinement || ''}`.toLowerCase();
  const kinds = new Set({
    food: ['food'],
    sights: ['sights', 'art', 'green'],
    adventure: ['outdoors', 'green']
  }[input.mode] || []);
  if (/\b(green|garden|park|nature|leafy|peaceful|calm|outdoors?)\b/.test(text)) kinds.add('green');
  if (/\b(coffee|cafe|café|food|eat|dosa|restaurant|bakery|brunch|breakfast|lunch|dinner)\b/.test(text)) kinds.add('food');
  if (/\b(art|creative|gallery|museum|culture|photography|cinema|theatre|theater)\b/.test(text)) kinds.add('art');
  if (/\b(adventure|active|hike|climb|cycling|trail|sport)\b/.test(text)) kinds.add('outdoors');
  if (/\b(see|sights?|landmark|architecture|monument|historic|palace)\b/.test(text)) kinds.add('sights');
  return [...kinds];
}

function displayCategory(kinds) {
  if (kinds.includes('food')) return 'Food & coffee';
  if (kinds.includes('green')) return 'Garden & outdoors';
  if (kinds.includes('art')) return 'Art & culture';
  if (kinds.includes('outdoors')) return 'Adventure & activity';
  if (kinds.includes('sights')) return 'Landmark & architecture';
  return 'Bengaluru place';
}

function fallbackPlan(input, qlooPayload, reason) {
  const candidates = qlooPayload?.results?.entities || qlooPayload?.entities || [];
  const kinds = requestedKinds(input);
  const ranked = candidates.map((place, index) => ({ place, index, kinds: placeKinds(place) }))
    .filter(entry => entry.place?.name && entry.kinds.some(kind => kinds.includes(kind)))
    .sort((a, b) => b.kinds.filter(kind => kinds.includes(kind)).length - a.kinds.filter(kind => kinds.includes(kind)).length || a.index - b.index);
  const selected = [];
  for (const kind of kinds) {
    const entry = ranked.find(candidate => candidate.kinds.includes(kind) && !selected.includes(candidate));
    if (entry) selected.push(entry);
  }
  for (const entry of ranked) {
    if (selected.length >= 4) break;
    if (!selected.includes(entry)) selected.push(entry);
  }
  const isQloo = selected.length > 0;
  const places = isQloo
    ? selected.slice(0, 4).map(({ place, kinds: matchedKinds }) => ({
      name: place.name,
      category: displayCategory(matchedKinds),
      address: place.properties?.address || place.properties?.geocode?.city || 'Bengaluru'
    }))
    : (localPlaces[input.mode] || localPlaces.day).slice(0, 3).map(([name, category, address]) => ({ name, category, address }));

  const items = places.map((place, index) => ({
    ...place,
    time: `Stop ${index + 1} · Explore`,
    estimatedCostINR: null,
    reason: input.mood
      ? `A ${input.mode || 'day'}-out suggestion to consider for “${String(input.mood).slice(0, 100)}”.`
      : 'A Bengaluru place to consider for this outing.',
    qlooFit: isQloo
      ? 'Selected from Qloo’s place recommendations for this request.'
      : 'A familiar Bengaluru suggestion; no closely matching Qloo place was selected for this request.',
    goodToKnow: 'Check current hours, entry details, and availability before you go.',
    gettingThere: 'Open the route in Google Maps to check current options.'
  }));

  return {
    plan: {
      title: isQloo ? 'Your Bengaluru shortlist' : 'A Bengaluru shortlist',
      summary: isQloo
        ? 'A shortlist of Qloo place matches selected for your request.'
        : qlooPayload
          ? 'No close Qloo place matches were available for these preferences. These familiar Bengaluru suggestions are a starting point; check current details before travelling.'
          : 'A few familiar Bengaluru places to start with. Open Maps to check current details before you go.',
      dayPlan: (input.mode || 'day') === 'day',
      items,
      budgetNote: 'Prices and availability are not confirmed; check current details before you go.',
      travelNote: 'Check Google Maps for current routes, travel times, and transit.'
    },
    sources: [],
    interpretation: input.interpretation,
    qlooTasteSignals: input.qlooTasteSignals || [],
    qlooCount: candidates.length,
    qlooMatchesUsed: isQloo ? places.length : 0,
    live: isQloo,
    fallback: true,
    fallbackReason: reason
  };
}

export async function createPlan(input) {
  let qloo = null;
  let interpretedInput = { ...input, interpretation: {} };
  let reason = '';

  if (process.env.QLOO_API_KEY) {
    try {
      qloo = await qlooPlaces(interpretedInput);
    } catch (error) {
      reason = 'Qloo is temporarily unavailable.';
    }
  } else {
    reason = 'The Qloo API key is not configured.';
  }

  if (qloo && (process.env.GEMINI_API_KEY || process.env.GEMINI_FALLBACK_API_KEY)) {
    try {
      return { status: 200, body: await geminiPlan(interpretedInput, qloo) };
    } catch (error) {
      reason = 'Gemini is temporarily unavailable.';
      console.error('[planner] Gemini plan request failed:', error?.message || error);
    }
  } else if (qloo) {
    reason = 'The Gemini API key is not configured.';
  }

  return { status: 200, body: fallbackPlan(interpretedInput, qloo, reason) };
}
