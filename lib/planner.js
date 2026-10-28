import { DISCOVERY_CATEGORIES, qlooPlanPlaces } from './qloo.js';

function placeText(place) {
  const tags = Array.isArray(place.tags) ? place.tags.map(tag => tag?.name || '').join(' ') : '';
  return `${place.name || ''} ${place.type || ''} ${tags}`.toLowerCase();
}

function priceLevel(place) {
  const value = Number(place.properties?.price_level ?? place.price_level);
  return Number.isInteger(value) && value >= 1 && value <= 4 ? value : null;
}

function maxPriceLevel(budget) {
  const amount = Number(budget);
  if (!Number.isFinite(amount) || amount <= 0) return 4;
  if (amount <= 500) return 1;
  if (amount <= 1000) return 2;
  if (amount <= 2000) return 3;
  return 4;
}

function candidateScore(place, input) {
  const cues = placeText(place);
  const level = priceLevel(place);
  const budgetTier = maxPriceLevel(input.budgetINR);
  const groupHints = {
    family: /family|kids|children|child friendly|good for kids/,
    friends: /groups|group friendly|social|friends/,
    'a group': /groups|group friendly|social/,
    'a date': /romantic|date night|intimate/,
    'just me': /quiet|cozy|casual|solo/
  };
  const groupPattern = groupHints[input.groupType];
  const affinity = Number(place.affinity);
  const asksForQuietWork = /\b(work|working|study|studying|laptop|focus|quiet|peace|peaceful|cozy|cosy)\b/i.test(input.mood || '');
  const quietWorkFit = asksForQuietWork
    ? (/quiet|work.?friendly|study.?friendly|laptop|wifi|wi-fi|workspace|comfortable seating|counter seating/.test(cues) ? 3 : 0)
      - (/dance floor|nightclub|live music|full bar|cocktails|lounge/.test(cues) ? 4 : 0)
    : 0;
  return (Number.isFinite(affinity) ? affinity : 0)
    + (level === null ? 0 : level <= budgetTier ? 1.5 : -3 * (level - budgetTier))
    + (groupPattern?.test(cues) ? 1 : 0)
    + quietWorkFit;
}

function coordinatesOf(place) {
  const geo = place.properties?.geocode || {};
  const latitude = Number(geo.latitude ?? geo.lat);
  const longitude = Number(geo.longitude ?? geo.lon ?? geo.lng);
  return Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : null;
}

function distanceKm(from, to) {
  const radians = degrees => (degrees * Math.PI) / 180;
  const dLat = radians(to.latitude - from.latitude);
  const dLon = radians(to.longitude - from.longitude);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function sequenceNearby(places, startCoordinates) {
  if (!startCoordinates || places.length < 2) return places;
  let current = { latitude: Number(startCoordinates.latitude), longitude: Number(startCoordinates.longitude) };
  const pending = places.map((place, index) => ({ place, index, point: coordinatesOf(place) }));
  if (!Number.isFinite(current.latitude) || !Number.isFinite(current.longitude)) return places;
  const ordered = [];
  while (pending.length) {
    let bestIndex = -1;
    let bestDistance = Infinity;
    for (let index = 0; index < pending.length; index += 1) {
      const point = pending[index].point;
      const distance = point ? distanceKm(current, point) : Infinity;
      if (distance < bestDistance) { bestIndex = index; bestDistance = distance; }
    }
    if (bestIndex < 0) {
      ordered.push(...pending.sort((a, b) => a.index - b.index).map(item => item.place));
      break;
    }
    const [next] = pending.splice(bestIndex, 1);
    ordered.push(next.place);
    current = next.point;
  }
  return ordered;
}

function pickDiversePlaces(places, input) {
  const ranked = places
    .filter(place => place?.name)
    .map((place, index) => ({ place, index, score: candidateScore(place, input) }))
    .sort((a, b) => b.score - a.score || a.index - b.index);
  const hours = Math.max(2, Number(input.durationHours) || 8);
  const limit = input.mode === 'day'
    ? Math.min(4, Math.max(1, Math.ceil(hours / 2)))
    : Math.min(8, Math.max(2, Math.ceil(hours / 1.5)));
  const chosen = [];
  // First pass covers different Qloo category searches so a full-day plan is not four near-duplicates.
  const categories = [...new Set(ranked.map(item => item.place._agentCategory).filter(Boolean))];
  for (const category of categories) {
    if (chosen.length >= limit) break;
    const match = ranked.find(item => item.place._agentCategory === category && !chosen.includes(item));
    if (match) chosen.push(match);
  }
  for (const item of ranked) {
    if (chosen.length >= limit) break;
    if (!chosen.includes(item)) chosen.push(item);
  }
  return sequenceNearby(chosen.map(item => item.place), input.coordinates);
}

function scheduleTime(index, count, durationHours) {
  const startMinutes = 9 * 60;
  const duration = Math.max(2, Number(durationHours) || 8) * 60;
  const offset = count <= 1 ? 0 : Math.round((duration * index) / count);
  const time = (startMinutes + offset) % (24 * 60);
  const hour = Math.floor(time / 60);
  const minute = time % 60;
  return `${String(hour % 12 || 12).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
}

function formatAddress(place) {
  const address = place.properties?.address || place.properties?.formatted_address;
  if (typeof address === 'string' && address.trim()) return address;
  const geo = place.properties?.geocode || {};
  return [place.catalog?.area || geo.neighborhood, geo.locality, geo.city || 'Bengaluru'].filter(Boolean).join(', ');
}

function mapToItems(places, input) {
  const categoryNames = {
    coffee: 'Coffee & cafés', 'south-indian': 'South Indian food', 'global-food': 'Beyond South Indian dining',
    bakeries: 'Bakery & dessert', gardens: 'Garden & green space', art: 'Art & culture',
    heritage: 'Architecture & heritage', music: 'Music & nightlife', books: 'Books & reading',
    outdoors: 'Adventure activity', wellness: 'Wellness', shopping: 'Shopping & local finds'
  };
  return places.map((place, index) => {
    const tags = (Array.isArray(place.tags) ? place.tags : []).map(tag => tag?.name).filter(Boolean).slice(0, 4);
    const explainability = place.query?.explainability || place.explainability;
    const price = priceLevel(place);
    const asksForQuietWork = /\b(work|working|study|studying|laptop|focus|quiet|peace|peaceful|cozy|cosy)\b/i.test(input.mood || '');
    const catalog = place.catalog || {};
    const priceNote = catalog.pricing
      ? `${catalog.pricing}. ${catalog.pricingNote || 'Confirm current prices with the venue.'}`
      : price === null
      ? `Price is not listed by Qloo. Check current prices and suitability for ${input.groupType || 'your group'} with the venue.`
      : `Qloo lists this at price tier ${price}/4; your preference maps to tier ${maxPriceLevel(input.budgetINR)}/4. Tiers are relative, so confirm current prices and group suitability with the venue.`;
    const workNote = asksForQuietWork
      ? 'Qloo does not verify Wi-Fi, laptop permission, quietness, or opening hours; check with the café.'
      : '';
    return {
      name: place.name,
      category: categoryNames[place._agentCategory] || place.type || 'Bengaluru place',
      time: input.mode === 'day' ? `Suggested ${scheduleTime(index, places.length, input.durationHours)} · Stop ${index + 1}` : `Pick ${String(index + 1).padStart(2, '0')}`,
      address: formatAddress(place),
      estimatedCostINR: null,
      reason: [catalog.description, input.mood ? `Qloo matched it to your “${String(input.mood).slice(0, 100)}” outing.` : 'Qloo matched it to your Bengaluru taste and location signals.'].filter(Boolean).join(' '),
      qlooFit: typeof explainability === 'string' && explainability.trim()
        ? explainability.trim()
        : tags.length ? `Qloo associates this place with ${tags.join(', ')}.` : 'Matched through Qloo’s place and taste graph.',
      goodToKnow: [catalog.mood && `Mood: ${catalog.mood}.`, catalog.ambience && `Ambience: ${catalog.ambience}.`, catalog.groupSize && `Group guide: ${catalog.groupSize}.`, priceNote, catalog.verification, workNote].filter(Boolean).join(' '),
      gettingThere: `Route preference: ${input.transport || 'any option'}. Open Maps for current route options.`,
      affinity: place.affinity,
      tags
    };
  });
}

export async function createPlan(input) {
  if (!process.env.QLOO_API_KEY) {
    return { status: 503, body: { error: 'Add the Qloo API key in Vercel to get live Bengaluru matches.' } };
  }
  try {
    const qloo = await qlooPlanPlaces(input);
    const candidates = qloo.results.entities;
    const places = pickDiversePlaces(candidates, input);
    const items = mapToItems(places, input);
    const group = input.groupType || 'your group';
    const budgetTier = maxPriceLevel(input.budgetINR);
    const signals = qloo.signals || [];
    const searchedCategories = qloo.categories.map(id => DISCOVERY_CATEGORIES.find(category => category.id === id)?.name || id);
    const safetyNote = /\b(?:safe|safety|secure|well[- ]lit)\b/i.test(input.mood || '')
      ? 'Safety is not verified by Qloo; check current venue and route information before going.'
      : '';
    const agentSteps = [
      `Read your mood, ${input.durationHours || 8} hours, ${input.transport || 'travel preference'}, budget, and group (${group}).`,
      `Asked Qloo for ${searchedCategories.join(', ')} near ${input.startArea || 'Bengaluru'}, using your taste signals${input.favorites?.length ? ' and favourites' : ''}.`,
      `Kept category-matching Qloo places, ranked Qloo taste and available quiet/work cues alongside price tier ${budgetTier}/4, and balanced the plan across place types.`,
      items.length
        ? `${qloo.rateLimited ? 'Qloo temporarily limited later category lookups, so this plan uses the Qloo matches available so far. ' : ''}Scheduled ${items.length} stops within your available time; use Maps to confirm the live route.`
        : qloo.rateLimited
          ? 'Qloo temporarily limited requests before returning matches. Wait a moment and try again.'
          : 'Qloo returned no close matches; adjust your mood, area, or budget and try again.'
    ];
    const planTitle = input.mode === 'day' ? 'Your Bengaluru day, shaped by Qloo' : `Your Qloo-matched ${input.mode || 'outing'} picks`;
    return {
      status: 200,
      body: {
        plan: {
          title: planTitle,
          summary: items.length
            ? `${items.length} Qloo place matches for ${group}, near ${input.startArea || 'Bengaluru'}, across the place types that fit this plan.${qloo.rateLimited ? ' Qloo limited later category lookups, so these are the matches available right now.' : ''}`
            : `Qloo did not return close ${input.mode || 'outing'} matches for these signals. ${qloo.rateLimited ? 'Wait a moment and try again.' : 'Try changing your interests, area, or budget.'}`,
          dayPlan: (input.mode || 'day') === 'day',
          items,
          budgetNote: [`Your ₹${Number(input.budgetINR || 0).toLocaleString('en-IN')} per-person budget was mapped to an approximate Qloo price tier (${budgetTier}/4); Qloo price tiers are relative, not guaranteed INR costs. Confirm prices with each venue.`, safetyNote].filter(Boolean).join(' '),
      travelNote: `${input.coordinates ? 'Stops with mapped coordinates are ordered by distance from your starting point; other stops retain Qloo match order.' : 'Stops follow Qloo match order because no current coordinates were provided.'} ${input.transport === 'public' ? 'Maps will show current public transport options.' : 'Open Maps to check current routes and travel times.'}`
        },
        sources: [],
        interpretation: { mood: input.mood || '' },
        qlooTasteSignals: signals,
        qlooCount: candidates.length,
        qlooMatchesUsed: items.length,
        agentSteps,
        broadenedCategories: qloo.broadenedCategories,
        live: true,
        qlooOnly: true
      }
    };
  } catch (error) {
    console.error('[planner] Qloo agent request failed:', error?.message || error);
    const limited = error?.status === 429;
    return {
      status: limited ? 429 : 502,
      body: { error: limited
        ? 'Qloo is receiving too many requests right now. Wait a moment, then try again.'
        : 'Qloo could not return matches right now. Please try again shortly.' }
    };
  }
}
