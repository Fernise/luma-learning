import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server.js';
import { createProgressStore } from '../lib/progress-store.js';

async function start(t, options = {}) {
  const server = createApp({ env: {}, ...options });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let closed = false;
  const close = async () => { if (!closed) { closed = true; await new Promise(resolve => server.close(resolve)); } };
  t.after(close);
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = (path, value, method = 'POST', cookie) => fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, ...(value ? { body: JSON.stringify(value) } : {}) });
  const enable = async id => (await call('/api/progress/enable', { consent: true, ...(id ? { sessionId: id } : {}) })).headers.get('set-cookie').split(';')[0];
  return { call, close, enable };
}

test('closed-tab recovery survives a real server restart, rotates session access and continues from the saved choice', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'luma-resume-')); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, 'progress.sqlite');
  let api = await start(t, { store: createProgressStore(path) });
  const original = await (await api.call('/api/session', {})).json(); const cookie = await api.enable(original.id);
  const chosen = await (await api.call('/api/turn', { id: original.id, revision: original.revision, action: { type: 'answer', choice: 0 } }, 'POST', cookie)).json();
  await api.close(); api = await start(t, { store: createProgressStore(path) });
  const saved = await (await api.call('/api/progress', null, 'GET', cookie)).json();
  assert.equal(saved.pending.length, 1); assert.equal(saved.pending[0].completed, 0);
  const resumed = await (await api.call('/api/resume', { runId: saved.pending[0].runId }, 'POST', cookie)).json();
  assert.notEqual(resumed.id, original.id); assert.equal(resumed.runId, original.runId); assert.equal(resumed.choice, chosen.choice); assert.equal(resumed.revision, chosen.revision); assert.equal(resumed.mode, 'local'); assert.equal(resumed.messages.length, 1);
  assert.equal((await api.call(`/api/session/${original.id}`, null, 'GET', cookie)).status, 404);
  const complete = await (await api.call('/api/turn', { id: resumed.id, revision: resumed.revision, action: { type: 'explain', text: 'Menos partes y trozos más grandes.' } }, 'POST', cookie)).json();
  assert.equal(complete.phase, 'complete'); assert.equal(complete.records.length, 1);
});

test('switching islands can retain a checkpoint; resuming a live run reuses its revision and default deletion removes it', async t => {
  const api = await start(t); const cookie = await api.enable();
  const original = await (await api.call('/api/session', {}, 'POST', cookie)).json();
  const live = await (await api.call('/api/resume', { runId: original.runId }, 'POST', cookie)).json();
  assert.equal(live.id, original.id); assert.equal(live.revision, original.revision);
  assert.equal((await api.call(`/api/session/${original.id}?keepProgress=1`, null, 'DELETE', cookie)).status, 200);
  const second = await (await api.call('/api/session', { missionId: 'patterns' }, 'POST', cookie)).json();
  assert.equal((await (await api.call('/api/progress', null, 'GET', cookie)).json()).pending.length, 2);
  const resumed = await (await api.call('/api/resume', { runId: original.runId }, 'POST', cookie)).json();
  assert.notEqual(resumed.id, original.id); assert.equal(resumed.lesson.id, original.lesson.id);
  await api.call(`/api/session/${resumed.id}`, null, 'DELETE', cookie);
  assert.equal((await api.call('/api/resume', { runId: original.runId }, 'POST', cookie)).status, 404);
  assert.deepEqual((await (await api.call('/api/progress', null, 'GET', cookie)).json()).pending.map(run => run.runId), [second.runId]);
});

test('known run identifiers cannot bypass cookie ownership, strict request fields or forgetting progress', async t => {
  const api = await start(t); const owner = await api.enable(); const other = await api.enable();
  const run = await (await api.call('/api/session', {}, 'POST', owner)).json();
  for (const cookie of [undefined, other, 'luma_device=' + 'c'.repeat(64)]) {
    assert.equal((await api.call('/api/resume', { runId: run.runId }, 'POST', cookie)).status, 404);
    assert.deepEqual((await (await api.call('/api/progress', null, 'GET', cookie)).json()).pending, []);
    await api.call(`/api/session/${run.id}?keepProgress=1`, null, 'DELETE', cookie);
  }
  assert.equal((await api.call(`/api/session/${run.id}`, null, 'GET', owner)).status, 200);
  for (const payload of [{}, { runId: null }, { runId: 'x'.repeat(1000) }, { runId: run.runId, useAI: true }, { runId: run.runId, choice: 0 }]) assert.equal((await api.call('/api/resume', payload, 'POST', owner)).status, 400);
  assert.equal((await api.call(`/api/session/${run.id}?keepProgress=0`, null, 'DELETE', owner)).status, 400);
  await api.call('/api/progress', null, 'DELETE', owner);
  assert.equal((await api.call('/api/resume', { runId: run.runId }, 'POST', owner)).status, 404);
});

test('expired checkpoints and credentials cannot be resumed by run identifier', async t => {
  let time = 1000;
  const api = await start(t, { store: createProgressStore(':memory:', { now: () => time }) }); const cookie = await api.enable();
  const original = await (await api.call('/api/session', {}, 'POST', cookie)).json();
  await api.call(`/api/session/${original.id}?keepProgress=1`, null, 'DELETE', cookie);
  time += 7 * 24 * 3600000 + 1;
  assert.equal((await api.call('/api/resume', { runId: original.runId }, 'POST', cookie)).status, 404);
  const newer = await (await api.call('/api/session', {}, 'POST', cookie)).json();
  time += 365 * 24 * 3600000;
  assert.equal((await api.call('/api/resume', { runId: newer.runId }, 'POST', cookie)).status, 404);
});

test('resuming during an interpretation cannot fork the run or consume a second provider call', async t => {
  let resolveProvider; let entered;
  const started = new Promise(resolve => { entered = resolve; }); let calls = 0;
  const api = await start(t, {
    env: { OPENAI_API_KEY: 'fake-local-key', OPENAI_MODEL: 'test-model' },
    fetchImpl: async () => { calls++; entered(); return await new Promise(resolve => { resolveProvider = resolve; }); }
  });
  const cookie = await api.enable(); const original = await (await api.call('/api/session', { useAI: true }, 'POST', cookie)).json();
  const chosen = await (await api.call('/api/turn', { id: original.id, revision: original.revision, action: { type: 'answer', choice: 0 } }, 'POST', cookie)).json();
  const pending = api.call('/api/turn', { id: original.id, revision: chosen.revision, action: { type: 'explain', text: 'Menos partes y trozos más grandes.' } }, 'POST', cookie);
  await started;
  const blocked = await api.call('/api/resume', { runId: original.runId }, 'POST', cookie);
  assert.equal(blocked.status, 409); assert.equal((await blocked.json()).code, 'session_busy');
  resolveProvider({ ok: true, json: async () => ({ status: 'completed', output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: '{"category":"supported"}' }] }] }) });
  const completed = await (await pending).json();
  const resumed = await (await api.call('/api/resume', { runId: original.runId }, 'POST', cookie)).json();
  assert.equal(resumed.id, original.id); assert.equal(resumed.revision, completed.revision); assert.equal(calls, 1); assert.equal(resumed.records.length, 1);
});

test('explicitly resuming a live adventure refreshes its saved checkpoint lifetime without changing its revision', async t => {
  let time = 1000;
  const api = await start(t, { store: createProgressStore(':memory:', { now: () => time }) }); const cookie = await api.enable();
  const original = await (await api.call('/api/session', {}, 'POST', cookie)).json();
  time += 6 * 24 * 3600000;
  const resumed = await (await api.call('/api/resume', { runId: original.runId }, 'POST', cookie)).json();
  assert.equal(resumed.id, original.id); assert.equal(resumed.revision, original.revision);
  assert.equal((await (await api.call('/api/progress', null, 'GET', cookie)).json()).pending[0].updatedAt, new Date(time).toISOString());
  await api.call(`/api/session/${original.id}?keepProgress=1`, null, 'DELETE', cookie);
  time += 2 * 24 * 3600000;
  assert.equal((await api.call('/api/resume', { runId: original.runId }, 'POST', cookie)).status, 200);
});
