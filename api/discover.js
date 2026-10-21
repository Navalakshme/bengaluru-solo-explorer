import { DISCOVERY_CATEGORIES, qlooDiscoverPlaces } from '../lib/qloo.js';
import { curateDiscoveryPlaces } from '../lib/planner.js';

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'GET') return response.status(405).json({ error: 'Use GET to browse Bengaluru places.' });
  if (request.query?.catalog === '1') return response.status(200).json({ categories: DISCOVERY_CATEGORIES });
  if (!process.env.QLOO_API_KEY) return response.status(503).json({ error: 'Add the Qloo API key in Vercel to browse live place matches.' });

  try {
    const result = await qlooDiscoverPlaces({
      categoryId: String(request.query?.category || 'all'),
      search: String(request.query?.search || ''),
      startArea: String(request.query?.area || 'Bengaluru').slice(0, 100),
      favorites: String(request.query?.favorites || '').split(',').map(value => value.trim()).filter(Boolean).slice(0, 5)
    });
    try {
      const curated = await curateDiscoveryPlaces({
        category: result.category,
        search: result.search,
        area: String(request.query?.area || 'Bengaluru').slice(0, 100),
        signals: result.signals,
        places: result.places
      });
      return response.status(200).json({ ...result, ...curated });
    } catch (error) {
      // A Gemini quota or transient error must not turn a successful Qloo browse into a failed page.
      console.error('[discovery] Gemini curation unavailable:', error?.message || error);
      return response.status(200).json({
        ...result,
        geminiCurated: false,
        curationStatus: 'Qloo matches are shown; Gemini could not refine them right now.'
      });
    }
  } catch (error) {
    console.error('[discovery] Qloo browse request failed:', error?.message || error);
    return response.status(502).json({ error: 'Qloo could not return place matches right now. Please try again shortly.' });
  }
}
