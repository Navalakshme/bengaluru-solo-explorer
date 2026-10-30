import { handleMcpRequest } from '../lib/mcp.js';

export default async function handler(request, response) {
  const ip = (request.headers['x-forwarded-for'] || 'unknown').split(',')[0].trim();
  const result = await handleMcpRequest({ method: request.method, headers: request.headers, body: request.body, ip });
  for (const [name, value] of Object.entries(result.headers)) response.setHeader(name, value);
  response.status(result.status);
  if (result.body === null) return response.end();
  return response.json(result.body);
}
