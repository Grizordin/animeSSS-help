import readline from 'node:readline';

const SERVER_INFO = { name: 'animesss-logs', version: '1.0.0' };
const API_URL = String(process.env.ANIMESSS_LOG_API_URL || '').replace(/\/+$/, '');
const READ_TOKEN = String(process.env.ANIMESSS_LOG_READ_TOKEN || '');

const tools = [
  {
    name: 'animesss_logs_health',
    description: 'Проверяет соединение с закрытым read-only API журналов AnimeSSS.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'animesss_recent_logs',
    description: 'Возвращает последние пачки логов AnimeSSS с фильтрами по модулю, нику и периоду.',
    inputSchema: {
      type: 'object',
      properties: {
        module: { type: 'string', enum: ['suite', 'autowatch', 'chat_stone', 'gacha', 'fatigue', 'quiz'] },
        nick: { type: 'string', maxLength: 120 },
        hours: { type: 'integer', minimum: 1, maximum: 168, default: 24 },
        limit: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
        before: { type: 'string', description: 'ISO-время для получения предыдущей страницы.' },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'animesss_incidents',
    description: 'Возвращает ошибки и расхождения, включая конфликты ответов викторины.',
    inputSchema: {
      type: 'object',
      properties: {
        nick: { type: 'string', maxLength: 120 },
        type: { type: 'string', maxLength: 80 },
        hours: { type: 'integer', minimum: 1, maximum: 168, default: 24 },
        limit: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'animesss_session',
    description: 'Возвращает полную хронологию одной сессии AnimeSSS.',
    inputSchema: {
      type: 'object',
      required: ['session_id'],
      properties: {
        session_id: { type: 'string', minLength: 1, maxLength: 160 },
        limit: { type: 'integer', minimum: 1, maximum: 500, default: 200 },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'animesss_log_stats',
    description: 'Возвращает количество пачек, событий, пользователей и инцидентов по модулям.',
    inputSchema: {
      type: 'object',
      properties: {
        hours: { type: 'integer', minimum: 1, maximum: 168, default: 24 },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
];

function writeMessage(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function success(id, result) {
  writeMessage({ jsonrpc: '2.0', id, result });
}

function failure(id, code, message, data) {
  writeMessage({ jsonrpc: '2.0', id, error: { code, message, ...(data === undefined ? {} : { data }) } });
}

function clampInteger(value, fallback, min, max) {
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
}

function appendParam(params, key, value) {
  if (value !== undefined && value !== null && String(value).trim() !== '') params.set(key, String(value));
}

async function apiRequest(path, args = {}) {
  if (!API_URL) throw new Error('ANIMESSS_LOG_API_URL не настроен');
  if (!READ_TOKEN) throw new Error('ANIMESSS_LOG_READ_TOKEN не настроен');
  const url = new URL(path, `${API_URL}/`);
  for (const [key, value] of Object.entries(args)) appendParam(url.searchParams, key, value);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${READ_TOKEN}`, Accept: 'application/json' },
      signal: controller.signal,
    });
    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch (error) { data = { ok: false, raw: text }; }
    if (!response.ok) throw new Error(`Worker HTTP ${response.status}: ${data?.error || text || 'unknown error'}`);
    return data;
  } finally {
    clearTimeout(timer);
  }
}

async function callTool(name, args = {}) {
  if (name === 'animesss_logs_health') return apiRequest('/admin/health');
  if (name === 'animesss_recent_logs') {
    return apiRequest('/admin/logs', {
      module: args.module,
      nick: args.nick,
      hours: clampInteger(args.hours, 24, 1, 168),
      limit: clampInteger(args.limit, 50, 1, 200),
      before: args.before,
    });
  }
  if (name === 'animesss_incidents') {
    return apiRequest('/admin/incidents', {
      nick: args.nick,
      type: args.type,
      hours: clampInteger(args.hours, 24, 1, 168),
      limit: clampInteger(args.limit, 50, 1, 200),
    });
  }
  if (name === 'animesss_session') {
    if (!String(args.session_id || '').trim()) throw new Error('session_id обязателен');
    return apiRequest('/admin/session', {
      session_id: args.session_id,
      limit: clampInteger(args.limit, 200, 1, 500),
    });
  }
  if (name === 'animesss_log_stats') {
    return apiRequest('/admin/stats', { hours: clampInteger(args.hours, 24, 1, 168) });
  }
  throw new Error(`Неизвестный инструмент: ${name}`);
}

async function handleMessage(message) {
  const { id, method, params = {} } = message || {};
  if (!method) return;
  if (method === 'initialize') {
    success(id, {
      protocolVersion: params.protocolVersion || '2025-03-26',
      capabilities: { tools: { listChanged: false } },
      serverInfo: SERVER_INFO,
      instructions: 'Только чтение журналов AnimeSSS. Не раскрывай токен. Для жалобы пользователя сначала найди его последние логи, затем загрузи полную сессию по session_id. Запись и удаление данных недоступны.',
    });
    return;
  }
  if (method === 'notifications/initialized' || method === 'notifications/cancelled') return;
  if (method === 'ping') { success(id, {}); return; }
  if (method === 'tools/list') { success(id, { tools }); return; }
  if (method === 'tools/call') {
    try {
      const data = await callTool(params.name, params.arguments || {});
      success(id, { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }], structuredContent: data });
    } catch (error) {
      success(id, {
        content: [{ type: 'text', text: error?.message || String(error) }],
        isError: true,
      });
    }
    return;
  }
  if (id !== undefined) failure(id, -32601, `Method not found: ${method}`);
}

const input = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
input.on('line', line => {
  const text = line.trim();
  if (!text) return;
  let message;
  try { message = JSON.parse(text); }
  catch (error) { failure(null, -32700, 'Parse error'); return; }
  Promise.resolve(handleMessage(message)).catch(error => failure(message?.id ?? null, -32603, 'Internal error', error?.message || String(error)));
});
