import test from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { createHash } from 'node:crypto';
import { createApp } from '../server.js';
import { createEducatorPreview } from '../scripts/preview-educator.js';
import { createProgressStore } from '../lib/progress-store.js';
import { deviceCookie } from '../lib/http-security.js';

async function start(t, create = () => createApp({ env: {} })) {
  const server = create(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = (path, data, method = 'GET', headers = {}) => fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...headers }, ...(data === undefined ? {} : { body: JSON.stringify(data) }) });
  return { base, call, port: server.address().port };
}
function raw(base, path, { headers = {}, parts = [], method = 'GET' } = {}) {
  return new Promise((resolve, reject) => {
    const req = request(base + path, { method, headers }, res => {
      const chunks = []; res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text: Buffer.concat(chunks).toString('utf8') }));
    }); req.on('error', reject);
    (async () => { for (const part of parts) { req.write(part); await new Promise(resolve => setTimeout(resolve, 10)); } req.end(); })().catch(reject);
  });
}

test('literal local authorities and origins reject URL-like Host tricks on app and educator preview', async t => {
  for (const create of [() => createApp({ env: {} }), createEducatorPreview]) {
    const { base, port, call } = await start(t, create);
    for (const host of [`user@localhost:${port}`, `localhost:${port}/path`, `localhost:${port}?q=x`, `%6cocalhost:${port}`, `127.0.0.1:${port + 1}`, 'unrelated.example']) {
      assert.equal((await raw(base, '/', { headers: { Host: host } })).status, 403, host);
    }
    assert.equal((await call('/', undefined, 'GET', { Origin: 'null' })).status, 403);
    assert.equal((await call('/', undefined, 'GET', { Origin: `http://localhost:${port}` })).status, 403);
    assert.equal((await call('/', undefined, 'GET', { 'Sec-Fetch-Site': 'cross-site' })).status, 403);
    assert.equal((await call('/', undefined, 'GET', { Origin: base })).status, 200);
    assert.equal((await raw(base, '/', { headers: { Host: `localhost:${port}` } })).status, 200);
  }
});

test('ambiguous or malformed device credentials fail closed without setting or erasing a cookie', async t => {
  const token = 'a'.repeat(64);
  assert.equal(deviceCookie(`another=x; luma_device=${token}; theme=light`), token);
  assert.equal(deviceCookie('another=x'), null);
  const { call } = await start(t);
  for (const cookie of [`luma_device=${token}; luma_device=${'b'.repeat(64)}`, `luma_device=${token}; luma_device=bad`, 'luma_device=bad', 'luma_device', `luma_device =${token}`]) {
    for (const [path, method, data] of [['/api/progress', 'GET', undefined], ['/api/progress', 'DELETE', undefined], ['/api/progress/enable', 'POST', { consent: true }]]) {
      const result = await call(path, data, method, { Cookie: cookie });
      assert.equal(result.status, 400); assert.equal(result.headers.get('set-cookie'), null);
      assert.equal((await result.text()).includes(token), false);
    }
  }
});

test('no device cookie before opt-in; opt-in and deletion retain restricted matching attributes', async t => {
  const { call } = await start(t);
  for (const [path, method, data] of [['/', 'GET', undefined], ['/api/progress', 'GET', undefined], ['/api/session', 'POST', {}]]) {
    assert.equal((await call(path, data, method)).headers.get('set-cookie'), null);
  }
  const response = await call('/api/progress/enable', { consent: true }, 'POST');
  const header = response.headers.get('set-cookie');
  assert.match(header, /^luma_device=[a-f0-9]{64}; HttpOnly; SameSite=Strict; Path=\/; Max-Age=31536000$/);
  assert.doesNotMatch(header, /Domain=/i);
  const cookie = header.split(';')[0];
  assert.equal((await (await call('/api/progress', undefined, 'GET', { Cookie: cookie })).json()).enabled, true);
  const removed = await call('/api/progress', undefined, 'DELETE', { Cookie: cookie });
  assert.equal(removed.headers.get('set-cookie'), 'luma_device=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
  assert.equal((await (await call('/api/progress', undefined, 'GET', { Cookie: cookie })).json()).enabled, false);
});

test('another browser cannot attach, read, mutate or delete a device-owned session even knowing its ID', async t => {
  const { call } = await start(t);
  const enable = async () => (await call('/api/progress/enable', { consent: true }, 'POST')).headers.get('set-cookie').split(';')[0];
  const owner = await enable(); const other = await enable();
  const session = await (await call('/api/session', {}, 'POST', { Cookie: owner })).json();
  for (const cookie of [undefined, other]) {
    const headers = cookie ? { Cookie: cookie } : {};
    for (const method of ['GET', 'DELETE']) assert.equal((await call(`/api/session/${session.id}`, undefined, method, headers)).status, 404);
    assert.equal((await call('/api/turn', { id: session.id, revision: 0, action: { type: 'hint' } }, 'POST', headers)).status, 404);
    const claim = await call('/api/progress/enable', { consent: true, sessionId: session.id }, 'POST', headers);
    assert.equal(claim.status, 404); assert.equal(claim.headers.get('set-cookie'), null);
  }
  for (const sessionId of [null, 42, {}, '', 'x'.repeat(129)]) assert.equal((await call('/api/progress/enable', { consent: true, sessionId }, 'POST')).status, 400);
  const intact = await (await call(`/api/session/${session.id}`, undefined, 'GET', { Cookie: owner })).json();
  assert.deepEqual(intact, session);
});

test('UTF-8 split across HTTP chunks preserves explanation; malformed bytes or excessive raw bodies do not commit', async t => {
  const { call, base } = await start(t);
  const session = await (await call('/api/session', {}, 'POST')).json();
  await call('/api/turn', { id: session.id, revision: 0, action: { type: 'answer', choice: 0 } }, 'POST');
  const text = 'Menos partes del mismo entero dan trozos más grandes. Círculo 🟢';
  const bytes = Buffer.from(JSON.stringify({ id: session.id, revision: 1, action: { type: 'explain', text } }));
  const cut = bytes.indexOf(Buffer.from('í')) + 1;
  const headers = { 'Content-Type': 'application/json' };
  const response = await raw(base, '/api/turn', { method: 'POST', headers, parts: [bytes.subarray(0, cut), bytes.subarray(cut)] });
  assert.equal(response.status, 200);
  const observed = JSON.parse(response.text); assert.equal(observed.messages.filter(m => m.role === 'student').at(-1).text, text);
  for (const parts of [[Buffer.from('{"bad":"'), Buffer.from([0xc3]), Buffer.from('"}')], [Buffer.from(' '.repeat(4097))]]) {
    assert.equal((await raw(base, '/api/turn', { method: 'POST', headers, parts })).status, 400);
    assert.deepEqual(await (await call(`/api/session/${session.id}`)).json(), { id: observed.id, ...Object.fromEntries(Object.entries(observed).filter(([key]) => !['id', 'fallback', 'assessment'].includes(key))) });
  }
});

test('app and educator responses block framing, MIME sniffing and cross-origin resource embedding', async t => {
  for (const create of [() => createApp({ env: {} }), createEducatorPreview]) {
    const { call } = await start(t, create);
    for (const path of ['/', '/not-a-route']) {
      const response = await call(path);
      assert.equal(response.headers.get('x-frame-options'), 'DENY');
      assert.equal(response.headers.get('cross-origin-resource-policy'), 'same-origin');
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
      assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
      assert.match(response.headers.get('content-security-policy'), /frame-ancestors 'none'/);
      assert.equal(response.headers.get('cache-control'), 'no-store');
    }
  }
});

test('educator filters and styles are authorized only by exact content hashes, without unsafe-inline or API access', async t => {
  const { call } = await start(t, createEducatorPreview); const result = await call('/');
  const csp = result.headers.get('content-security-policy'); const html = await result.text();
  for (const tag of ['script', 'style']) {
    const content = html.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`))[1];
    const hash = createHash('sha256').update(content).digest('base64');
    assert.ok(csp.includes(`${tag}-src 'sha256-${hash}'`));
  }
  assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval/);
  assert.match(csp, /default-src 'none'/);
  assert.equal(result.headers.get('set-cookie'), null);
  assert.equal((await call('/api/progress')).status, 404);
});

test('expired cookie credentials cannot access a fresh in-memory session or be replayed to mutate it', async t => {
  let time = Date.parse('2026-10-07T10:00:00Z');
  const store = createProgressStore(':memory:', { now: () => time });
  const { call } = await start(t, () => createApp({ env: {}, store }));
  const response = await call('/api/progress/enable', { consent: true }, 'POST');
  const cookie = response.headers.get('set-cookie').split(';')[0]; const headers = { Cookie: cookie };
  const session = await (await call('/api/session', {}, 'POST', headers)).json();
  time += 365 * 24 * 3600000;
  assert.equal((await (await call('/api/progress', undefined, 'GET', headers)).json()).enabled, false);
  assert.equal((await call(`/api/session/${session.id}`, undefined, 'GET', headers)).status, 404);
  assert.equal((await call('/api/turn', { id: session.id, revision: 0, action: { type: 'hint' } }, 'POST', headers)).status, 404);
  const newConsent = await call('/api/progress/enable', { consent: true }, 'POST', headers);
  assert.notEqual(newConsent.headers.get('set-cookie').split(';')[0], cookie);
});
