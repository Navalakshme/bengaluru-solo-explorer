import { getBelongingMatches, getPlaceMatches } from './belonging.js';

const VERSION = '2026-07-28';
const LEGACY_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];
const SERVER_INFO = { name: 'Common Ground Bengaluru', version: '1.0.0' };
const requestWindows = new Map();
const TOOL_CALL_LIMIT = 8;
const TOOL_CALL_WINDOW_MS = 60_000;
const TOOLS = [
  {
    name: 'find_bengaluru_food_places',
    title: 'Find Bengaluru food places',
    description: 'Search Qloo for Bengaluru restaurants and food venues matching a cuisine, dish, or food preference. Returns only venue entities with relevant food categories and matching taste tags; it does not substitute a local directory when Qloo has no match.',
    inputSchema: { type: 'object', properties: { search_term: { type: 'string', minLength: 2, description: 'Cuisine, dish, or food preference, such as Korean food, biryani, ramen, or vegan.' }, area: { type: 'string', description: 'Optional Bengaluru neighborhood.' }, max_price_level: { type: 'integer', minimum: 1, maximum: 4, description: 'Optional maximum Qloo price level.' } }, required: ['search_term'], additionalProperties: false }
  },
  {
    name: 'connect_taste_to_activities',
    title: 'Connect cultural taste to Bengaluru activities',
    description: 'Use Qloo cultural signals to rank source-linked Bengaluru groups and activities. Returns only checked listings with a direct Qloo taste bridge and matching selected filters; returns no recommendations if no direct bridge exists.',
    inputSchema: { type: 'object', properties: { interests: { type: 'array', maxItems: 3, items: { type: 'string' }, description: 'Up to three cultural interests such as a book, film, artist, or cause.' }, themes: { type: 'array', items: { type: 'string', enum: ['reading', 'creative', 'volunteer', 'nature', 'learn', 'music', 'any'] } }, area: { type: 'string' }, budget: { type: 'string', enum: ['any', 'free', '500', '2000'] }, join_style: { type: 'string', enum: ['any', 'beginner', 'drop-in', 'ongoing'] } }, additionalProperties: false }
  }
];

function json(status, payload, extraHeaders = {}) {
  return { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extraHeaders }, body: payload };
}

function protocolError(code, message, id = null) {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

function modern(request) {
  return request?.params?._meta?.['io.modelcontextprotocol/protocolVersion'] === VERSION
    || request?.method === 'server/discover';
}

function complete(result, cache = true) {
  return { resultType: 'complete', ...result, ...(cache ? { ttlMs: 60_000, cacheScope: 'public' } : {}) };
}

async function callTool(name, args) {
  if (name === 'find_bengaluru_food_places') {
    const search = String(args.search_term || '').trim().slice(0, 160);
    if (!search) throw new Error('Enter a cuisine, dish, or food preference.');
    return getPlaceMatches({ interests: [search], area: String(args.area || '').slice(0, 100), budget: args.max_price_level ?? 'any' });
  }
  if (name === 'connect_taste_to_activities') {
    const interests = Array.isArray(args.interests) ? args.interests.slice(0, 3).map(value => String(value).slice(0, 100)) : [];
    const themes = Array.isArray(args.themes) ? args.themes.slice(0, 7) : [];
    return getBelongingMatches({ interests, themes, area: String(args.area || '').slice(0, 100), budget: args.budget || 'any', joinStyle: args.join_style || 'any' });
  }
  throw new Error(`Unknown tool: ${name}`);
}

export async function handleMcpRequest({ method = 'POST', headers = {}, body = {}, ip = 'unknown' } = {}) {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, MCP-Protocol-Version, Mcp-Method, Mcp-Name' };
  if (method === 'OPTIONS') return { status: 204, headers: cors, body: null };
  if (method !== 'POST') return json(405, { error: 'Use POST for MCP requests.' }, { ...cors, Allow: 'POST, OPTIONS' });
  if (!body || typeof body !== 'object' || Array.isArray(body)) return json(400, { error: 'Expected a JSON-RPC request.' }, cors);
  const { id, method: rpcMethod, params = {} } = body;
  const isNotification = id === undefined && rpcMethod?.startsWith('notifications/');
  if (body.jsonrpc !== '2.0' || typeof rpcMethod !== 'string') return json(400, protocolError(-32600, 'Invalid JSON-RPC request.', id), cors);
  if (isNotification) return { status: 202, headers: cors, body: null };

  const isModern = modern(body);
  const requestedVersion = params.protocolVersion || params._meta?.['io.modelcontextprotocol/protocolVersion'];
  if (requestedVersion && requestedVersion !== VERSION && !LEGACY_VERSIONS.includes(requestedVersion)) {
    return json(200, protocolError(-32600, `Unsupported protocol version. Supported version: ${VERSION}.`, id), cors);
  }
  const reqHeaders = Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), String(value)]));
  if (isModern && (reqHeaders['mcp-protocol-version'] !== VERSION || reqHeaders['mcp-method'] !== rpcMethod || rpcMethod === 'tools/call' && !reqHeaders['mcp-name'])) {
    return json(200, protocolError(-32600, 'Modern MCP requests must include matching MCP-Protocol-Version and Mcp-Method headers; tools/call also requires Mcp-Name.', id), cors);
  }

  if (rpcMethod === 'ping') return json(200, { jsonrpc: '2.0', id, result: isModern ? complete({}) : {} }, cors);
  if (rpcMethod === 'initialize') {
    const version = LEGACY_VERSIONS.includes(params.protocolVersion) ? params.protocolVersion : VERSION;
    const result = { protocolVersion: version, capabilities: { tools: { listChanged: false } }, serverInfo: SERVER_INFO, instructions: 'Use Qloo-backed tools for cultural place discovery and taste-to-activity matching in Bengaluru. No fallback recommendations are presented as Qloo matches.' };
    return json(200, { jsonrpc: '2.0', id, result }, cors);
  }
  if (rpcMethod === 'server/discover') {
    return json(200, { jsonrpc: '2.0', id, result: complete({ supportedVersions: [VERSION], capabilities: { tools: { listChanged: false } }, _meta: { 'io.modelcontextprotocol/serverInfo': SERVER_INFO }, instructions: 'Use Qloo-backed tools for cultural place discovery and taste-to-activity matching in Bengaluru.' }) }, cors);
  }
  if (rpcMethod === 'tools/list') {
    const result = isModern ? complete({ tools: TOOLS }) : { tools: TOOLS };
    return json(200, { jsonrpc: '2.0', id, result }, cors);
  }
  if (rpcMethod === 'tools/call') {
    try {
      const now = Date.now();
      const recent = (requestWindows.get(ip) || []).filter(timestamp => now - timestamp < TOOL_CALL_WINDOW_MS);
      if (recent.length >= TOOL_CALL_LIMIT) throw Object.assign(new Error('Qloo is receiving too many requests. Wait a moment and try again.'), { status: 429 });
      recent.push(now);
      requestWindows.set(ip, recent);
      const data = await callTool(params.name, params.arguments || {});
      const result = { content: [{ type: 'text', text: JSON.stringify(data) }], structuredContent: data, isError: false };
      return json(200, { jsonrpc: '2.0', id, result: isModern ? complete(result, false) : result }, cors);
    } catch (error) {
      const data = { error: error?.status === 429 ? 'Qloo is receiving too many requests. Wait a moment and try again.' : error?.status === 503 ? error.message : error?.message || 'Qloo could not complete the match.' };
      const result = { content: [{ type: 'text', text: JSON.stringify(data) }], structuredContent: data, isError: true };
      return json(200, { jsonrpc: '2.0', id, result: isModern ? complete(result, false) : result }, cors);
    }
  }
  return json(200, protocolError(-32601, `Method not found: ${rpcMethod}`, id), cors);
}
