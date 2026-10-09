import test from 'node:test';
import assert from 'node:assert/strict';
import { makeServer } from '../server/index.mjs';
import { extractDrafts, validateDrafts } from '../server/ai.mjs';
import { createOAuthState, verifyOAuthState, encryptSecret, decryptSecret } from '../server/integrations.mjs';
const task = { title: 'Prepare slides', minutes: 60, priority: 2, category: 'work', deadline: null };
const config = { OPENAI_API_KEY: 'test-only', OPENAI_MODEL: 'test-model', SUPABASE_URL: 'https://example.invalid', SUPABASE_ANON_KEY: 'test-public' };
const providerResponse = () => new Response(JSON.stringify({ status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify({ tasks: [task] }) }] }] }));
async function withServer(config, fetcher, fn) {
  const server = makeServer(config, fetcher); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try { await fn(`http://127.0.0.1:${server.address().port}`); } finally { await new Promise(resolve => server.close(resolve)); }
}
test('AI request disables storage and produces strictly validated drafts', async () => {
  const result = await extractDrafts({ text: 'Prepare slides', today: '2026-10-12', timezone: 'Europe/Berlin' }, config, async (_url, options) => {
    const body = JSON.parse(options.body); assert.equal(body.store, false); assert.equal(body.text.format.strict, true); assert.equal(body.model, 'test-model'); return providerResponse();
  });
  assert.deepEqual(result.tasks, [task]);
  assert.throws(() => validateDrafts({ tasks: [{ ...task, minutes: -4 }] }));
  assert.throws(() => validateDrafts({ tasks: [{ ...task, deadline: '2026-02-30' }] }));
});
test('missing backend config fails closed', async () => withServer({}, null, async url => {
  assert.equal((await fetch(`${url}/v1/extract`, { method: 'POST' })).status, 503);
}));
test('unauthenticated requests and disallowed browser origins never reach AI', async () => withServer(config, () => { throw new Error('Must not call'); }, async url => {
  assert.equal((await fetch(`${url}/v1/extract`, { method: 'POST' })).status, 401);
  assert.equal((await fetch(`${url}/v1/extract`, { method: 'POST', headers: { Origin: 'https://evil.invalid' } })).status, 403);
}));
test('rejects invalid Supabase sessions', async () => withServer(config, async () => new Response('{}', { status: 401 }), async url => {
  const result = await fetch(`${url}/v1/extract`, { method: 'POST', headers: { Authorization: 'Bearer invalid', 'Content-Type': 'application/json' }, body: '{}' }); assert.equal(result.status, 401);
}));
test('authenticated extraction, validation and per-user rate limit', async () => {
  let aiCalls = 0;
  await withServer(config, async url => { if (url.endsWith('/auth/v1/user')) return new Response(JSON.stringify({ id: 'user1' })); aiCalls++; return providerResponse(); }, async url => {
    const send = body => fetch(`${url}/v1/extract`, { method: 'POST', headers: { Authorization: 'Bearer valid', 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    assert.equal((await send({})).status, 400); assert.equal(aiCalls, 0);
    assert.equal((await send({ text: 'abc', today: '2026-02-30', timezone: 'Europe/Berlin' })).status, 400);
    for (let i = 0; i < 20; i++) { const response = await send({ text: 'Prepare slides', today: '2026-10-12', timezone: 'Europe/Berlin' }); assert.equal(response.status, 200); assert.deepEqual((await response.json()).tasks, [task]); }
    assert.equal((await send({ text: 'Prepare slides', today: '2026-10-12', timezone: 'Europe/Berlin' })).status, 429); assert.equal(aiCalls, 20);
  });
});
test('provider refusals and malformed outputs are rejected', async () => {
  await assert.rejects(extractDrafts({}, config, async () => new Response(JSON.stringify({ status: 'incomplete' }))));
  await assert.rejects(extractDrafts({}, config, async () => new Response(JSON.stringify({ status: 'completed', output: [{ content: [{ type: 'refusal', refusal: 'No' }] }] }))));
});


test('integration secrets are encrypted and OAuth state is signed and expires', () => {
  const key = Buffer.alloc(32, 7).toString('base64');
  const encrypted = encryptSecret('refresh-token-value', key);
  assert.notEqual(encrypted, 'refresh-token-value');
  assert.equal(decryptSecret(encrypted, key), 'refresh-token-value');
  const oauth = { OAUTH_STATE_SECRET: 'test-state-secret' };
  const state = createOAuthState('user-123', 'google', oauth, 1_000);
  assert.deepEqual(verifyOAuthState(state, oauth, 1_001).u, 'user-123');
  assert.throws(() => verifyOAuthState(state + 'x', oauth, 1_001));
  assert.throws(() => verifyOAuthState(state, oauth, 1_000 + 10 * 60 * 1000 + 1));
});

test('integration API requires a valid Planner AI session', async () => withServer(config, () => { throw new Error('Must not call without auth'); }, async url => {
  const response = await fetch(`${url}/v1/integrations`);
  assert.equal(response.status, 401);
}));
