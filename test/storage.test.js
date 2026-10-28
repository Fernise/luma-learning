import test from 'node:test';
import assert from 'node:assert/strict';
import { PROGRESS_KEY, SESSION_KEY, progressSnapshot, readProgress, sessionId } from '../public/storage.js';

const id = '5aaa0000-1111-2222-3333-444444444444';
const record = { attempts: 1, help: 0, reasoning: 'supported', confidence: 'sure', transfer: false, unaided: true };
test('persistent progress excludes conversation, student text and session credentials', () => {
  const snapshot = progressSnapshot({ runId: id, id: '11111111-1111-1111-1111-111111111111', mission: { id: 'logic' }, phase: 'complete', records: [{ ...record, explanation: 'private learner text', title: 'private name' }], messages: [{ text: 'private conversation' }], apiKey: 'secret' });
  const raw = JSON.stringify(snapshot);
  for (const secret of ['private', 'conversation', 'apiKey', 'secret', 'title']) assert.equal(raw.includes(secret), false);
  assert.equal(snapshot.records[0].confidence, 'sure');
  assert.equal(raw.includes('11111111-1111-1111-1111-111111111111'), false);
});

test('missing, corrupt and unavailable storage do not enable persistence', () => {
  for (const storage of [undefined, { getItem: () => null }, { getItem: () => '{broken' }, { getItem: () => { throw new Error('unavailable'); } }]) assert.deepEqual(readProgress(storage), { enabled: false, history: [] });
});

test('stored progress is sanitized and bounded before it can be displayed or exported', () => {
  const run = { id, missionId: 'logic', savedAt: '2026-10-01T10:00:00Z', records: [record], messages: ['private'] };
  const storage = { getItem: key => key === PROGRESS_KEY ? JSON.stringify({ version: 1, history: [run, { ...run, missionId: 'unknown' }, { ...run, savedAt: 'invalid' }, { ...run, records: [{ ...record, help: -1 }] }] }) : null };
  const { enabled, history } = readProgress(storage);
  assert.equal(enabled, true); assert.equal(history.length, 1); assert.equal('messages' in history[0], false);
});

test('only a session UUID can be restored from tab storage', () => {
  assert.equal(sessionId({ getItem: key => key === SESSION_KEY ? id : null }), id);
  assert.equal(sessionId({ getItem: () => '../../.env' }), null);
});
