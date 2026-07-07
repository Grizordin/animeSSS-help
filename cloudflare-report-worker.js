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
]);

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);

      if (request.method === 'OPTIONS') {
        return corsResponse(request, null, 204);
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
};

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

  const allowed = /allowed|ok/i.test(payload.status || '');
  const embed = {
    title: allowed ? 'Script access allowed' : 'Script access blocked',
    color: allowed ? 0x22c55e : 0xef4444,
    fields: [
      field('Status', payload.status),
      field('Nick', payload.nick),
      field('Club', payload.clubId),
      field('Site', payload.host || payload.site),
      field('Version', payload.version),
      field('IP', meta.ip),
      field('Country', meta.country),
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
    title: 'Unknown notification',
    description: '```' + limit(payload.text || 'empty', 1500) + '```',
    color: 0x6366f1,
    fields: [
      field('Page', payload.path || payload.url || 'unknown', false),
      field('IP', meta.ip),
      field('Country', meta.country),
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

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
