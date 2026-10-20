import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPlan } from './lib/planner.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
loadEnv(path.join(ROOT, '.env'));
const PORT = Number(process.env.PORT || 4173);
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml' };
const requestWindows = new Map();
const PLAN_LIMIT = 8;
const PLAN_WINDOW_MS = 60_000;

function loadEnv(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (match && !Object.hasOwn(process.env, match[1])) process.env[match[1]] = match[2].replace(/^(["'])(.*)\1$/, '$2');
  }
}

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': MIME['.json'], 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function overPlanLimit(req) {
  const now = Date.now();
  const key = req.socket.remoteAddress || 'local';
  const recent = (requestWindows.get(key) || []).filter(timestamp => now - timestamp < PLAN_WINDOW_MS);
  if (recent.length >= PLAN_LIMIT) { requestWindows.set(key, recent); return true; }
  recent.push(now);
  requestWindows.set(key, recent);
  return false;
}

async function readBody(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 64_000) throw new Error('Request is too large.');
  }
  return JSON.parse(raw || '{}');
}

async function handlePlan(req, res) {
  const input = await readBody(req);
  if (!input || typeof input !== 'object') return json(res, 400, { error: 'Please describe what you want to explore.' });
  const result = await createPlan(input);
  json(res, result.status, result.body);
}
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (url.pathname === '/api/health') return json(res, 200, { qloo: Boolean(process.env.QLOO_API_KEY), gemini: Boolean(process.env.GEMINI_API_KEY || process.env.GEMINI_FALLBACK_API_KEY), geminiBackup: Boolean(process.env.GEMINI_FALLBACK_API_KEY) });
  if (url.pathname === '/api/plan' && req.method === 'POST') {
    if (overPlanLimit(req)) return json(res, 429, { error: 'A few plans have been requested in quick succession. Please try again in a minute.' });
    try { return await handlePlan(req, res); }
    catch (error) { return json(res, 400, { error: error.message || 'Invalid request.' }); }
  }
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
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Not found');
  }
});

server.listen(PORT, () => console.log(`Bengaluru Solo Explorer running at http://localhost:${PORT}`));
