/**
 * carlosmakes.com contact form — serverless edge handler.
 * 1) Receives POST /api/contact as JSON; validates fields (no libs).
 * 2) Honeypot _gotcha fools bots: we return 200 and skip Resend.
 * 3) Resend via fetch; RESEND_API_KEY is a Wrangler secret only.
 * 4) Cloudflare KV counts successful sends per IP (3 / hour) after validation.
 * 5) CORS: production origins + localhost/127.0.0.1 for static dev servers.
 */

const TOPICS = new Set(['colaboracion', 'proyecto', 'consulta', 'otro']);
const TOPIC_SUBJECT = {
  colaboracion: 'colaboración',
  proyecto: 'proyecto',
  consulta: 'consulta',
  otro: 'otro',
};

const CORS_BASE = {
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept-Language',
  'Access-Control-Max-Age': '86400',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function langFromRequest(request) {
  const a = (request.headers.get('Accept-Language') || '').toLowerCase();
  return a.startsWith('en') ? 'en' : 'es';
}

const VMSG = {
  es: {
    nameReq: 'Nombre requerido',
    nameLong: 'Nombre demasiado largo',
    emailReq: 'Email requerido',
    emailInvalid: 'Email no válido',
    topicInvalid: 'Tema no válido',
    messageShort: 'El mensaje debe tener al menos 20 caracteres',
    messageLong: 'El mensaje no puede superar 5000 caracteres',
  },
  en: {
    nameReq: 'Name is required',
    nameLong: 'Name is too long',
    emailReq: 'Email is required',
    emailInvalid: 'Invalid email',
    topicInvalid: 'Invalid topic',
    messageShort: 'Message must be at least 20 characters',
    messageLong: 'Message cannot exceed 5000 characters',
  },
};

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin');
  const allow = isAllowedOrigin(origin, env);
  const h = { ...CORS_BASE };
  if (allow && origin) {
    h['Access-Control-Allow-Origin'] = origin;
    h.Vary = 'Origin';
  }
  if (!allow) {
    h['Access-Control-Allow-Origin'] = 'null';
  }
  return h;
}

function isAllowedOrigin(origin, env) {
  if (!origin) return true; // no browser CORS (curl)
  const allowed = [
    'https://carlosmakes.com',
    'https://www.carlosmakes.com',
    'http://localhost:8787',
    'http://127.0.0.1:8787',
    'http://localhost:5500',
    'http://127.0.0.1:5500',
    'http://localhost:8080',
    'http://127.0.0.1:8080',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ];
  if (env && env.CORS_EXTRA) {
    for (const o of String(env.CORS_EXTRA).split(',')) {
      const t = o.trim();
      if (t) allowed.push(t);
    }
  }
  return allowed.includes(origin);
}

function json(data, status, extraHeaders) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...extraHeaders,
    },
  });
}

function clientIp(request) {
  return (
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
    '0.0.0.0'
  );
}

async function checkRateLimit(kv, ip) {
  if (!kv) return { ok: true, key: null, data: null };
  const key = 'rl:' + ip;
  const now = Date.now();
  const hour = 60 * 60 * 1000;
  const raw = await kv.get(key);
  let data = raw ? JSON.parse(raw) : { c: 0, reset: now + hour };
  if (now > data.reset) {
    data = { c: 0, reset: now + hour };
  }
  if (data.c >= 3) {
    return { ok: false, reset: data.reset, key, data };
  }
  return { ok: true, key, data };
}

async function incrementRateLimit(kv, key, data) {
  if (!kv || !key) return;
  data.c += 1;
  const ttl = Math.max(60, Math.ceil((data.reset - Date.now()) / 1000));
  await kv.put(key, JSON.stringify(data), { expirationTtl: ttl });
}

function validateBody(body, L) {
  const LL = L === 'en' ? 'en' : 'es';
  const err = (field, key) => ({ field, message: VMSG[LL][key] || key });

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const topic = typeof body.topic === 'string' ? body.topic.trim() : '';
  const message = typeof body.message === 'string' ? body.message : '';

  if (!name) return { error: err('name', 'nameReq') };
  if (name.length > 200) return { error: err('name', 'nameLong') };

  if (!email) return { error: err('email', 'emailReq') };
  if (!EMAIL_RE.test(email)) return { error: err('email', 'emailInvalid') };

  if (!topic || !TOPICS.has(topic)) {
    return { error: err('topic', 'topicInvalid') };
  }

  if (message.length < 20) {
    return { error: err('message', 'messageShort') };
  }
  if (message.length > 5000) {
    return { error: err('message', 'messageLong') };
  }

  return { name, email, topic, message: message.trim() };
}

function buildText({ name, email, topic, message }) {
  return [
    'Nuevo mensaje desde carlosmakes.com',
    '---',
    'Nombre: ' + name,
    'Email: ' + email,
    'Tema: ' + (TOPIC_SUBJECT[topic] || topic),
    '---',
    message,
    '',
  ].join('\n');
}

export default {
  async fetch(request, env) {
    const c = corsHeaders(request, env);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: c });
    }

    const url = new URL(request.url);
    if (url.pathname !== '/api/contact' && url.pathname !== '/api/contact/') {
      return json({ error: 'Not found' }, 404, c);
    }

    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405, c);
    }

    if (!isAllowedOrigin(request.headers.get('Origin'), env)) {
      return json({ error: 'Origin not allowed' }, 403, c);
    }

    const contentType = request.headers.get('Content-Type') || '';
    if (!contentType.includes('application/json')) {
      return json({ error: 'Content-Type must be application/json' }, 400, c);
    }

    let body;
    try {
      const text = await request.text();
      if (text.length > 60000) {
        return json({ error: 'Body too large' }, 400, c);
      }
      body = JSON.parse(text);
    } catch (e) {
      return json({ error: 'Invalid JSON' }, 400, c);
    }

    if (body._gotcha != null && String(body._gotcha).trim() !== '') {
      return json({ ok: true, message: 'Thanks' }, 200, c);
    }

    const L = langFromRequest(request);
    const out = validateBody(body, L);
    if (out.error) {
      return json({ error: 'Validation failed', details: [out.error] }, 400, c);
    }

    if (!env.RESEND_API_KEY) {
      return json({ error: 'Server misconfigured' }, 500, c);
    }
    const from = env.FROM_EMAIL || 'contacto@carlosmakes.com';
    const to = env.TO_EMAIL;
    if (!to) {
      return json({ error: 'TO_EMAIL not set' }, 500, c);
    }

    const ip = clientIp(request);
    const rl = await checkRateLimit(env.RATE_LIMIT, ip);
    if (!rl.ok) {
      return json(
        {
          error: 'Too many requests',
          retryAfter: Math.ceil((rl.reset - Date.now()) / 1000),
        },
        429,
        c
      );
    }

    const { name, email, topic, message } = out;
    const subject =
      'Nuevo contacto desde carlosmakes.com — ' + (TOPIC_SUBJECT[topic] || topic);

    const resendBody = {
      from: from,
      to: [to],
      subject,
      reply_to: email,
      text: buildText({ name, email, topic, message }),
    };

    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + env.RESEND_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(resendBody),
    });

    if (!r.ok) {
      const t = await r.text();
      return json(
        { error: 'Error al enviar el email', resend: t.slice(0, 200) },
        502,
        c
      );
    }

    await incrementRateLimit(env.RATE_LIMIT, rl.key, rl.data);

    return json({ ok: true }, 200, c);
  },
};
