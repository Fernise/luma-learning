import test from 'node:test';
import assert from 'node:assert/strict';
import { screenExplanation } from '../lib/ai-guard.js';
import { attackTexts, precisionCases } from '../lib/evaluation-cases.js';
import { getMission } from '../lib/catalog.js';
import { createAIService, assessWithAI } from '../lib/ai.js';
import { createSession, advance, correctChoice } from '../lib/tutor.js';

const env = { OPENAI_API_KEY: 'fake-test-key', OPENAI_MODEL: 'test-model' };
const pizza = getMission('fractions').lessons[0];

test('all 36 valid explanations pass the input guard', () => {
  for (const example of precisionCases.filter(item => item.expect === 'supported')) assert.equal(screenExplanation(example.text, example.lesson), null, example.id);
});

test('25 attacks and unrelated requests are redirected without any provider calls', async () => {
  const service = createAIService({ env, fetchImpl: () => { assert.fail('A rejected input must not reach OpenAI'); } });
  for (const text of attackTexts) {
    assert.equal(screenExplanation(text, pizza)?.category, 'off-topic', text);
    let assessment;
    assert.equal(await service.assess(text, pizza, { onResult: value => { assessment = value; } }), 'off-topic', text);
    assert.equal(assessment.source, 'guard');
  }
  assert.equal(service.status().calls, 0);
});

test('the direct adapter also blocks control requests and malformed input', async () => {
  for (const text of [attackTexts[0], 'x'.repeat(601), '', '\u0000']) {
    assert.equal(await assessWithAI(text, pizza, { env, fetchImpl: () => { assert.fail('No request expected'); } }), 'off-topic');
  }
});

test('the tutor rejects injected instructions even with a permissive assessor and a correct choice', async () => {
  for (const text of attackTexts) {
    const session = createSession();
    await advance(session, { type: 'answer', choice: correctChoice(pizza) });
    await advance(session, { type: 'explain', text }, { assess: () => { assert.fail('The assessor must not see control requests'); } });
    assert.equal(session.records.length, 0, text); assert.equal(session.phase, 'explain');
    assert.match(session.messages.at(-1).text, /centrarnos en tu idea/);
    assert.doesNotMatch(session.messages.at(-1).text, /supported|OPENAI_API_KEY|System:/);
  }
});

test('known contradictions cannot become supported or needs-review after repeated attempts', async () => {
  for (const [missionId, lessonId, text] of [
    ['fractions', 'pizza', 'Más partes hacen trozos más grandes.'],
    ['patterns', 'steps', 'Sumo cuatro cada vez.'],
    ['patterns', 'doubling', 'Multiplico por tres.'],
    ['logic', 'some', 'Algunos significa todos.'],
    ['logic', 'number-clues', 'Cinco es par.'],
  ]) {
    const lesson = getMission(missionId).lessons.find(item => item.id === lessonId);
    assert.equal(screenExplanation(text, lesson)?.reason, 'contradiction', text);
    const session = createSession({ missionId }); session.lessonIds = [lesson.id]; session.routeLength = 1;
    await advance(session, { type: 'answer', choice: correctChoice(lesson) });
    for (let i = 0; i < 2; i++) await advance(session, { type: 'explain', text }, { assess: () => { assert.fail('Known contradictions must not reach the assessor'); } });
    assert.equal(session.records.length, 0); assert.notEqual(session.phase, 'complete');
  }
});

test('valid negation, uncertainty and analogies remain available', () => {
  for (const text of ['No sumo dos; sumo tres cada vez.', 'Van de tres en tres.', 'Lo veo como repartir la pizza entre mis amigos.']) assert.equal(screenExplanation(text, text.includes('sumo') || text.includes('tres') ? getMission('patterns').lessons[0] : pizza), null, text);
});

test('simple uncertainty is handled locally instead of rejected or sent to a provider', () => {
  for (const text of ['No me sale.', 'No consigo explicarlo.']) assert.deepEqual(screenExplanation(text, pizza), { category: 'unsure', reason: 'support-request' });
});

test('repeated pause requests cannot bypass the turn or conversation limits', async () => {
  const session = createSession();
  for (let i = 0; i < 80; i++) await advance(session, { type: i % 2 ? 'resume' : 'pause' });
  assert.equal(session.messages.length, 30); assert.equal(session.totalTurns, 80);
  const before = structuredClone(session);
  await assert.rejects(advance(session, { type: 'pause' }), /límite/);
  assert.deepEqual(session, before);
});
