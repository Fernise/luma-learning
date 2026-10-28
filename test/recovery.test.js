import test from 'node:test';
import assert from 'node:assert/strict';
import { draftFitsActivity, createDraftArchive } from '../public/recovery.js';

const activity = { id: 'session', runId: 'run', lesson: { id: 'pizza' }, choice: 1, phase: 'reflect' };

test('a draft stays with the same choice, including an activity recovered in local mode or paused', () => {
  for (const phase of ['reflect', 'explain']) for (const paused of [false, true]) {
    assert.equal(draftFitsActivity({ ...activity, mode: 'ai' }, { ...activity, mode: 'local', phase, paused }), true);
  }
});

test('page drafts retain exact whitespace and return only to the same unfinished choice after credential rotation', () => {
  const archive = createDraftArchive(); const text = '  Una idea\ncon dos líneas.  ';
  archive.save(activity, text);
  assert.deepEqual(archive.read({ ...activity, id: 'new-session' }), { text, fits: true });
  assert.deepEqual(archive.read({ ...activity, choice: 0 }), { text, fits: false });
  assert.deepEqual(archive.read({ ...activity, lesson: { id: 'other' } }), { text, fits: false });
  assert.deepEqual(archive.read({ ...activity, phase: 'complete' }), { text, fits: false });
  assert.equal(archive.read({ ...activity, runId: 'other-run' }), null);
});
test('draft memory is bounded, deletion clears it and intentional empty text removes an old idea', () => {
  const archive = createDraftArchive(2);
  for (const runId of ['a', 'b', 'c']) archive.save({ ...activity, runId }, runId);
  assert.equal(archive.read({ ...activity, runId: 'a' }), null);
  archive.save({ ...activity, runId: 'b' }, '  '); assert.equal(archive.read({ ...activity, runId: 'b' }), null);
  archive.forget('c'); assert.equal(archive.read({ ...activity, runId: 'c' }), null);
  archive.save(activity, 'idea'); archive.clear(); assert.equal(archive.read(activity), null);
});
test('a changed choice, activity or session makes the previous draft a separate copy', () => {
  for (const change of [{ choice: 0 }, { choice: null }, { lesson: { id: 'chocolate' } }, { runId: 'another-run' }, { id: 'another-session' }]) {
    assert.equal(draftFitsActivity(activity, { ...activity, ...change }), false);
  }
});
test('completed, finished and unselected activities cannot receive the previous explanation', () => {
  for (const phase of ['complete', 'finished', 'answer']) assert.equal(draftFitsActivity(activity, { ...activity, phase }), false);
  assert.equal(draftFitsActivity({ ...activity, choice: null }, { ...activity, choice: null }), false);
});
test('missing activity context does not claim that a draft still fits', () => {
  for (const missing of [null, undefined, {}, { lesson: {} }]) {
    assert.equal(draftFitsActivity(missing, activity), false);
    assert.equal(draftFitsActivity(activity, missing), false);
  }
  const incomplete = { lesson: { id: 'pizza' }, choice: 1, phase: 'reflect' };
  assert.equal(draftFitsActivity(incomplete, { ...incomplete }), false);
  for (const choice of [undefined, '1', -1]) assert.equal(draftFitsActivity({ ...activity, choice }, { ...activity, choice }), false);
});
