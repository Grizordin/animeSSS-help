const ALLOWED_ORIGINS = new Set([
  'https://animesss.tv',
  'https://animesss.com',
]);

const MAX_TEXT = 1800;
const MAX_FILE_CHARS = 900000;
const ALLOWED_TYPES = new Set([
  'access_check',
  'unknown_push',
  'quiz_question',
  'labyrinth_fatigue_log',
  'telemetry_batch',
]);

const TELEMETRY_MODULES = new Set(['suite', 'autowatch', 'chat_stone', 'gacha', 'fatigue', 'quiz']);
const TELEMETRY_MAX_EVENTS = 10;
const TELEMETRY_RETENTION_SECONDS = 7 * 24 * 60 * 60;

export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);

      if (request.method === 'OPTIONS') {
        return corsResponse(request, null, 204);
      }

      if (request.method === 'GET' && url.pathname.startsWith('/admin/')) {
        return handleAdminRead(request, env, url);
      }

      if (request.method === 'GET') {
        return corsResponse(request, {
          ok: true,
          service: 'animesss-report-proxy',
          routes: ['/report'],
        });
      }

      if (request.method !== 'POST' || url.pathname !== '/report') {
        return corsResponse(request, { ok: false, error: 'not_found' }, 404);
      }

      const contentType = request.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        return corsResponse(request, { ok: false, error: 'json_required' }, 400);
      }

      const body = await request.json().catch(() => null);
      if (!body || typeof body !== 'object') {
        return corsResponse(request, { ok: false, error: 'bad_json' }, 400);
      }

      const type = String(body.type || '').trim();
      const payload = body.payload && typeof body.payload === 'object' ? body.payload : {};

      if (!ALLOWED_TYPES.has(type)) {
        return corsResponse(request, { ok: false, error: 'bad_type' }, 400);
      }

      const meta = buildMeta(request);
      const safePayload = sanitizePayload(payload);

      if (type === 'telemetry_batch') {
        if (!env.TELEMETRY_DB) {
          return corsResponse(request, { ok: false, error: 'telemetry_not_configured' }, 503);
        }
        const stored = await storeTelemetryBatch(env, payload, meta);
        if (stored.quizIncident) {
          ctx.waitUntil(sendTelegramQuizIncident(env, stored.quizIncident, meta));
        }
        return corsResponse(request, { ok: true, stored: true, duplicate: stored.duplicate });
      }

      if (type === 'access_check') {
        await sendDiscordAccess(env, safePayload, meta);
      }

      if (type === 'unknown_push') {
        await sendDiscordUnknownPush(env, safePayload, meta);
      }

      if (type === 'quiz_question') {
        await sendTelegramQuiz(env, safePayload, meta);
      }

      if (type === 'labyrinth_fatigue_log') {
        await sendDiscordLabyrinthFatigueLog(env, payload, safePayload, meta);
      }

      return corsResponse(request, { ok: true });
    } catch (error) {
      return corsResponse(request, {
        ok: false,
        error: 'internal_error',
      }, 500);
    }
  },

  async scheduled(_controller, env, ctx) {
    if (!env.TELEMETRY_DB) return;
    ctx.waitUntil(deleteExpiredTelemetry(env.TELEMETRY_DB));
  },
};

async function handleAdminRead(request, env, url) {
  if (!env.TELEMETRY_DB) return adminResponse({ ok: false, error: 'telemetry_not_configured' }, 503);
  if (!isAdminAuthorized(request, env)) return adminResponse({ ok: false, error: 'unauthorized' }, 401);

  if (url.pathname === '/admin/health') {
    const row = await env.TELEMETRY_DB.prepare('SELECT COUNT(*) AS batch_count FROM telemetry_batches').first();
    return adminResponse({ ok: true, database: 'connected', batchCount: Number(row?.batch_count || 0) });
  }

  if (url.pathname === '/admin/logs') return readTelemetryLogs(env.TELEMETRY_DB, url.searchParams);
  if (url.pathname === '/admin/incidents') return readTelemetryIncidents(env.TELEMETRY_DB, url.searchParams);
  if (url.pathname === '/admin/session') return readTelemetrySession(env.TELEMETRY_DB, url.searchParams);
  if (url.pathname === '/admin/stats') return readTelemetryStats(env.TELEMETRY_DB, url.searchParams);
  return adminResponse({ ok: false, error: 'admin_route_not_found' }, 404);
}

function isAdminAuthorized(request, env) {
  const expected = String(env.LOG_READ_TOKEN || '');
  const header = String(request.headers.get('Authorization') || '');
  const provided = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!expected || expected.length !== provided.length) return false;
  let mismatch = 0;
  for (let index = 0; index < expected.length; index += 1) {
    mismatch |= expected.charCodeAt(index) ^ provided.charCodeAt(index);
  }
  return mismatch === 0;
}

function adminResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function readLimit(params, fallback = 50, maximum = 200) {
  const value = Number.parseInt(params.get('limit') || '', 10);
  return Number.isFinite(value) ? Math.max(1, Math.min(maximum, value)) : fallback;
}

function readHours(params, fallback = 24) {
  const value = Number.parseInt(params.get('hours') || '', 10);
  return Number.isFinite(value) ? Math.max(1, Math.min(168, value)) : fallback;
}

function readSinceIso(params) {
  return new Date(Date.now() - readHours(params) * 60 * 60 * 1000).toISOString();
}

function parseJsonColumn(value, fallback) {
  try { return JSON.parse(value); } catch (error) { return fallback; }
}

async function readTelemetryLogs(db, params) {
  const module = String(params.get('module') || '').trim();
  const nick = String(params.get('nick') || '').trim();
  const before = String(params.get('before') || '').trim();
  const limitValue = readLimit(params);
  const conditions = ['received_at >= ?'];
  const values = [readSinceIso(params)];
  if (module) { conditions.push('module = ?'); values.push(module); }
  if (nick) { conditions.push('nick = ? COLLATE NOCASE'); values.push(nick); }
  if (before) { conditions.push('received_at < ?'); values.push(before); }
  values.push(limitValue);

  const query = `
    SELECT batch_id, received_at, started_at, finished_at, nick, install_id,
      session_id, module, reason, event_count, script_version, host, path,
      country, events_json
    FROM telemetry_batches
    WHERE ${conditions.join(' AND ')}
    ORDER BY received_at DESC
    LIMIT ?
  `;
  const result = await db.prepare(query).bind(...values).all();
  const rows = (result.results || []).map(row => ({
    ...row,
    events: parseJsonColumn(row.events_json, []),
    events_json: undefined,
  }));
  return adminResponse({ ok: true, count: rows.length, rows });
}

async function readTelemetryIncidents(db, params) {
  const nick = String(params.get('nick') || '').trim();
  const incidentType = String(params.get('type') || '').trim();
  const limitValue = readLimit(params);
  const conditions = ['received_at >= ?'];
  const values = [readSinceIso(params)];
  if (nick) { conditions.push('nick = ? COLLATE NOCASE'); values.push(nick); }
  if (incidentType) { conditions.push('incident_type = ?'); values.push(incidentType); }
  values.push(limitValue);

  const result = await db.prepare(`
    SELECT incident_key, batch_id, received_at, module, incident_type, nick, details_json
    FROM telemetry_incidents
    WHERE ${conditions.join(' AND ')}
    ORDER BY received_at DESC
    LIMIT ?
  `).bind(...values).all();
  const rows = (result.results || []).map(row => ({
    ...row,
    details: parseJsonColumn(row.details_json, {}),
    details_json: undefined,
  }));
  return adminResponse({ ok: true, count: rows.length, rows });
}

async function readTelemetrySession(db, params) {
  const sessionId = String(params.get('session_id') || '').trim();
  if (!sessionId) return adminResponse({ ok: false, error: 'session_id_required' }, 400);
  const limitValue = readLimit(params, 100, 500);
  const result = await db.prepare(`
    SELECT batch_id, received_at, started_at, finished_at, nick, install_id,
      session_id, module, reason, event_count, script_version, host, path,
      country, events_json
    FROM telemetry_batches
    WHERE session_id = ?
    ORDER BY started_at ASC
    LIMIT ?
  `).bind(sessionId, limitValue).all();
  const rows = (result.results || []).map(row => ({
    ...row,
    events: parseJsonColumn(row.events_json, []),
    events_json: undefined,
  }));
  return adminResponse({ ok: true, count: rows.length, rows });
}

async function readTelemetryStats(db, params) {
  const since = readSinceIso(params);
  const [modules, incidents] = await Promise.all([
    db.prepare(`
      SELECT module, COUNT(*) AS batch_count, COALESCE(SUM(event_count), 0) AS event_count,
        COUNT(DISTINCT nick) AS user_count
      FROM telemetry_batches
      WHERE received_at >= ?
      GROUP BY module
      ORDER BY event_count DESC
    `).bind(since).all(),
    db.prepare(`
      SELECT incident_type, COUNT(*) AS incident_count
      FROM telemetry_incidents
      WHERE received_at >= ?
      GROUP BY incident_type
      ORDER BY incident_count DESC
    `).bind(since).all(),
  ]);
  return adminResponse({
    ok: true,
    since,
    modules: modules.results || [],
    incidents: incidents.results || [],
  });
}

async function storeTelemetryBatch(env, payload, meta) {
  const batchId = limit(String(payload.batchId || '').trim(), 160);
  const module = limit(String(payload.module || '').trim(), 40);
  const events = Array.isArray(payload.events) ? payload.events.slice(0, TELEMETRY_MAX_EVENTS) : [];
  if (!batchId || !TELEMETRY_MODULES.has(module) || !events.length) {
    throw new Error('invalid_telemetry_batch');
  }

  const safeEvents = events.map(event => sanitizeTelemetryValue(event));
  const eventsJson = JSON.stringify(safeEvents);
  if (eventsJson.length > 500000) throw new Error('telemetry_batch_too_large');
  const quizIncident = module === 'quiz' ? findQuizIncident(safeEvents, payload) : null;
  const result = await env.TELEMETRY_DB.prepare(`
    INSERT OR IGNORE INTO telemetry_batches (
      batch_id, received_at, started_at, finished_at, nick, install_id,
      session_id, module, reason, event_count, script_version, host,
      path, country, events_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    batchId,
    meta.time,
    limit(payload.startedAt || meta.time, 40),
    limit(payload.finishedAt || meta.time, 40),
    limit(payload.nick || 'unknown', 120),
    limit(payload.installId || '', 160),
    limit(payload.sessionId || '', 160),
    module,
    limit(payload.reason || '', 40),
    safeEvents.length,
    limit(payload.version || '', 40),
    limit(payload.host || '', 120),
    limit(payload.path || '', 500),
    limit(meta.country, 12),
    eventsJson
  ).run();

  const duplicate = !result.meta?.changes;
  const shouldNotify = !duplicate && quizIncident
    ? await registerQuizIncident(env.TELEMETRY_DB, quizIncident, batchId, meta.time)
    : false;
  return { duplicate, quizIncident: shouldNotify ? quizIncident : null };
}

function sanitizeTelemetryValue(value, key = '', depth = 0) {
  if (value == null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (/(?:user_?hash|dle_?login_?hash|cookie|authorization|token|password|secret)/i.test(key)) return '[redacted]';
  if (typeof value === 'string') {
    return limit(value
      .replace(/([?&](?:user_hash|dle_login_hash|token|auth|password)=)[^&#\s]*/gi, '$1[redacted]')
      .replace(/("(?:user_hash|dle_login_hash|token|authorization|password)"\s*:\s*")[^"]*/gi, '$1[redacted]'), 30000);
  }
  if (typeof value !== 'object' || depth >= 6) return limit(String(value), 1000);
  if (Array.isArray(value)) return value.slice(0, 250).map(item => sanitizeTelemetryValue(item, '', depth + 1));
  const result = {};
  for (const [childKey, childValue] of Object.entries(value).slice(0, 100)) {
    result[childKey] = sanitizeTelemetryValue(childValue, childKey, depth + 1);
  }
  return result;
}

function findQuizIncident(events, payload) {
  const incident = [...events].reverse().find(event =>
    ['quiz_answer_mismatch', 'quiz_result_unknown', 'quiz_expected_answer_rejected'].includes(event?.event)
  );
  if (!incident) return null;
  return {
    ...incident.data,
    incidentType: incident.event,
    nick: payload.nick,
    version: payload.version,
    path: payload.path,
  };
}

async function registerQuizIncident(db, incident, batchId, receivedAt) {
  const fingerprintSource = [
    incident.incidentType,
    incident.questionHash || incident.question,
    incident.expectedAnswer,
    incident.selectedAnswer,
    incident.result,
  ].join('|');
  const incidentKey = simpleHash(fingerprintSource);
  const result = await db.prepare(`
    INSERT OR IGNORE INTO telemetry_incidents (
      incident_key, batch_id, received_at, module, incident_type, nick, details_json
    ) VALUES (?, ?, ?, 'quiz', ?, ?, ?)
  `).bind(
    incidentKey,
    batchId,
    receivedAt,
    limit(incident.incidentType || 'quiz_incident', 80),
    limit(incident.nick || 'unknown', 120),
    JSON.stringify(sanitizeTelemetryValue(incident))
  ).run();
  return Number(result.meta?.changes || 0) > 0;
}

function simpleHash(value) {
  let hash = 2166136261;
  for (const char of String(value || '')) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

async function deleteExpiredTelemetry(db) {
  const cutoff = new Date(Date.now() - TELEMETRY_RETENTION_SECONDS * 1000).toISOString();
  for (let i = 0; i < 10; i += 1) {
    const result = await db.prepare(`
      DELETE FROM telemetry_batches
      WHERE batch_id IN (
        SELECT batch_id FROM telemetry_batches
        WHERE received_at < ?
        ORDER BY received_at
        LIMIT 1000
      )
    `).bind(cutoff).run();
    if (Number(result.meta?.changes || 0) < 1000) break;
  }
  await db.prepare('DELETE FROM telemetry_incidents WHERE received_at < ?').bind(cutoff).run();
}

function corsResponse(request, data, status = 200) {
  const origin = request.headers.get('Origin') || '';
  const allowOrigin = ALLOWED_ORIGINS.has(origin) ? origin : '*';

  return new Response(data === null ? null : JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': allowOrigin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
}

function buildMeta(request) {
  return {
    ip: request.headers.get('CF-Connecting-IP') || 'unknown',
    country: request.cf?.country || 'unknown',
    userAgent: limit(cleanMentions(request.headers.get('User-Agent') || 'unknown'), 300),
    time: new Date().toISOString(),
  };
}

function sanitizePayload(payload) {
  const out = {};
  for (const [key, value] of Object.entries(payload)) {
    if (value == null) continue;

    if (Array.isArray(value)) {
      out[key] = value.map(v => limit(cleanMentions(String(v)), 300)).slice(0, 12);
      continue;
    }

    if (typeof value === 'object') {
      out[key] = limit(cleanMentions(JSON.stringify(value)), MAX_TEXT);
      continue;
    }

    out[key] = limit(cleanMentions(String(value)), MAX_TEXT);
  }
  return out;
}

function cleanMentions(text) {
  return String(text || '')
    .replace(/@everyone/gi, '@\u200beveryone')
    .replace(/@here/gi, '@\u200bhere')
    .replace(/<@!?(\d+)>/g, '<@\u200b$1>')
    .replace(/<@&(\d+)>/g, '<@&\u200b$1>');
}

function limit(text, max) {
  const s = String(text || '');
  return s.length > max ? s.slice(0, max - 1) + '...' : s;
}

function field(name, value, inline = true) {
  return {
    name,
    value: limit(String(value || 'unknown'), 1000),
    inline,
  };
}

async function sendDiscordAccess(env, payload, meta) {
  if (!env.DISCORD_WEBHOOK_URL) return;

  const allowed = /разреш|allowed|ok/i.test(payload.status || '');
  const embed = {
    title: allowed ? 'Доступ к скрипту' : 'Блокировка скрипта',
    color: allowed ? 0x22c55e : 0xef4444,
    fields: [
      field('Статус', payload.status),
      field('Ник', payload.nick),
      field('Клуб', payload.clubId),
      field('Сайт', payload.host || payload.site),
      field('Версия', payload.version),
      field('IP', meta.ip),
      field('Страна', meta.country),
      field('User-Agent', meta.userAgent, false),
    ],
    timestamp: meta.time,
  };

  await sendDiscord(env.DISCORD_WEBHOOK_URL, {
    username: 'Suite Access',
    embeds: [embed],
  });
}

async function sendDiscordUnknownPush(env, payload, meta) {
  if (!env.DISCORD_WEBHOOK_URL) return;

  const embed = {
    title: 'Неизвестное уведомление',
    description: '```' + limit(payload.text || 'empty', 1500) + '```',
    color: 0x6366f1,
    fields: [
      field('Ник', payload.nick),
      field('Страница', payload.path || payload.url || 'unknown', false),
      field('IP', meta.ip),
      field('Страна', meta.country),
      field('User-Agent', meta.userAgent, false),
    ],
    timestamp: meta.time,
  };

  await sendDiscord(env.DISCORD_WEBHOOK_URL, {
    username: 'Push Collector',
    embeds: [embed],
  });
}

async function sendDiscordLabyrinthFatigueLog(env, rawPayload, payload, meta) {
  if (!env.DISCORD_WEBHOOK_URL) return;

  const fileName = normalizeFileName(rawPayload.fileName || 'animesss-labyrinth-fatigue.json');
  const fileContent = limit(cleanMentions(String(rawPayload.fileContent || '{}')), MAX_FILE_CHARS);
  const nick = payload.nick || 'unknown';
  const logCount = payload.logCount || 'unknown';

  const embed = {
    title: 'Labyrinth fatigue log',
    color: 0x38bdf8,
    fields: [
      field('Nick', nick),
      field('Log entries', logCount),
      field('Page', payload.path || 'unknown', false),
      field('Version', payload.version),
      field('IP', meta.ip),
      field('Country', meta.country),
      field('User-Agent', meta.userAgent, false),
    ],
    timestamp: meta.time,
  };

  await sendDiscordFile(env.DISCORD_WEBHOOK_URL, {
    username: 'Labyrinth Logs',
    embeds: [embed],
  }, fileName, fileContent);
}

async function sendDiscord(webhookUrl, body) {
  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function sendDiscordFile(webhookUrl, payloadJson, fileName, fileContent) {
  const form = new FormData();
  form.append('payload_json', JSON.stringify(payloadJson));
  form.append('files[0]', new Blob([fileContent], { type: 'application/json;charset=utf-8' }), fileName);

  await fetch(webhookUrl, {
    method: 'POST',
    body: form,
  });
}

async function sendTelegramQuiz(env, payload, meta) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_IDS) return;

  const chatIds = String(env.TELEGRAM_CHAT_IDS)
    .split(',')
    .map(x => x.trim())
    .filter(Boolean);

  if (!chatIds.length) return;

  const options = Array.isArray(payload.options)
    ? payload.options.map((o, i) => `${i + 1}. ${escapeHtml(o)}`).join('\n')
    : '';

  let text =
    `${payload.quizType === 'FUZZY' ? '<b>NOT EXACT</b>' : '<b>NEW</b>'}\n\n` +
    `<b>Ник:</b> ${escapeHtml(payload.nick || 'unknown')}\n\n` +
    `<b>Question:</b>\n${escapeHtml(payload.question || 'unknown')}\n\n` +
    `<b>Options:</b>\n${options || 'unknown'}\n\n`;

  if (payload.possibleAnswer) {
    text += `<b>Possible answer:</b>\n${escapeHtml(payload.possibleAnswer)}\n\n`;
  }

  text +=
    `<b>IP:</b> ${escapeHtml(meta.ip)}\n` +
    `<b>Country:</b> ${escapeHtml(meta.country)}\n` +
    `<b>Time:</b> ${escapeHtml(meta.time)}`;

  text = limit(text, 3900);

  await Promise.all(chatIds.map(chatId => {
    return fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
  }));
}

function normalizeFileName(value) {
  const name = String(value || 'animesss-labyrinth-fatigue.json')
    .replace(/[\\/:*?"<>|]/g, '_')
    .slice(0, 120);
  return name.endsWith('.json') ? name : `${name}.json`;
}

async function sendTelegramQuizIncident(env, payload, meta) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_IDS) return;
  const chatIds = String(env.TELEGRAM_CHAT_IDS).split(',').map(value => value.trim()).filter(Boolean);
  if (!chatIds.length) return;

  const options = Array.isArray(payload.options)
    ? payload.options.map((option, index) => `${index + 1}. ${escapeHtml(option)}`).join('\n')
    : 'unknown';
  const labels = {
    quiz_expected_answer_rejected: 'SCRIPT ANSWER REJECTED',
    quiz_answer_mismatch: 'QUIZ ANSWER MISMATCH',
    quiz_result_unknown: 'QUIZ RESULT UNKNOWN',
  };
  const text = limit(
    `<b>${labels[payload.incidentType] || 'QUIZ INCIDENT'}</b>\n\n` +
    `<b>Ник:</b> ${escapeHtml(payload.nick || 'unknown')}\n` +
    `<b>Версия:</b> ${escapeHtml(payload.version || 'unknown')}\n` +
    `<b>Комната:</b> ${escapeHtml(payload.room || payload.path || 'unknown')}\n\n` +
    `<b>Вопрос:</b>\n${escapeHtml(payload.question || 'unknown')}\n\n` +
    `<b>Варианты:</b>\n${options}\n\n` +
    `<b>Ответ скрипта:</b> ${escapeHtml(payload.expectedAnswer || 'unknown')}\n` +
    `<b>Подсвечен:</b> ${escapeHtml(payload.highlightedAnswer || 'unknown')}\n` +
    `<b>Выбран:</b> ${escapeHtml(payload.selectedAnswer || 'unknown')}\n` +
    `<b>Итог сайта:</b> ${escapeHtml(payload.resultText || payload.result || 'unknown')}\n` +
    `<b>ACC:</b> ${escapeHtml(payload.accChange || 'unknown')}\n\n` +
    `<b>IP:</b> ${escapeHtml(meta.ip)}\n` +
    `<b>Country:</b> ${escapeHtml(meta.country)}\n` +
    `<b>Time:</b> ${escapeHtml(meta.time)}`,
    3900
  );

  await Promise.all(chatIds.map(chatId => fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
  })));
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
