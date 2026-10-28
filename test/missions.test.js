import test from 'node:test';
import assert from 'node:assert/strict';
import { missions, getMission, missionInfo } from '../lib/catalog.js';
import { createSession, publicSession, advance, assessLocally, correctChoice } from '../lib/tutor.js';

const explanations = {
  steps: 'Se suma tres en cada paso.', doubling: 'Cada número es el doble del anterior.', countdown: 'Se restan cuatro en cada paso.', 'new-jumps': 'Se suman cinco cada vez.',
  boxes: 'Descarto la roja y la azul, solo queda la verde.', cards: 'Todas las tarjetas rojas tienen estrella y esta es roja.', some: 'Algunos no significa todos.', 'number-clues': 'El seis es par y está entre cuatro y ocho.',
};

test('fraction divisions and the allowed pattern-rule family are explicit in all authored contexts', () => {
  for (const lesson of getMission('fractions').lessons) assert.match(lesson.context, /partes iguales/, lesson.id);
  for (const lesson of getMission('patterns').lessons) assert.match(lesson.context, /una suma, una resta o un doble/, lesson.id);
  for (const lesson of getMission('logic').lessons.filter(lesson => lesson.reasoningType === 'bounds')) {
    assert.match(lesson.prompt, /estas opciones/, lesson.id);
    const [, low, high] = lesson.context.match(/mayor que (\d+) y menor que (\d+)/);
    const odd = /\bimpar\b/.test(lesson.context);
    assert.equal(lesson.options.filter(value => value > Number(low) && value < Number(high) && (value % 2 === 1) === odd).length, 1, lesson.id);
  }
});

test('each catalog activity has exactly one valid option and no answer key is public', () => {
  assert.equal(missions.flatMap(mission => mission.lessons).length, 36);
  for (const mission of missions) {
    assert.equal(new Set(mission.lessons.map(lesson => lesson.id)).size, mission.lessons.length);
    for (const lesson of mission.lessons) assert.ok([0, 1].includes(correctChoice(lesson)));
    const publicState = publicSession(createSession({ missionId: mission.id }));
    for (const secret of ['correct', 'reasoningPatterns', 'rubric', 'rule', 'step', 'hints', 'question', 'completion', 'skill', 'reasoningType']) assert.equal(secret in publicState.lesson, false);
    assert.equal('lessons' in missionInfo(mission), false);
  }
});

test('unknown missions cannot create a session', () => {
  assert.throws(() => createSession({ missionId: 'unreviewed-content' }));
  assert.throws(() => getMission(''));
});

test('patterns and logic complete independently with reviewed explanations and transfer records', async () => {
  for (const mission of missions.filter(mission => mission.id !== 'fractions')) {
    const session = createSession({ missionId: mission.id });
    for (const lesson of mission.defaultRoute.map(id => mission.lessons.find(item => item.id === id))) {
      assert.equal(assessLocally(explanations[lesson.id], lesson), 'supported', lesson.id);
      await advance(session, { type: 'answer', choice: correctChoice(lesson), confidence: 'fairly-sure' });
      if (session.phase === 'explain') await advance(session, { type: 'explain', text: explanations[lesson.id] });
      assert.equal(session.phase, 'complete', lesson.id);
      await advance(session, { type: 'next' });
    }
    assert.equal(session.phase, 'finished');
    assert.equal(session.records.length, 4);
    assert.equal(session.records.at(-1).transfer, true);
    assert.equal(session.records[0].confidence, 'fairly-sure');
  }
});

test('wrong choices stay unsolved even when a classifier accepts their explanation', async () => {
  for (const missionId of ['patterns', 'logic']) {
    const session = createSession({ missionId });
    const lesson = getMission(missionId).lessons[0];
    const state = await advance(session, { type: 'answer', choice: 1 - correctChoice(lesson) });
    assert.equal(state.phase, 'reflect');
    assert.match(state.messages.at(-1).text, /\?/);
    await advance(session, { type: 'explain', text: 'Mi explicación.' }, { assess: async () => 'supported' });
    assert.equal(session.records.length, 0);
    assert.notEqual(session.phase, 'complete');
  }
});

test('support is specific to the chosen activity and eventually offers a pause', async () => {
  const session = createSession({ missionId: 'patterns' });
  await advance(session, { type: 'hint' });
  assert.match(session.messages.at(-1).text, /números vecinos/);
  await advance(session, { type: 'hint' }); assert.equal(session.visual, true);
  await advance(session, { type: 'hint' });
  assert.doesNotMatch(session.messages.at(-1).text, /14|quince|correcta es/);
  await advance(session, { type: 'hint' }); assert.equal(session.paused, true);
});

test('confidence describes the first choice and cannot be rewritten by retries', async () => {
  const session = createSession({ missionId: 'patterns' });
  await advance(session, { type: 'answer', choice: 1, confidence: 'sure' });
  await advance(session, { type: 'answer', choice: 0, confidence: 'exploring' });
  await advance(session, { type: 'explain', text: explanations.steps });
  assert.equal(session.records[0].confidence, 'sure');
  assert.equal(session.records[0].unaided, false);
  await advance(session, { type: 'next' }); assert.equal(session.confidence, null);
  await assert.rejects(advance(session, { type: 'answer', choice: 0, confidence: 'mastered' }));
});

test('local logic interpretation does not confuse some with all or accept negated deductions', () => {
  const logic = getMission('logic').lessons;
  assert.notEqual(assessLocally('Algunos significa todos.', logic[2]), 'supported');
  assert.notEqual(assessLocally('No descarto la roja ni la azul.', logic[0]), 'supported');
  assert.notEqual(assessLocally('Todas las rojas no tienen estrella.', logic[1]), 'supported');
  assert.notEqual(assessLocally('Seis no es par y está entre cuatro y ocho.', logic[3]), 'supported');
});
