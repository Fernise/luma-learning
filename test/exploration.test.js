import test from 'node:test';
import assert from 'node:assert/strict';
import { partition, sequencePairs, pairDescription, clueSentences } from '../public/exploration.js';
import { getMission, publicLesson } from '../lib/catalog.js';
import { createSession, advance } from '../lib/tutor.js';

test('all allowed partitions preserve the same whole and equal-sized parts', () => {
  for (let parts = 2; parts <= 10; parts++) {
    const pieces = partition(parts);
    assert.equal(pieces.length, parts);
    assert.equal(pieces.filter(piece => piece.filled).length, 1);
    assert.ok(pieces.every(piece => piece.share === pieces[0].share));
    assert.ok(Math.abs(pieces.reduce((sum, piece) => sum + piece.share, 0) - 1) < 1e-12);
    if (parts < 10) assert.ok(pieces[0].share > partition(parts + 1)[0].share);
  }
});
test('partition rejects fractional, oversized and invalid selection counts', () => {
  for (const parts of [0, 1, 2.5, 11, Infinity, NaN, '6']) assert.throws(() => partition(parts), RangeError);
  for (const count of [-1, 7, 1.5]) assert.throws(() => partition(6, count), RangeError);
});
test('pair exploration uses existing terms and handles increasing, decreasing and doubling sequences', () => {
  const sequence = [3, 6, 12, 24];
  assert.deepEqual(sequencePairs(sequence), [{ from: 3, to: 6, difference: 3 }, { from: 6, to: 12, difference: 6 }, { from: 12, to: 24, difference: 12 }]);
  assert.deepEqual(sequence, [3, 6, 12, 24]);
  assert.deepEqual(sequencePairs([25, 21, 17, 13]).map(pair => pair.difference), [-4, -4, -4]);
  assert.deepEqual(sequencePairs([2, 5, 8, 11]).map(pair => pair.difference), [3, 3, 3]);
  assert.throws(() => sequencePairs([1, Infinity]), TypeError);
});
test('clue board retains all given facts without generating conclusions', () => {
  const context = 'ALGUNOS perros llevan collar azul. Luna es un perro. No sabemos nada más.';
  assert.deepEqual(clueSentences(context), ['ALGUNOS perros llevan collar azul.', 'Luna es un perro.', 'No sabemos nada más.']);
  assert.deepEqual(clueSentences(''), []);
});
test('visual exploration is counted as support and cannot skip a problem', async () => {
  for (const missionId of ['fractions', 'patterns', 'logic']) {
    const session = createSession({ missionId });
    assert.equal(session.visual, false);
    await advance(session, { type: 'hint' }); assert.equal(session.visual, false);
    await advance(session, { type: 'hint' }); assert.equal(session.visual, true); assert.equal(session.help, 2);
    assert.equal(session.records.length, 0);
    await assert.rejects(() => advance(session, { type: 'next' }));
  }
});

test('pair descriptions distinguish increase, decrease, no change and exact ratios', () => {
  assert.equal(pairDescription({ from: 2, to: 5 }), 'De 2 a 5: aumenta 3.');
  assert.equal(pairDescription({ from: 25, to: 21 }), 'De 25 a 21: disminuye 4.');
  assert.equal(pairDescription({ from: 4, to: 4 }), 'De 4 a 4: no cambia la cantidad.');
  assert.equal(pairDescription({ from: 3, to: 6 }, 'ratio'), 'De 3 a 6: la segunda cantidad es 2 veces la primera.');
  for (const pair of [{ from: 0, to: 3 }, { from: 3, to: 4 }, { from: -2, to: 4 }]) assert.throws(() => pairDescription(pair, 'ratio'), RangeError);
  assert.throws(() => pairDescription({ from: 2, to: Infinity }), TypeError);
  assert.throws(() => pairDescription({ from: 2, to: 4 }, 'unreviewed'), RangeError);
});

test('all 12 pattern explorers describe only known pairs using public data', () => {
  for (const source of getMission('patterns').lessons) {
    const lesson = publicLesson(source);
    const pairs = sequencePairs(lesson.sequence);
    assert.equal(pairs.length, lesson.sequence.length - 1);
    for (const pair of pairs) {
      const description = pairDescription(pair);
      assert.match(description, new RegExp(`^De ${pair.from} a ${pair.to}:`));
      assert.doesNotMatch(description, /siguiente|correct|debes elegir/i);
      if (pair.from > 0 && Number.isInteger(pair.to / pair.from)) assert.match(pairDescription(pair, 'ratio'), /veces la primera/);
    }
    assert.equal(pairs.at(-1).to, lesson.sequence.at(-1));
    assert.equal('correct' in lesson, false); assert.equal('rule' in lesson, false);
  }
});
