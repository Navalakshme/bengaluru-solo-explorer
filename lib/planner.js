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
  return `You are the planning agent for Bengaluru Solo Explorer, a solo-first local discovery product. Create a useful, grounded recommendation using Qloo place recommendations as the cultural-fit shortlist and current Google Search results for practical facts. Never invent opening hours, costs, current availability, safety claims, travel times, or a Qloo affinity score. If information is unclear, say so and link to a source or Google Maps. Treat solo comfort as practical context only; never guarantee safety. Prefer a varied route with realistic buffers and no more than 4 stops for a day plan. Use the user’s budget in INR as a total target, and label any cost as an estimate.

Return only valid JSON with this shape: {"title":string,"summary":string,"dayPlan":boolean,"items":[{"name":string,"category":string,"time":string,"address":string,"estimatedCostINR":number|null,"reason":string,"qlooFit":string,"soloNotes":string,"gettingThere":string,"sourceUrls":[string]}],"budgetNote":string,"travelNote":string,"followUpPrompt":string}. items should contain 1-4 places, be appropriate to the selected mode, and favor Qloo candidates when possible. qlooFit must explain cultural fit from available Qloo evidence or say the recommendation was from Qloo's Bengaluru place graph when no per-place explanation is returned. Use source URLs from Google Search or Google Maps annotations when possible; no fabricated links. Use Google Maps to ground the ordering and give approximate travel times and transport guidance that match the user's selected mode. If Maps cannot confirm a duration, say to check the linked route instead of guessing.

User request: ${JSON.stringify(input)}

Qloo place candidates (use these as the source of cultural fit; do not add made-up Qloo data): ${JSON.stringify(places)}`;
}

async function qlooPlaces(input) {
  const currentPoint = input.startArea === 'My current location' && input.coordinates
    ? `POINT(${input.coordinates.longitude} ${input.coordinates.latitude})` : null;
  const body = {
    'filter.type': 'urn:entity:place',
    ...(currentPoint ? { 'filter.location': currentPoint, 'signal.location': currentPoint }
      : { 'filter.location.query': input.startArea || 'Bengaluru', 'signal.location.query': input.startArea || 'Bengaluru' }),
    take: 30, 'feature.explainability': true
  };
  const requestText = `${input.mood || ''} ${input.refinement || ''}`.toLowerCase();
  if (/hidden|lesser[- ]known|local gem|offbeat|under.?the.?radar/.test(requestText)) body['filter.popularity.max'] = 0.85;
  const interests = (input.favorites || []).map(name => name.trim()).filter(Boolean).slice(0, 8);
  if (interests.length) body['signal.interests.entities.query'] = interests.map(name => ({ name, resolve_to: 'both' }));
  const response = await fetch('https://api.qloo.com/v2/insights', {
    method: 'POST', headers: { 'X-Api-Key': process.env.QLOO_API_KEY, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body), signal: AbortSignal.timeout(20_000)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || payload.error || `Qloo returned ${response.status}.`);
  return payload;
}

async function geminiPlan(input, qlooPayload) {
  const model = process.env.GEMINI_MODEL || 'gemini-3.7-flash';
  const locationTool = input.coordinates
    ? { type: 'google_maps', latitude: input.coordinates.latitude, longitude: input.coordinates.longitude }
    : { type: 'google_maps' };
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
    body: JSON.stringify({ model, input: geminiPrompt(input, qlooPayload), tools: [{ type: 'google_search' }, locationTool] }),
    signal: AbortSignal.timeout(45_000)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error?.message || `Gemini returned ${response.status}.`);
  const outputStep = payload.steps?.find(step => step.type === 'model_output') || payload.steps?.at(-1);
  const blocks = Array.isArray(outputStep?.content) ? outputStep.content : [];
  const text = blocks.map(block => block.text || '').join('') || payload.output_text || '';
  const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  let plan;
  try { plan = JSON.parse(clean); } catch { throw new Error('Gemini returned a response that could not be read. Please try again.'); }
  const annotations = blocks.flatMap(block => block.annotations || []);
  const sources = annotations.map(annotation => ({ title: annotation.name || annotation.title || 'Source', platform: annotation.type === 'place_citation' ? 'Google Maps' : 'Web', url: annotation.url || annotation.uri })).filter(source => source.url);
  return { plan, sources, qlooCount: qlooPayload?.results?.entities?.length || qlooPayload?.entities?.length || 0, live: true };
}

export async function createPlan(input) {
  const missing = ['QLOO_API_KEY', 'GEMINI_API_KEY'].filter(key => !process.env[key]);
  if (missing.length) return { status: 503, body: { error: 'Live recommendations are not connected yet.', missingKeys: missing } };
  const qloo = await qlooPlaces(input);
  return { status: 200, body: await geminiPlan(input, qloo) };
}
