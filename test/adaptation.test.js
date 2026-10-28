import test from 'node:test';
import assert from 'node:assert/strict';
import { getMission } from '../lib/catalog.js';
import { createSession, advance, currentLesson, correctChoice } from '../lib/tutor.js';
import { selectNext } from '../lib/adaptation.js';
import { validExplanation } from '../lib/evaluation-cases.js';

async function finish(session, support) {
  const lesson = currentLesson(session);
  if (support) { await advance(session, { type: 'hint' }); await advance(session, { type: 'hint' }); }
  await advance(session, { type: 'answer', choice: correctChoice(lesson) });
  if (session.phase === 'explain') {
    if (support) { await advance(session, { type: 'explain', text: 'He comparado las opciones.' }, { assess: () => 'unclear' }); await advance(session, { type: 'explain', text: 'Todavía no lo explico.' }, { assess: () => 'unclear' }); }
    else await advance(session, { type: 'explain', text: 'Mi razonamiento.' }, { assess: () => 'supported' });
  }
}

test('all combinations of supported and independent practice finish five unique activities with a practiced transfer skill', async () => {
  for (const missionId of ['fractions', 'patterns', 'logic']) for (let route = 0; route < 32; route++) {
    const session = createSession({ missionId, adaptive: true }); const seenSkills = [];
    for (let index = 0; index < 5; index++) {
      const lesson = currentLesson(session); const support = !!(route & (1 << index));
      if (index === 4) { assert.equal(lesson.transfer, true); assert.ok(seenSkills.includes(lesson.skill)); }
      else assert.equal(!!lesson.transfer, false);
      seenSkills.push(lesson.skill);
      await finish(session, support); await advance(session, { type: 'next' });
    }
    assert.equal(session.phase, 'finished'); assert.equal(session.records.length, 5); assert.equal(new Set(session.lessonIds).size, 5);
  }
});
test('support requests lead to an equally easy or easier next activity without labeling ability', async () => {
  const session = createSession({ missionId: 'fractions', adaptive: true });
  await finish(session, true); const level = currentLesson(session).level; await advance(session, { type: 'next' });
  assert.ok(currentLesson(session).level <= level); assert.equal(session.adaptation, 'more-support');
  assert.doesNotMatch(session.messages.at(-1).text, /malo|incapaz|suspend|nivel bajo/);
});
test('independent reasoning raises the next challenge within the authored bank', async () => {
  const session = createSession({ missionId: 'patterns', adaptive: true });
  await finish(session, false); await advance(session, { type: 'next' });
  assert.equal(currentLesson(session).level, 2); assert.equal(session.adaptation, 'more-challenge');
  assert.ok(getMission('patterns').lessons.some(lesson => lesson.id === currentLesson(session).id));
});

test('after a revision, same-concept practice outranks a closer level in another concept', () => {
  const lastLesson = { id: 'last', skill: 'add', level: 2 };
  const mission = { lessons: [lastLesson, { id: 'different', skill: 'double', level: 1 }, { id: 'same', skill: 'add', level: 2 }, { id: 'harder', skill: 'add', level: 3 }] };
  const selected = selectNext(mission, [{ reasoning: 'supported', unaided: true, reasoningAttempts: 2, attempts: 1, help: 0 }], ['last'], lastLesson);
  assert.equal(selected.lesson.id, 'same'); assert.equal(selected.reason, 'more-support');
});

test('even one hint retains concept practice, with no increase when an easier option remains', () => {
  const lastLesson = { id: 'last', skill: 'add', level: 1 };
  const mission = { lessons: [lastLesson, { id: 'different', skill: 'double', level: 1 }, { id: 'harder', skill: 'add', level: 2 }] };
  const selected = selectNext(mission, [{ reasoning: 'supported', unaided: false, reasoningAttempts: 1, attempts: 1, help: 1 }], ['last'], lastLesson);
  assert.equal(selected.lesson.id, 'different'); assert.equal(selected.reason, 'more-support');
});

test('a self-corrected explanation is recognized but does not raise challenge', async () => {
  const session = createSession({ missionId: 'patterns', adaptive: true });
  await advance(session, { type: 'answer', choice: correctChoice(currentLesson(session)) });
  await advance(session, { type: 'explain', text: 'He mirado los números.' });
  await advance(session, { type: 'explain', text: 'Sumo tres cada vez.' });
  assert.equal(session.records[0].reasoning, 'supported'); assert.equal(session.records[0].reasoningAttempts, 2);
  await advance(session, { type: 'next' });
  assert.equal(session.adaptation, 'more-support'); assert.equal(currentLesson(session).skill, 'add');
  assert.equal(currentLesson(session).level, 1);
});

test('changing a choice does not reset the count of explanation attempts', async () => {
  const session = createSession({ missionId: 'patterns', adaptive: true });
  await advance(session, { type: 'answer', choice: 1 });
  await advance(session, { type: 'explain', text: 'No sé cómo empezar.' });
  await advance(session, { type: 'answer', choice: 0 });
  await advance(session, { type: 'explain', text: 'Sumo tres cada vez.' });
  assert.equal(session.records[0].reasoningAttempts, 2);
});

test('two consecutive independent explanations allow a correct answer to move on, then reasoning resumes', async () => {
  const session = createSession({ missionId: 'patterns', adaptive: true });
  for (let index = 0; index < 2; index++) {
    const lesson = currentLesson(session);
    await advance(session, { type: 'answer', choice: correctChoice(lesson) });
    await advance(session, { type: 'explain', text: validExplanation(lesson) });
    await advance(session, { type: 'next' });
  }
  await advance(session, { type: 'answer', choice: correctChoice(currentLesson(session)) });
  assert.equal(session.phase, 'complete'); assert.equal(session.records[2].reasoning, 'not-requested');
  assert.equal(session.records[2].reasoningAttempts, 0);
  await advance(session, { type: 'next' });
  await advance(session, { type: 'answer', choice: correctChoice(currentLesson(session)) });
  assert.equal(session.phase, 'explain');
});

test('breathing room never bypasses a wrong choice, hint use or final-context explanation', async () => {
  for (const condition of ['wrong', 'hint', 'transfer']) {
    const session = createSession({ missionId: 'patterns', adaptive: true });
    session.records = [0, 1].map(() => ({ reasoning: 'supported', unaided: true, reasoningAttempts: 1 }));
    if (condition === 'transfer') session.lessonIds = ['flowers-transfer'];
    if (condition === 'hint') await advance(session, { type: 'hint' });
    const correct = correctChoice(currentLesson(session));
    await advance(session, { type: 'answer', choice: condition === 'wrong' ? 1 - correct : correct });
    assert.equal(session.phase, condition === 'wrong' ? 'reflect' : 'explain'); assert.equal(session.records.length, 2);
  }
});

test('legacy records without explanation counts cannot trigger a challenge increase or breathing room', () => {
  const lastLesson = { id: 'last', skill: 'add', level: 1 };
  const mission = { lessons: [lastLesson, { id: 'similar', skill: 'add', level: 1 }, { id: 'harder', skill: 'double', level: 2 }] };
  const selected = selectNext(mission, [{ reasoning: 'supported', unaided: true, attempts: 1, help: 0 }], ['last'], lastLesson);
  assert.equal(selected.lesson.id, 'similar'); assert.equal(selected.reason, 'practice');
});
