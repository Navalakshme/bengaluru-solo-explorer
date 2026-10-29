import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getBelongingMatches } from './lib/belonging.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
loadEnv(path.join(ROOT, '.env'));
const PORT = Number(process.env.PORT || 4173);
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml' };
const requestWindows = new Map();
const MATCH_LIMIT = 8;
const MATCH_WINDOW_MS = 60_000;

function loadEnv(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (match && !Object.hasOwn(process.env, match[1])) process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': MIME['.json'], 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function overMatchLimit(req) {
  const now = Date.now();
  const key = req.socket.remoteAddress || 'local';
  const recent = (requestWindows.get(key) || []).filter(timestamp => now - timestamp < MATCH_WINDOW_MS);
  if (recent.length >= MATCH_LIMIT) { requestWindows.set(key, recent); return true; }
  recent.push(now);
  requestWindows.set(key, recent);
  return false;
}

async function readBody(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 32_000) throw new Error('Request is too large.');
  }
  return JSON.parse(raw || '{}');
}

async function handleBelonging(req, res) {
  const input = await readBody(req);
  const result = await getBelongingMatches({
    interests: Array.isArray(input.interests) ? input.interests.slice(0, 3) : [],
    themes: Array.isArray(input.themes) ? input.themes : [],
    area: String(input.area || '').slice(0, 100),
    budget: String(input.budget || 'any'),
    joinStyle: String(input.joinStyle || 'any')
  });
  json(res, 200, result);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (url.pathname === '/api/health') return json(res, 200, { qloo: Boolean(process.env.QLOO_API_KEY) });
  if (url.pathname === '/api/belonging') {
    if (req.method !== 'POST') return json(res, 405, { error: 'Use POST to request community matches.' });
    if (overMatchLimit(req)) return json(res, 429, { error: 'A few matches have been requested in quick succession. Please try again in a minute.' });
    try { return await handleBelonging(req, res); }
    catch (error) {
      const status = [400, 429, 503].includes(error.status) ? error.status : 502;
      const message = status === 429 ? 'Qloo is receiving too many requests. Wait a moment and try again.' : error.message || 'Could not match activities.';
      return json(res, status, { error: message });
    }
  }
  if (url.pathname.startsWith('/api/')) return json(res, 404, { error: 'Not found.' });

  let requested;
  try { requested = decodeURIComponent(url.pathname); }
  catch { res.writeHead(400); return res.end('Bad request'); }
  const filename = requested === '/' ? 'index.html' : requested.slice(1);
  if (!['index.html', 'styles.css', 'app.js', 'bengaluru-city-scene.svg'].includes(filename)) { res.writeHead(404); return res.end('Not found'); }
  const file = path.join(ROOT, filename);
  try {
    const content = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(content);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
});

server.listen(PORT, () => console.log(`Common Ground running at http://localhost:${PORT}`));
