import test from 'node:test';
import assert from 'node:assert/strict';
import { missions, getMission } from '../lib/catalog.js';
import { createSession, advance, correctChoice } from '../lib/tutor.js';
import { followUpQuestion } from '../lib/follow-up.js';
import { screenExplanation } from '../lib/ai-guard.js';

function sessionFor(missionId, lesson) {
  const session = createSession({ missionId });
  session.lessonIds = [lesson.id]; session.routeLength = 1;
  return session;
}
const forbiddenClaim = /comprendido|dominas|has entendido|has comprobado|correcta es|debes elegir/i;

test('every authored follow-up asks one question without consulting answers or quoting learner text', () => {
  for (const lesson of missions.flatMap(mission => mission.lessons)) {
    const restricted = new Proxy(lesson, { get(target, key) {
      assert.ok(['kind', 'reasoningType'].includes(key), `Unexpected answer/context access: ${String(key)}`);
      return target[key];
    } });
    for (const reason of ['answer-only', 'contradiction']) {
      const reply = followUpQuestion(restricted, reason);
      assert.equal((reply.match(/¿/g) ?? []).length, 1, lesson.id);
      assert.equal((reply.match(/\?/g) ?? []).length, 1, lesson.id);
      assert.doesNotMatch(reply, forbiddenClaim, lesson.id);
      assert.doesNotMatch(reply, /\d|supported|denominator-error|contradiction|answer-only/, lesson.id);
    }
  }
  assert.equal(followUpQuestion({ kind: 'unreviewed' }, 'contradiction'), null);
  assert.equal(followUpQuestion({ kind: 'pattern' }, 'instruction'), null);
});

test('repeating either option first requests evidence in all 36 activities without calling an assessor', async () => {
  for (const mission of missions) for (const lesson of mission.lessons) for (const choice of [0, 1]) {
    const session = sessionFor(mission.id, lesson);
    // One support request keeps even an otherwise direct correct choice open for explanation.
    await advance(session, { type: 'hint' });
    await advance(session, { type: 'answer', choice });
    const text = lesson.fractions ? lesson.fractions[choice].join('/') : String(lesson.options[choice]);
    assert.equal(screenExplanation(text, lesson)?.reason, 'answer-only', lesson.id);
    await advance(session, { type: 'explain', text }, { assess: () => assert.fail('A repeated option must stay local') });
    const reply = session.messages.at(-1).text;
    assert.match(reply, /Has indicado tu elección\./, lesson.id);
    assert.doesNotMatch(reply, forbiddenClaim, lesson.id);
    assert.equal(session.records.length, 0, lesson.id);
    assert.equal(session.messages.at(-2).text, text, 'The original explanation must be preserved');
    await advance(session, { type: 'explain', text }, { assess: () => assert.fail('No provider call expected') });
    if (choice === correctChoice(lesson)) {
      assert.equal(session.records[0].reasoning, 'needs-review', lesson.id);
      assert.equal(session.records[0].reasoningAttempts, 2, lesson.id);
    } else assert.equal(session.records.length, 0, lesson.id);
  }
});

test('known contradictions request a relevant check, retain the original text and progress to support', async () => {
  for (const [missionId, id, text, check] of [
    ['fractions', 'pizza', 'Más partes hacen trozos más grandes.', /tamaño de cada parte/],
    ['fractions', 'ribbon', 'Dos trozos son más que cuatro.', /mismo tamaño/],
    ['patterns', 'steps', 'Sumo cuatro cada vez.', /primera pareja/],
    ['patterns', 'doubling', 'Multiplico por tres.', /primera pareja/],
    ['logic', 'cards', 'Todas tienen estrella porque una tiene estrella.', /todo el grupo/],
    ['logic', 'some', 'Algunos significa todos.', /todo el grupo/],
    ['logic', 'number-clues', 'Cinco es par.', /condición que has mencionado/],
  ]) {
    const lesson = getMission(missionId).lessons.find(item => item.id === id);
    const session = sessionFor(missionId, lesson);
    await advance(session, { type: 'hint' });
    await advance(session, { type: 'answer', choice: correctChoice(lesson) });
    assert.equal(screenExplanation(text, lesson)?.reason, 'contradiction', id);
    const noProvider = { assess: () => assert.fail('A known contradiction must stay local') };
    await advance(session, { type: 'explain', text }, noProvider);
    assert.match(session.messages.at(-1).text, check, id);
    assert.doesNotMatch(session.messages.at(-1).text, forbiddenClaim, id);
    assert.equal(session.messages.at(-2).text, text, id);
    for (let i = 0; i < 3; i++) await advance(session, { type: 'explain', text }, noProvider);
    assert.equal(session.records.length, 0, id);
    assert.equal(session.paused, true, id);
    assert.equal(session.visual, true, id);
  }
});

test('uncertainty still receives progressive help and is not described as a contradiction', async () => {
  for (const mission of missions) {
    const lesson = mission.lessons[0]; const session = sessionFor(mission.id, lesson);
    await advance(session, { type: 'answer', choice: 1 - correctChoice(lesson) });
    await advance(session, { type: 'explain', text: 'No entiendo.' });
    assert.equal(session.help, 1, mission.id);
    assert.equal(session.records.length, 0, mission.id);
    assert.doesNotMatch(session.messages.at(-1).text, /Has indicado tu elección|Vamos a comprobar esa idea|has comprendido/, mission.id);
  }
});
