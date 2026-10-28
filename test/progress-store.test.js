import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createProgressStore } from '../lib/progress-store.js';
import { createSession, advance, publicSession } from '../lib/tutor.js';
const device = 'a'.repeat(64); const other = 'b'.repeat(64);
async function completed() {
  const session = createSession({ adaptive: true });
  await advance(session, { type: 'answer', choice: 0, confidence: 'sure' });
  await advance(session, { type: 'explain', text: 'Menos partes y trozos más grandes.' });
  return session;
}

test('database persistence is opt-in and isolated by device', async t => {
  const store = createProgressStore(); t.after(() => store.close());
  const session = await completed(); const id = randomUUID();
  store.save(device, id, session); assert.deepEqual(store.history(device), []); assert.equal(store.restore(device, id), null);
  store.enable(device); store.save(device, id, session);
  assert.equal(store.history(device).length, 1); assert.equal(store.history(other).length, 0); assert.equal(store.restore(other, id), null);
  assert.equal(store.history(device)[0].records[0].lessonId, 'pizza');
  assert.equal(store.history(device)[0].records[0].reasoningAttempts, 1);
});
test('server restart recovers a checkpoint without conversation, text or plaintext access tokens on disk', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'luma-store-')); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, 'progress.sqlite'); const id = randomUUID(); let store = createProgressStore(path);
  for (const file of readdirSync(dir)) assert.equal(statSync(join(dir, file)).mode & 0o777, 0o600);
  const session = await completed(); await advance(session, { type: 'next' });
  session.messages.push({ role: 'student', text: 'PRIVATE_EXPLANATION_TEST_7fb' });
  const messageIds = publicSession(session).messages.map(message => message.id);
  store.enable(device); store.save(device, id, session); store.close();
  for (const file of readdirSync(dir)) {
    const bytes = readFileSync(join(dir, file));
    for (const secret of ['PRIVATE_EXPLANATION_TEST_7fb', device, id, ...messageIds]) assert.equal(bytes.includes(Buffer.from(secret)), false);
  }
  store = createProgressStore(path); t.after(() => store.close());
  const restored = store.restore(device, id);
  assert.equal(restored.index, 1); assert.deepEqual(restored.lessonIds, session.lessonIds); assert.equal(restored.records.length, 1);
  assert.equal(restored.records[0].reasoningAttempts, 1); assert.equal(restored.reasoningAttempts, 0);
  assert.match(restored.messages[0].text, /recuperada/); assert.equal(JSON.stringify(restored).includes('PRIVATE_EXPLANATION'), false);
  const recoveryId = publicSession(restored).messages[0].id;
  assert.ok(recoveryId); assert.equal(messageIds.includes(recoveryId), false);
  assert.equal(publicSession(restored).messages[0].id, recoveryId);
  assert.equal(store.history(device).length, 1);
});
test('forgetting a device removes all its summaries and checkpoints but preserves another device', async t => {
  const store = createProgressStore(); t.after(() => store.close());
  const session = await completed(); const id = randomUUID(); const otherId = randomUUID();
  store.enable(device); store.enable(other); store.save(device, id, session); store.save(other, otherId, session);
  store.forget(device);
  assert.equal(store.enabled(device), false); assert.deepEqual(store.history(device), []); assert.equal(store.restore(device, id), null);
  assert.equal(store.history(other).length, 1); assert.ok(store.restore(other, otherId));
});
test('checkpoints expire after seven days while summaries remain available', async t => {
  let time = Date.parse('2026-10-03T20:00:00Z'); const store = createProgressStore(':memory:', { now: () => time }); t.after(() => store.close());
  const session = await completed(); const id = randomUUID(); store.enable(device); store.save(device, id, session);
  time += 7 * 24 * 3600000 + 1;
  assert.equal(store.restore(device, id), null); assert.equal(store.history(device).length, 1);
});
test('retention keeps at most twenty runs and deleting an active checkpoint does not erase its summary', async t => {
  let time = 10000; const store = createProgressStore(':memory:', { now: () => time++ }); t.after(() => store.close()); store.enable(device);
  const base = await completed(); const ids = [];
  for (let i = 0; i < 25; i++) { const id = randomUUID(); ids.push(id); store.save(device, id, { ...base, runId: randomUUID() }); }
  assert.equal(store.history(device).length, 20); assert.equal(store.restore(device, ids[0]), null); assert.ok(store.restore(device, ids.at(-1)));
  store.removeCheckpoint(ids.at(-1)); assert.equal(store.restore(device, ids.at(-1)), null); assert.equal(store.history(device).length, 20);
});

test('device credentials expire server-side after one year and explicit reissuance refreshes their lifetime', t => {
  let time = Date.parse('2026-10-07T10:00:00Z');
  const store = createProgressStore(':memory:', { now: () => time }); t.after(() => store.close());
  const year = 365 * 24 * 3600000;
  store.enable(device); time += year - 1; assert.equal(store.enabled(device), true);
  store.enable(device); time += year - 1; assert.equal(store.enabled(device), true);
  time++; assert.equal(store.enabled(device), false); assert.deepEqual(store.history(device), []);
});

test('pending adventures include zero completed situations, exclude finished runs and disclose no session credentials or text', t => {
  const store = createProgressStore(); t.after(() => store.close()); store.enable(device); store.enable(other);
  const session = createSession(); const id = randomUUID(); session.messages.push({ role: 'student', text: 'PRIVATE_UNSENT_IDEA' });
  store.save(device, id, session);
  const pending = store.pending(device);
  assert.equal(pending.length, 1); assert.equal(pending[0].completed, 0); assert.equal(pending[0].total, 5); assert.equal(pending[0].runId, session.runId);
  assert.deepEqual(store.pending(other), []); assert.equal(store.restoreRun(other, session.runId), null);
  for (const secret of [id, device, 'PRIVATE_UNSENT_IDEA', 'session_key', 'messages']) assert.equal(JSON.stringify(pending).includes(secret), false);
  store.save(device, id, { ...session, phase: 'finished' });
  assert.deepEqual(store.pending(device), []); assert.equal(store.restoreRun(device, session.runId), null);
});

test('run recovery preserves the lesson, choice, support, pause and revision but starts locally without conversation', async t => {
  const store = createProgressStore(); t.after(() => store.close()); store.enable(device);
  const session = createSession({ useAI: true });
  await advance(session, { type: 'answer', choice: 1, confidence: 'sure' });
  await advance(session, { type: 'hint' }); await advance(session, { type: 'pause' });
  store.save(device, randomUUID(), session);
  const restored = store.restoreRun(device, session.runId);
  for (const field of ['choice', 'confidence', 'help', 'paused', 'phase', 'totalTurns', 'runId', 'index']) assert.deepEqual(restored[field], session[field]);
  assert.deepEqual(restored.lessonIds, session.lessonIds); assert.equal(restored.useAI, false); assert.equal(restored.messages.length, 1); assert.match(restored.messages[0].text, /pausa/);
});

test('new session credentials replace only their own checkpoint, without reducing retention for other adventures', t => {
  let time = 1000; const store = createProgressStore(':memory:', { now: () => time++ }); t.after(() => store.close()); store.enable(device); store.enable(other);
  const base = createSession(); const original = randomUUID(); const foreign = randomUUID();
  store.save(device, original, base); store.save(other, foreign, base);
  for (let i = 0; i < 19; i++) store.save(device, randomUUID(), createSession());
  let current;
  for (let i = 0; i < 25; i++) { current = randomUUID(); store.save(device, current, base); }
  assert.equal(store.pending(device).length, 20); assert.equal(store.restore(device, original), null);
  assert.ok(store.restore(device, current)); assert.ok(store.restore(other, foreign));
});

test('listing and recovery enforce checkpoint expiry and deletion, while keeping summaries', async t => {
  let time = 1000; const store = createProgressStore(':memory:', { now: () => time }); t.after(() => store.close()); store.enable(device);
  const session = await completed(); store.save(device, randomUUID(), session);
  time += 7 * 24 * 3600000 + 1;
  assert.deepEqual(store.pending(device), []); assert.equal(store.restoreRun(device, session.runId), null); assert.equal(store.history(device).length, 1);
  store.save(device, randomUUID(), session); store.forget(device);
  assert.deepEqual(store.pending(device), []); assert.equal(store.restoreRun(device, session.runId), null);
});
