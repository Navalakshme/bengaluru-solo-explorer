export default function handler(_request, response) {
  response.setHeader('Cache-Control', 'no-store');
  response.status(200).json({ qloo: Boolean(process.env.QLOO_API_KEY), gemini: Boolean(process.env.GEMINI_API_KEY || process.env.GEMINI_FALLBACK_API_KEY), geminiBackup: Boolean(process.env.GEMINI_FALLBACK_API_KEY) });
}
