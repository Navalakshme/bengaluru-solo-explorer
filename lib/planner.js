import { qlooPlaces } from './qloo.js';

function entitiesFrom(payload) {
  const entities = payload?.results?.entities || payload?.entities || payload?.results || [];
  return Array.isArray(entities) ? entities : [];
}

function placeText(place) {
  const tags = Array.isArray(place.tags) ? place.tags.map(tag => tag?.name || '').join(' ') : '';
  return `${place.name || ''} ${place.type || ''} ${tags}`.toLowerCase();
}

function matchesMode(place, mode) {
  const text = placeText(place);
  if (mode === 'food') return /food|restaurant|cafe|café|coffee|bakery|dining|dosa|brunch|tea room|dessert/.test(text);
  if (mode === 'sights') return /landmark|historic|heritage|museum|gallery|architecture|palace|temple|church|monument|garden|park|lake/.test(text);
  if (mode === 'adventure') return /go.?kart|bowling|arcade|gaming|virtual reality|\bvr\b|escape room|climb|trampoline|paintball|skating|adventure|activity centre|activity center|karting/.test(text);
  return true;
}

function categoryFor(place) {
  const text = placeText(place);
  if (/food|restaurant|cafe|café|coffee|bakery|dining|dosa|brunch|tea room|dessert/.test(text)) return 'Food & coffee';
  if (/park|garden|botanical|lake|forest|nature|trail/.test(text)) return 'Garden & outdoors';
  if (/art|museum|gallery|theatre|theater|culture|cinema|photography/.test(text)) return 'Art & culture';
  if (/go.?kart|bowling|arcade|gaming|virtual reality|\bvr\b|escape room|climb|trampoline|paintball|skating|adventure|activity centre|activity center|karting/.test(text)) return 'Adventure & activity';
  if (/landmark|historic|heritage|monument|architecture|palace|temple|church|fort/.test(text)) return 'Landmark & architecture';
  return place.type || 'Bengaluru place';
}

function addressFor(place) {
  const address = place.properties?.address || place.properties?.formatted_address;
  if (typeof address === 'string') return address;
  const geo = place.properties?.geocode || {};
  return [geo.neighborhood, geo.locality, geo.city, 'Bengaluru'].filter(Boolean).join(', ');
}

function createItems(places, input) {
  const duration = Math.max(2, Number(input.durationHours) || 8);
  const maxStops = input.mode === 'day' ? Math.min(4, Math.max(2, Math.ceil(duration / 2))) : 10;
  return places.slice(0, maxStops).map((place, index) => {
    const tags = (Array.isArray(place.tags) ? place.tags : []).map(tag => tag?.name).filter(Boolean).slice(0, 4);
    const explainability = place.query?.explainability || place.explainability;
    const qlooFit = typeof explainability === 'string' && explainability.trim()
      ? explainability.trim()
      : tags.length ? `Qloo matched this place with ${tags.join(', ')}.` : 'Recommended from Qloo’s Bengaluru place graph using your mood and taste signals.';
    const priceLevel = place.properties?.price_level ?? place.price_level;
    return {
      name: place.name,
      category: categoryFor(place),
      time: input.mode === 'day' ? `Stop ${index + 1} · Explore` : `Match ${String(index + 1).padStart(2, '0')}`,
      address: addressFor(place),
      estimatedCostINR: null,
      reason: input.mood
        ? `A Qloo place match for “${String(input.mood).slice(0, 140)}”.`
        : 'A Bengaluru place selected from Qloo’s taste graph.',
      qlooFit,
      goodToKnow: priceLevel !== undefined ? `Qloo price level: ${priceLevel}. Check current prices and availability with the venue.` : 'Check current hours, prices, and availability with the venue.',
      gettingThere: 'Open the route in Maps to check current travel options.',
      affinity: place.affinity,
      tags
    };
  });
}

export async function createPlan(input) {
  if (!process.env.QLOO_API_KEY) {
    return { status: 503, body: { error: 'Add the Qloo API key in Vercel to get live Bengaluru matches.' } };
  }
  const request = { ...input, interpretation: {} };
  try {
    const qloo = await qlooPlaces(request);
    const allPlaces = entitiesFrom(qloo);
    const matched = allPlaces.filter(place => place?.name && matchesMode(place, input.mode || 'day'));
    const items = createItems(matched, input);
    const signals = request.qlooTasteSignals || [];
    const modeName = { day: 'day out', food: 'food and coffee', sights: 'places to see', adventure: 'adventure' }[input.mode] || 'Bengaluru outing';
    return {
      status: 200,
      body: {
        plan: {
          title: input.mode === 'day' ? 'Your Bengaluru day, shaped by Qloo' : `Your Qloo-matched ${modeName} picks`,
          summary: items.length
            ? `${items.length} Qloo place matches near ${input.startArea || 'Bengaluru'}, shaped by your chosen mood and taste cues${input.groupType ? ` for ${input.groupType}` : ''}.`
            : `Qloo did not return close ${modeName} matches for these signals. Try changing your interests, mode, or starting area.`,
          dayPlan: (input.mode || 'day') === 'day',
          items,
          budgetNote: 'Venue prices are not provided as estimates. Check current menus, tickets, and activity prices directly.',
          travelNote: `Your stated travel preference: ${input.transport || 'any option'}. Check live routes before setting out.`
        },
        sources: [],
        interpretation: { mood: input.mood || '' },
        qlooTasteSignals: signals,
        qlooCount: allPlaces.length,
        qlooMatchesUsed: items.length,
        live: true,
        qlooOnly: true
      }
    };
  } catch (error) {
    console.error('[planner] Qloo plan request failed:', error?.message || error);
    return { status: 502, body: { error: 'Qloo could not return matches right now. Please try again shortly.' } };
  }
}
