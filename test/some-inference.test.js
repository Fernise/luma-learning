import test from 'node:test';
import assert from 'node:assert/strict';
import { getMission } from '../lib/catalog.js';
import { assessLocally, advance, createSession, correctChoice } from '../lib/tutor.js';
import { screenExplanation } from '../lib/ai-guard.js';
import { createAIService } from '../lib/ai.js';
import { followUpQuestion } from '../lib/follow-up.js';

const lessons = getMission('logic').lessons.filter(lesson => lesson.reasoningType === 'some');
import { someInferenceCases as cases } from '../lib/some-inference-cases.js';

test('some exercises reject unsupported exceptions and universal conclusions before a provider can credit them', async () => {
  const ai = createAIService({ env: { OPENAI_API_KEY: 'fixture-key', OPENAI_MODEL: 'simulated' }, fetchImpl: () => assert.fail('No external assessment expected') });
  for (const item of cases) {
    const lesson = lessons.find(lesson => lesson.id === item.id);
    for (const text of item.negative) {
      assert.notEqual(assessLocally(text, lesson), 'supported', text);
      assert.equal(screenExplanation(text, lesson)?.reason, 'contradiction', text);
      assert.equal(await ai.assess(text, lesson), 'unclear', text);
    }
  }
  assert.equal(ai.status().calls, 0);
});

test('possibilities, negated inferences and corrected prior claims still allow missing-evidence reasoning', () => {
  for (const item of cases) {
    const lesson = lessons.find(lesson => lesson.id === item.id);
    for (const text of item.positive) {
      assert.equal(screenExplanation(text, lesson), null, text);
      assert.equal(assessLocally(text, lesson), 'supported', text);
    }
  }
});

test('unsupported exception attempts cannot complete even a correct choice; supports progress to pause', async () => {
  for (const lesson of lessons) {
    const session = Object.assign(createSession({ missionId: 'logic' }), { lessonIds: [lesson.id], routeLength: 1 });
    await advance(session, { type: 'answer', choice: correctChoice(lesson) });
    const text = cases.find(item => item.id === lesson.id).negative[0];
    const options = { assess: () => assert.fail('A known unsupported inference must stay local') };
    await advance(session, { type: 'explain', text }, options);
    assert.match(session.messages.at(-1).text, /pista.*grupo.*característica/);
    assert.equal(session.messages.at(-2).text, text);
    for (let i = 0; i < 4 && !session.paused; i++) await advance(session, { type: 'explain', text }, options);
    assert.equal(session.paused, true);
    assert.equal(session.records.length, 0);
    await advance(session, { type: 'resume' });
    await advance(session, { type: 'explain', text: cases.find(item => item.id === lesson.id).positive[0] });
    assert.equal(session.records[0].reasoning, 'supported');
  }
});

test('the exception follow-up has one question and does not access solutions or raw learner text', () => {
  const lesson = new Proxy({ kind: 'logic', reasoningType: 'some' }, { get(target, key) { assert.ok(['kind', 'reasoningType'].includes(key)); return target[key]; } });
  const question = followUpQuestion(lesson, 'unsupported-exception');
  assert.equal((question.match(/\?/g) ?? []).length, 1);
  assert.doesNotMatch(question, /correcta|debes elegir|no todos|solo algunos|Luna|Pipo|Brisa|supported/);
  assert.equal(followUpQuestion({ kind: 'pattern' }, 'unsupported-exception'), null);
});
