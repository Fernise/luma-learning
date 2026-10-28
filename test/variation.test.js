import test from 'node:test';
import assert from 'node:assert/strict';
import { variationCases } from '../lib/variation-cases.js';
import { assessLocally } from '../lib/reasoning.js';
import { screenExplanation } from '../lib/ai-guard.js';
import { advance, createSession, correctChoice } from '../lib/tutor.js';

for (const group of ['spelling', 'paraphrase', 'incomplete', 'misconception', 'uncertainty']) test(`local tutoring handles authored ${group} variations`, () => {
  for (const example of variationCases.filter(item => item.group === group)) {
    const category = screenExplanation(example.text, example.lesson)?.category ?? assessLocally(example.text, example.lesson);
    if (example.expect === 'not-supported') assert.notEqual(category, 'supported', example.id);
    else assert.equal(category, example.expect, example.id);
  }
});

test('every varied valid explanation can complete its exercise, while no explanation overrides a wrong choice', async () => {
  for (const example of variationCases.filter(item => item.expect === 'supported')) {
    const missionId = example.lesson.fractions ? 'fractions' : example.lesson.kind === 'pattern' ? 'patterns' : 'logic';
    for (const wrong of [false, true]) {
      const session = createSession({ missionId }); session.lessonIds = [example.lesson.id];
      await advance(session, { type: 'answer', choice: wrong ? 1 - correctChoice(example.lesson) : correctChoice(example.lesson) });
      if (session.phase !== 'complete') await advance(session, { type: 'explain', text: example.text });
      assert.equal(session.phase === 'complete', !wrong, example.id);
    }
  }
});

test('new explicit numerical and universal-rule contradictions resist even a permissive classifier', async () => {
  for (const id of ['misconception-3-ribbon', 'misconception-6-doubling', 'misconception-9-cards']) {
    const example = variationCases.find(item => item.id === id);
    const session = createSession({ missionId: example.lesson.fractions ? 'fractions' : example.lesson.kind === 'pattern' ? 'patterns' : 'logic' });
    session.lessonIds = [example.lesson.id];
    await advance(session, { type: 'hint' });
    await advance(session, { type: 'answer', choice: correctChoice(example.lesson) });
    for (let i = 0; i < 2; i++) await advance(session, { type: 'explain', text: example.text }, { assess: () => 'supported' });
    assert.notEqual(session.phase, 'complete', id); assert.equal(session.records.length, 0);
  }
});

test('answer-only explanations cannot be recognized by a permissive classifier and do not consume an AI call', async () => {
  for (const example of variationCases.filter(item => ['incomplete-8-boxes', 'incomplete-9-cards'].includes(item.id))) {
    let calls = 0;
    const session = createSession({ missionId: 'logic' }); session.lessonIds = [example.lesson.id];
    await advance(session, { type: 'answer', choice: correctChoice(example.lesson) });
    await advance(session, { type: 'explain', text: example.text }, { assess: () => { calls++; return 'supported'; } });
    assert.equal(session.phase, 'explain'); assert.equal(session.records.length, 0); assert.equal(calls, 0);
    await advance(session, { type: 'explain', text: example.text }, { assess: () => { calls++; return 'supported'; } });
    assert.equal(session.records[0].reasoning, 'needs-review'); assert.equal(calls, 0);
  }
});
