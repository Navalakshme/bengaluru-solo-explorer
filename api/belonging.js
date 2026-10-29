import { getBelongingMatches, getPlaceMatches } from '../lib/belonging.js';

const requestWindows = new Map();
const MATCH_LIMIT = 8;
const MATCH_WINDOW_MS = 60_000;

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'POST') return response.status(405).json({ error: 'Use POST to request recommendations.' });
  const ip = (request.headers['x-forwarded-for'] || 'unknown').split(',')[0].trim();
  const now = Date.now();
  const recent = (requestWindows.get(ip) || []).filter(timestamp => now - timestamp < MATCH_WINDOW_MS);
  if (recent.length >= MATCH_LIMIT) {
    requestWindows.set(ip, recent);
    return response.status(429).json({ error: 'A few matches have been requested in quick succession. Please try again in a minute.' });
  }
  recent.push(now);
  requestWindows.set(ip, recent);
  const input = request.body && typeof request.body === 'object' ? request.body : {};
  try {
    const normalizedInput = {
      interests: Array.isArray(input.interests) ? input.interests.slice(0, 3) : [],
      themes: Array.isArray(input.themes) ? input.themes : [],
      area: String(input.area || '').slice(0, 100),
      budget: String(input.budget || 'any'),
      joinStyle: String(input.joinStyle || 'any')
    };
    const result = input.mode === 'places'
      ? await getPlaceMatches(normalizedInput)
      : await getBelongingMatches(normalizedInput);
    return response.status(200).json(result);
  } catch (error) {
    console.error('[belonging] Qloo matching failed:', error?.message || error);
    const status = [400, 429, 503].includes(error?.status) ? error.status : 502;
    const message = status === 429
      ? 'Qloo is receiving too many requests. Wait a moment and try again.'
      : status === 503
        ? error.message
        : status === 400
          ? error.message
          : 'Qloo could not match these interests right now. Try again shortly.';
    return response.status(status).json({ error: message });
  }
}
