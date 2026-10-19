import { createPlan } from '../lib/planner.js';

const windows = new Map();
const LIMIT = 8;
const WINDOW_MS = 60_000;

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'POST') return response.status(405).json({ error: 'Use POST to request a plan.' });
  const ip = (request.headers['x-forwarded-for'] || 'unknown').split(',')[0].trim();
  const now = Date.now();
  const recent = (windows.get(ip) || []).filter(timestamp => now - timestamp < WINDOW_MS);
  if (recent.length >= LIMIT) return response.status(429).json({ error: 'A few plans have been requested in quick succession. Please try again in a minute.' });
  recent.push(now);
  windows.set(ip, recent);
  const input = typeof request.body === 'object' && request.body ? request.body : {};
  try {
    const result = await createPlan(input);
    return response.status(result.status).json(result.body);
  } catch (error) {
    return response.status(502).json({ error: error.message || 'Could not create a plan right now.' });
  }
}
