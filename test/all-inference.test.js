import test from 'node:test';
import assert from 'node:assert/strict';
import { getMission } from '../lib/catalog.js';
import { allInferenceCases } from '../lib/all-inference-cases.js';
import { assessLocally, advance, createSession, correctChoice } from '../lib/tutor.js';
import { screenExplanation } from '../lib/ai-guard.js';
import { createAIService } from '../lib/ai.js';
import { followUpQuestion } from '../lib/follow-up.js';
const find = id => getMission('logic').lessons.find(lesson => lesson.id === id);

test('universal proofs remain recognized when a separate extra-property clause states missing evidence', () => {
  for (const item of allInferenceCases) for (const text of item.positive) {
    assert.equal(screenExplanation(text, find(item.id)), null, text);
    assert.equal(assessLocally(text, find(item.id)), 'supported', text);
  }
  assert.notEqual(assessLocally('No sabemos si tiene un círculo.', find('cards')), 'supported');
});
test('explicit exclusions and exclusivity cannot be credited by a permissive provider or by repetition', async () => {
  const ai = createAIService({ env: { OPENAI_API_KEY: 'fixture-key', OPENAI_MODEL: 'simulated' }, fetchImpl: () => assert.fail('Do not call a provider') });
  for (const item of allInferenceCases) for (const text of item.negative) {
    const lesson = find(item.id);
    assert.notEqual(assessLocally(text, lesson), 'supported', text);
    assert.ok(['unsupported-exclusion', 'unsupported-converse', 'negated-rule', 'ambiguous-quantity'].includes(screenExplanation(text, lesson)?.detail), text);
    assert.equal(await ai.assess(text, lesson), 'unclear');
    const session = Object.assign(createSession({ missionId: 'logic' }), { lessonIds: [lesson.id], routeLength: 1 });
    await advance(session, { type: 'answer', choice: correctChoice(lesson) });
    for (let i = 0; i < 2; i++) await advance(session, { type: 'explain', text }, { assess: () => assert.fail('Known exclusion must stay local') });
    assert.equal(session.records.length, 0);
    assert.notEqual(session.phase, 'complete');
  }
  assert.equal(ai.status().calls, 0);
});
test('uncertain or negated exclusion assertions remain available without automatically crediting a proof', () => {
  for (const item of allInferenceCases) for (const text of item.possibilities) {
    assert.equal(screenExplanation(text, find(item.id)), null, text);
    assert.notEqual(assessLocally(text, find(item.id)), 'supported', text);
  }
});
test('the exclusion follow-up asks one check without accessing solutions or injecting learner text', () => {
  const lesson = new Proxy({ kind: 'logic', reasoningType: 'all' }, { get(target, key) { assert.ok(['kind', 'reasoningType'].includes(key)); return target[key]; } });
  const question = followUpQuestion(lesson, 'unsupported-exclusion');
  assert.equal((question.match(/\?/g) ?? []).length, 1);
  assert.doesNotMatch(question, /estrella|círculo|luna|sol|jardín|observatorio|correcta|supported/);
});

test('direction questions stay solution-free and explicit denials cannot be credited by negating unrelated facts', () => {
  const lesson = new Proxy({ kind: 'logic', reasoningType: 'all' }, { get(target, key) { assert.ok(['kind', 'reasoningType'].includes(key)); return target[key]; } });
  for (const detail of ['unsupported-converse', 'negated-rule', 'ambiguous-quantity']) {
    const question = followUpQuestion(lesson, detail);
    assert.equal((question.match(/\?/g) ?? []).length, 1);
    assert.doesNotMatch(question, /\b(?:estrella|círculo|luna|sol|jardín|observatorio|roja|azul|verde)\b/);
  }
  for (const text of [
    'No sabemos si tiene un círculo y tiene estrella por eso es roja.',
    'Pensaba que no tiene un círculo, pero todas las rojas tienen estrella y tiene estrella por eso es roja.',
    'No sabemos si tiene un círculo. Las rojas no tienen estrella.',
  ]) assert.equal(screenExplanation(text, find('cards'))?.reason, 'contradiction', text);
  assert.notEqual(assessLocally('Tener una estrella no significa que sea roja.', find('cards')), 'supported');
});

test('single-drawing exclusivity is clarified as ambiguity rather than asserted to be false', () => {
  assert.equal(screenExplanation('Todas las rojas tienen estrella. Solo tiene una estrella.', find('cards')).detail, 'ambiguous-quantity');
  assert.equal(screenExplanation('Todas las verdes tienen luna. Solo tiene una luna.', find('badges-transfer')).detail, 'ambiguous-quantity');
  assert.equal(screenExplanation('Todas las azules permiten entrar al observatorio. Solo permite entrar al observatorio.', find('tickets')).detail, 'unsupported-exclusion');
});
