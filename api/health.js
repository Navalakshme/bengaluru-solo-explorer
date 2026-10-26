export default function handler(_request, response) {
  response.setHeader('Cache-Control', 'no-store');
  response.status(200).json({ qloo: Boolean(process.env.QLOO_API_KEY) });
}
