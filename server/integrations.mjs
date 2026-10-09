import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const GOOGLE_SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/calendar.events.readonly',
  'https://www.googleapis.com/auth/gmail.readonly',
];
const MICROSOFT_SCOPES = ['openid', 'profile', 'email', 'offline_access', 'User.Read', 'Mail.Read', 'Calendars.ReadBasic'];
const PROVIDERS = new Set(['google', 'microsoft']);

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const providerConfig = (provider, config) => provider === 'google'
  ? {
      clientId: config.GOOGLE_CLIENT_ID,
      clientSecret: config.GOOGLE_CLIENT_SECRET,
      redirectUri: config.GOOGLE_REDIRECT_URI,
      scopes: GOOGLE_SCOPES,
    }
  : {
      clientId: config.MICROSOFT_CLIENT_ID,
      clientSecret: config.MICROSOFT_CLIENT_SECRET,
      redirectUri: config.MICROSOFT_REDIRECT_URI,
      scopes: MICROSOFT_SCOPES,
      tenant: config.MICROSOFT_TENANT || 'common',
    };

function storageConfigured(config) {
  return Boolean(config.SUPABASE_URL && config.SUPABASE_ANON_KEY && config.SUPABASE_SERVICE_ROLE_KEY && config.INTEGRATION_ENCRYPTION_KEY && config.OAUTH_STATE_SECRET);
}
export function integrationConfigured(provider, config) {
  const p = providerConfig(provider, config);
  return storageConfigured(config) && Boolean(p.clientId && p.clientSecret && p.redirectUri);
}

function encryptionKey(config) {
  let key;
  try { key = Buffer.from(config.INTEGRATION_ENCRYPTION_KEY || '', 'base64'); } catch { throw new HttpError(503, 'Integration encryption key is invalid.'); }
  if (key.length !== 32) throw new HttpError(503, 'Integration encryption key must be 32 bytes encoded as base64.');
  return key;
}
export function encryptSecret(value, base64Key) {
  const key = Buffer.from(base64Key, 'base64');
  if (key.length !== 32) throw new Error('Expected a 32-byte key.');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map(x => x.toString('base64url')).join('.');
}
export function decryptSecret(value, base64Key) {
  const key = Buffer.from(base64Key, 'base64');
  if (key.length !== 32) throw new Error('Expected a 32-byte key.');
  const [ivRaw, tagRaw, dataRaw] = String(value).split('.');
  if (!ivRaw || !tagRaw || !dataRaw) throw new Error('Invalid encrypted value.');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivRaw, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(dataRaw, 'base64url')), decipher.final()]).toString('utf8');
}

export function createOAuthState(userId, provider, config, now = Date.now()) {
  if (!PROVIDERS.has(provider) || !config.OAUTH_STATE_SECRET) throw new Error('OAuth state is not configured.');
  const payload = Buffer.from(JSON.stringify({ u: userId, p: provider, e: now + 10 * 60 * 1000, n: randomBytes(12).toString('base64url') })).toString('base64url');
  const signature = createHmac('sha256', config.OAUTH_STATE_SECRET).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}
export function verifyOAuthState(state, config, now = Date.now()) {
  if (!config.OAUTH_STATE_SECRET || typeof state !== 'string') throw new HttpError(400, 'Invalid OAuth state.');
  const [payload, signature] = state.split('.');
  if (!payload || !signature) throw new HttpError(400, 'Invalid OAuth state.');
  const expected = createHmac('sha256', config.OAUTH_STATE_SECRET).update(payload).digest();
  let actual; try { actual = Buffer.from(signature, 'base64url'); } catch { throw new HttpError(400, 'Invalid OAuth state.'); }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new HttpError(400, 'Invalid OAuth state.');
  let decoded; try { decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')); } catch { throw new HttpError(400, 'Invalid OAuth state.'); }
  if (!decoded.u || !PROVIDERS.has(decoded.p) || !Number.isFinite(decoded.e) || decoded.e < now) throw new HttpError(400, 'OAuth state expired or invalid.');
  return decoded;
}

async function authenticateUser(req, config, fetcher) {
  if (!config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) throw new HttpError(503, 'Planner account backend is not configured.');
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ') || auth.length > 8192) throw new HttpError(401, 'Sign in first.');
  const response = await fetcher(`${config.SUPABASE_URL.replace(/\/$/, '')}/auth/v1/user`, {
    headers: { Authorization: auth, apikey: config.SUPABASE_ANON_KEY },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new HttpError(401, 'Your session expired. Sign in again.');
  const user = await response.json();
  if (!user.id) throw new HttpError(401, 'Invalid session.');
  return user;
}

async function db(config, fetcher, suffix, init = {}) {
  if (!storageConfigured(config)) throw new HttpError(503, 'Connections are not configured on the server.');
  const response = await fetcher(`${config.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/integration_connections${suffix}`, {
    ...init,
    headers: {
      apikey: config.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${config.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new HttpError(502, 'Could not access saved connection data.');
  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function getConnection(userId, provider, config, fetcher) {
  const rows = await db(config, fetcher, `?user_id=eq.${encodeURIComponent(userId)}&provider=eq.${provider}&select=*`);
  return Array.isArray(rows) ? rows[0] ?? null : null;
}
async function saveConnection(userId, provider, token, accountEmail, config, fetcher, existingRefreshToken = null) {
  const key = encryptionKey(config).toString('base64');
  const expiresAt = token.expires_in ? new Date(Date.now() + Number(token.expires_in) * 1000).toISOString() : null;
  const refresh = token.refresh_token || existingRefreshToken;
  const row = {
    user_id: userId,
    provider,
    account_email: accountEmail || null,
    access_token_enc: encryptSecret(token.access_token, key),
    refresh_token_enc: refresh ? encryptSecret(refresh, key) : null,
    token_expires_at: expiresAt,
    scope: token.scope || null,
    updated_at: new Date().toISOString(),
  };
  await db(config, fetcher, '?on_conflict=user_id,provider', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(row),
  });
}
async function deleteConnection(userId, provider, config, fetcher) {
  await db(config, fetcher, `?user_id=eq.${encodeURIComponent(userId)}&provider=eq.${provider}`, { method: 'DELETE' });
}

async function jsonFetch(fetcher, url, init, failureMessage) {
  const response = await fetcher(url, { ...init, signal: AbortSignal.timeout(12000) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new HttpError(502, body.error_description || body.error?.message || failureMessage);
  return body;
}

async function exchangeCode(provider, code, config, fetcher) {
  const p = providerConfig(provider, config);
  const body = new URLSearchParams({
    client_id: p.clientId,
    client_secret: p.clientSecret,
    code,
    redirect_uri: p.redirectUri,
    grant_type: 'authorization_code',
  });
  const url = provider === 'google'
    ? 'https://oauth2.googleapis.com/token'
    : `https://login.microsoftonline.com/${encodeURIComponent(p.tenant)}/oauth2/v2.0/token`;
  if (provider === 'microsoft') body.set('scope', p.scopes.join(' '));
  return jsonFetch(fetcher, url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body }, 'Could not exchange the authorization code.');
}

async function refreshAccessToken(row, config, fetcher) {
  if (row.token_expires_at && new Date(row.token_expires_at).getTime() > Date.now() + 60_000) {
    return decryptSecret(row.access_token_enc, encryptionKey(config).toString('base64'));
  }
  if (!row.refresh_token_enc) throw new HttpError(401, 'Reconnect this account to continue.');
  const refreshToken = decryptSecret(row.refresh_token_enc, encryptionKey(config).toString('base64'));
  const p = providerConfig(row.provider, config);
  const body = new URLSearchParams({
    client_id: p.clientId,
    client_secret: p.clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });
  const url = row.provider === 'google'
    ? 'https://oauth2.googleapis.com/token'
    : `https://login.microsoftonline.com/${encodeURIComponent(p.tenant)}/oauth2/v2.0/token`;
  if (row.provider === 'microsoft') body.set('scope', p.scopes.join(' '));
  const token = await jsonFetch(fetcher, url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body }, 'Could not refresh the provider connection.');
  await saveConnection(row.user_id, row.provider, token, row.account_email, config, fetcher, token.refresh_token || refreshToken);
  return token.access_token;
}

async function providerEmail(provider, accessToken, fetcher) {
  if (provider === 'google') {
    const me = await jsonFetch(fetcher, 'https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${accessToken}` } }, 'Could not read Google account profile.');
    return me.email || null;
  }
  const me = await jsonFetch(fetcher, 'https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName', { headers: { Authorization: `Bearer ${accessToken}` } }, 'Could not read Microsoft account profile.');
  return me.mail || me.userPrincipalName || null;
}

function authorizationUrl(provider, userId, config) {
  const p = providerConfig(provider, config);
  const state = createOAuthState(userId, provider, config);
  if (provider === 'google') {
    const q = new URLSearchParams({
      client_id: p.clientId,
      redirect_uri: p.redirectUri,
      response_type: 'code',
      scope: p.scopes.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
      state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
  }
  const q = new URLSearchParams({
    client_id: p.clientId,
    redirect_uri: p.redirectUri,
    response_type: 'code',
    response_mode: 'query',
    scope: p.scopes.join(' '),
    state,
  });
  return `https://login.microsoftonline.com/${encodeURIComponent(p.tenant)}/oauth2/v2.0/authorize?${q}`;
}

function redirectToApp(res, config, query) {
  const base = config.APP_RETURN_URL || 'planner-ai://connections';
  const join = base.includes('?') ? '&' : '?';
  res.statusCode = 302;
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Location', `${base}${join}${new URLSearchParams(query)}`);
  res.end();
}

async function readJson(req) {
  const chunks = []; let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 32768) throw new HttpError(413, 'Request is too large.');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { throw new HttpError(400, 'Invalid JSON.'); }
}

function validIso(value) {
  return typeof value === 'string' && value.length <= 64 && Number.isFinite(new Date(value).getTime());
}

async function mailDigest(provider, row, config, fetcher) {
  const token = await refreshAccessToken(row, config, fetcher);
  const lines = [];
  if (provider === 'google') {
    const list = await jsonFetch(fetcher, 'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=12&q=newer_than%3A14d', { headers: { Authorization: `Bearer ${token}` } }, 'Could not read Gmail.');
    const messages = await Promise.all((list.messages || []).slice(0, 12).map(({ id }) => jsonFetch(
      fetcher,
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(id)}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
      { headers: { Authorization: `Bearer ${token}` } },
      'Could not read a Gmail message.',
    )));
    for (const message of messages) {
      const headers = Object.fromEntries((message.payload?.headers || []).map(h => [String(h.name).toLowerCase(), h.value]));
      lines.push(`From: ${headers.from || 'Unknown'}\nSubject: ${headers.subject || '(no subject)'}\nDate: ${headers.date || ''}\nPreview: ${message.snippet || ''}`);
    }
  } else {
    const q = new URLSearchParams({ '$top': '12', '$select': 'id,subject,bodyPreview,receivedDateTime,from', '$orderby': 'receivedDateTime desc' });
    const data = await jsonFetch(fetcher, `https://graph.microsoft.com/v1.0/me/messages?${q}`, { headers: { Authorization: `Bearer ${token}` } }, 'Could not read Outlook mail.');
    for (const message of data.value || []) {
      lines.push(`From: ${message.from?.emailAddress?.name || message.from?.emailAddress?.address || 'Unknown'}\nSubject: ${message.subject || '(no subject)'}\nDate: ${message.receivedDateTime || ''}\nPreview: ${message.bodyPreview || ''}`);
    }
  }
  return { text: lines.join('\n\n---\n\n').slice(0, 12000), count: lines.length };
}

function normalizeMicrosoftDateTime(value) {
  if (!value?.dateTime) return null;
  const raw = value.dateTime;
  if (/Z$|[+-]\d\d:\d\d$/.test(raw)) return raw;
  return value.timeZone === 'UTC' ? `${raw}Z` : raw;
}
async function calendarEvents(provider, row, body, config, fetcher) {
  if (!validIso(body.startIso) || !validIso(body.endIso) || new Date(body.endIso) <= new Date(body.startIso)) throw new HttpError(400, 'Choose a valid calendar range.');
  if (typeof body.timezone !== 'string' || body.timezone.length > 80) throw new HttpError(400, 'Invalid timezone.');
  try { new Intl.DateTimeFormat('en', { timeZone: body.timezone }); } catch { throw new HttpError(400, 'Invalid timezone.'); }
  const token = await refreshAccessToken(row, config, fetcher);
  if (provider === 'google') {
    const q = new URLSearchParams({
      timeMin: body.startIso,
      timeMax: body.endIso,
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '1000',
    });
    const data = await jsonFetch(fetcher, `https://www.googleapis.com/calendar/v3/calendars/primary/events?${q}`, { headers: { Authorization: `Bearer ${token}` } }, 'Could not read Google Calendar.');
    return (data.items || []).filter(x => x.status !== 'cancelled').map(x => ({
      providerId: x.id,
      title: x.summary || 'Busy',
      allDay: Boolean(x.start?.date),
      start: x.start?.dateTime || null,
      end: x.end?.dateTime || null,
      startDate: x.start?.date || null,
      endDate: x.end?.date || null,
    }));
  }
  const q = new URLSearchParams({
    startDateTime: body.startIso,
    endDateTime: body.endIso,
    '$select': 'id,subject,start,end,isAllDay',
    '$top': '1000',
  });
  const data = await jsonFetch(fetcher, `https://graph.microsoft.com/v1.0/me/calendarView?${q}`, { headers: { Authorization: `Bearer ${token}` } }, 'Could not read Outlook Calendar.');
  return (data.value || []).map(x => ({
    providerId: x.id,
    title: x.subject || 'Busy',
    allDay: Boolean(x.isAllDay),
    start: x.isAllDay ? null : normalizeMicrosoftDateTime(x.start),
    end: x.isAllDay ? null : normalizeMicrosoftDateTime(x.end),
    startDate: x.isAllDay ? x.start?.dateTime?.slice(0, 10) || null : null,
    endDate: x.isAllDay ? x.end?.dateTime?.slice(0, 10) || null : null,
  }));
}

export async function maybeHandleIntegrationRequest(req, res, config, fetcher, send) {
  const requestUrl = new URL(req.url || '/', 'http://planner.local');
  const callback = requestUrl.pathname.match(/^\/oauth\/(google|microsoft)\/callback$/);
  const api = requestUrl.pathname.match(/^\/v1\/integrations(?:\/(google|microsoft)(?:\/(start|mail|calendar))?)?$/);
  if (!callback && !api) return false;
  try {
    if (callback) {
      const provider = callback[1];
      if (!integrationConfigured(provider, config)) throw new HttpError(503, 'This provider is not configured.');
      if (requestUrl.searchParams.get('error')) return redirectToApp(res, config, { error: requestUrl.searchParams.get('error'), provider });
      const code = requestUrl.searchParams.get('code');
      const state = verifyOAuthState(requestUrl.searchParams.get('state'), config);
      if (!code || state.p !== provider) throw new HttpError(400, 'Invalid OAuth callback.');
      const token = await exchangeCode(provider, code, config, fetcher);
      if (!token.access_token) throw new HttpError(502, 'Provider did not return an access token.');
      const email = await providerEmail(provider, token.access_token, fetcher);
      await saveConnection(state.u, provider, token, email, config, fetcher);
      redirectToApp(res, config, { connected: provider });
      return true;
    }

    const provider = api[1] || null;
    const action = api[2] || null;
    const user = await authenticateUser(req, config, fetcher);

    if (!provider && req.method === 'GET') {
      let rows = [];
      if (storageConfigured(config)) rows = await db(config, fetcher, `?user_id=eq.${encodeURIComponent(user.id)}&select=provider,account_email,scope,token_expires_at,updated_at`);
      const byProvider = new Map((rows || []).map(row => [row.provider, row]));
      return send(200, {
        providers: ['google', 'microsoft'].map(name => ({
          provider: name,
          configured: integrationConfigured(name, config),
          connected: byProvider.has(name),
          accountEmail: byProvider.get(name)?.account_email || null,
          updatedAt: byProvider.get(name)?.updated_at || null,
        })),
      }) || true;
    }

    if (!PROVIDERS.has(provider)) throw new HttpError(404, 'Unknown provider.');
    if (action === 'start' && req.method === 'GET') {
      if (!integrationConfigured(provider, config)) throw new HttpError(503, `${provider === 'google' ? 'Google' : 'Microsoft'} connection is not configured on the server.`);
      return send(200, { authorizeUrl: authorizationUrl(provider, user.id, config) }) || true;
    }
    if (!action && req.method === 'DELETE') {
      if (storageConfigured(config)) await deleteConnection(user.id, provider, config, fetcher);
      return send(200, { disconnected: true }) || true;
    }
    const row = await getConnection(user.id, provider, config, fetcher);
    if (!row) throw new HttpError(409, `Connect ${provider === 'google' ? 'Google' : 'Microsoft'} first.`);

    if (action === 'mail' && req.method === 'GET') return send(200, await mailDigest(provider, row, config, fetcher)) || true;
    if (action === 'calendar' && req.method === 'POST') {
      if (!req.headers['content-type']?.startsWith('application/json')) throw new HttpError(415, 'Use application/json.');
      const body = await readJson(req);
      return send(200, { events: await calendarEvents(provider, row, body, config, fetcher) }) || true;
    }
    throw new HttpError(404, 'Not found.');
  } catch (error) {
    if (res.writableEnded) return true;
    const status = error instanceof HttpError ? error.status : 502;
    send(status, { error: error instanceof Error ? error.message : 'Integration request failed.' });
    return true;
  }
}
