import test from 'node:test';
import assert from 'node:assert/strict';
import { requestJSON } from '../public/request.js';

test('a stalled connection is aborted once, without retrying or sending another mutation', async () => {
  let calls = 0; let signal;
  await assert.rejects(requestJSON('/api/turn', { action: { type: 'explain', text: 'Una idea ficticia.' } }, 'POST', {
    timeoutMs: 10, fetchImpl: async (_path, options) => { calls++; signal = options.signal; return new Promise(() => {}); },
  }), { code: 'request_timeout' });
  assert.equal(calls, 1); assert.equal(signal.aborted, true);
});

test('the deadline also bounds a stalled JSON body after headers have arrived', async () => {
  let signal;
  await assert.rejects(requestJSON('/api/session/test', null, 'GET', {
    timeoutMs: 10, fetchImpl: async (_path, options) => { signal = options.signal; return { ok: true, json: () => new Promise(() => {}) }; },
  }), { code: 'request_timeout' });
  assert.equal(signal.aborted, true);
});

test('a response after timeout cannot be delivered as a second result', async () => {
  let release; let responses = 0;
  const pending = requestJSON('/api/turn', {}, 'POST', { timeoutMs: 10, fetchImpl: () => new Promise(resolve => { release = resolve; }) });
  await assert.rejects(pending, { code: 'request_timeout' });
  release({ ok: true, json: async () => { responses++; return { revision: 1 }; } });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(responses, 1);
  await assert.rejects(pending, { code: 'request_timeout' });
});

test('a successful request cancels its timer and retains the expected payload', async () => {
  let options;
  const response = await requestJSON('/api/turn', { revision: 3 }, 'POST', { timeoutMs: 10, fetchImpl: async (_path, value) => { options = value; return { ok: true, json: async () => ({ revision: 4 }) }; } });
  assert.deepEqual(response, { revision: 4 }); assert.equal(options.body, '{"revision":3}');
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(options.signal.aborted, false);
});

test('connection and malformed responses use useful messages without exposing raw errors', async () => {
  for (const fetchImpl of [async () => { throw new Error('PRIVATE NETWORK ERROR'); }, async () => ({ ok: true, json: async () => { throw new Error('PRIVATE BODY'); } }), async () => ({ ok: true, json: async () => null })]) {
    await assert.rejects(requestJSON('/api/config', null, 'GET', { fetchImpl }), error => !/PRIVATE/.test(error.message) && /Luma/.test(error.message));
  }
});

test('HTTP conflicts retain status and code for recovery without automatic replay', async () => {
  let calls = 0;
  await assert.rejects(requestJSON('/api/turn', {}, 'POST', { fetchImpl: async () => {
    calls++; return { ok: false, status: 409, json: async () => ({ error: 'Revisa el recorrido.', code: 'session_changed' }) };
  } }), { status: 409, code: 'session_changed', message: 'Revisa el recorrido.' });
  assert.equal(calls, 1);
});
