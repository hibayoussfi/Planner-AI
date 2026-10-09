import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { extractDrafts, validDate } from './ai.mjs';

export function makeServer(config = process.env, fetcher = fetch) {
  const counts = new Map();
  const allowedOrigins = (config.ALLOWED_ORIGINS || '').split(',').map(x => x.trim()).filter(Boolean);
  return createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff');
    const send = (status, body) => { res.writeHead(status); res.end(JSON.stringify(body)); };
    const origin = req.headers.origin;
    if (origin && !allowedOrigins.includes(origin)) return send(403, { error: 'Origin not allowed.' });
    if (origin) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin'); }
    if (req.method === 'OPTIONS') { res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type'); res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS'); return send(204, {}); }
    if (req.method === 'GET' && req.url === '/health') return send(200, { status: 'ok', aiConfigured: Boolean(config.OPENAI_API_KEY && config.OPENAI_MODEL && config.SUPABASE_URL && config.SUPABASE_ANON_KEY) });
    if (req.method !== 'POST' || req.url !== '/v1/extract') return send(404, { error: 'Not found.' });
    if (!config.SUPABASE_URL || !config.SUPABASE_ANON_KEY || !config.OPENAI_API_KEY || !config.OPENAI_MODEL) return send(503, { error: 'AI backend is not configured.' });
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ') || auth.length > 8192) return send(401, { error: 'Sign in first.' });
    if (!req.headers['content-type']?.startsWith('application/json')) return send(415, { error: 'Use application/json.' });
    try {
      // Validate the access token with Supabase on every request. Never trust decoded JWT claims alone.
      const identity = await fetcher(`${config.SUPABASE_URL.replace(/\/$/, '')}/auth/v1/user`, { headers: { Authorization: auth, apikey: config.SUPABASE_ANON_KEY }, signal: AbortSignal.timeout(8000) });
      if (!identity.ok) return send(401, { error: 'Your session expired. Sign in again.' });
      const user = await identity.json(); if (!user.id) return send(401, { error: 'Invalid session.' });
      const now = Date.now();
      for (const [id, limit] of counts) if (limit.until <= now) counts.delete(id);
      const chunks = []; let size = 0;
      for await (const chunk of req) { size += chunk.length; if (size > 65536) return send(413, { error: 'Request is too large.' }); chunks.push(chunk); }
      let body; try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return send(400, { error: 'Invalid JSON.' }); }
      if (!body || typeof body.text !== 'string' || body.text.trim().length < 3 || body.text.length > 12000 || !validDate(body.today) || typeof body.timezone !== 'string' || body.timezone.length > 80) return send(400, { error: 'Send text (3–12000 characters), today (YYYY-MM-DD) and a timezone.' });
      try { new Intl.DateTimeFormat('en', { timeZone: body.timezone }); } catch { return send(400, { error: 'Invalid timezone.' }); }
      const limit = counts.get(user.id) ?? { count: 0, until: Date.now() + 60 * 60 * 1000 };
      if (limit.count >= 20) { res.setHeader('Retry-After', String(Math.ceil((limit.until - Date.now()) / 1000))); return send(429, { error: 'Hourly AI limit reached. Try again later.' }); }
      limit.count++; counts.set(user.id, limit);
      return send(200, await extractDrafts(body, config, fetcher));
    } catch { return send(502, { error: 'Could not create task drafts. Please try again. No tasks were added.' }); }
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = makeServer(); server.requestTimeout = 45000; server.headersTimeout = 15000;
  server.listen(Number(process.env.PORT || 8787), process.env.HOST || '127.0.0.1', () => console.log('Planner AI backend listening.'));
}
