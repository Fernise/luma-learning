import test from 'node:test';
import assert from 'node:assert/strict';
import { aiAvailable, assessWithAI, createAIService } from '../lib/ai.js';
import { lessons } from '../lib/tutor.js';

const env = { OPENAI_API_KEY: 'test-placeholder', OPENAI_MODEL: 'test-model' };
const success = () => ({ ok: true, json: async () => ({ status: 'completed', output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: '{"category":"supported"}' }] }] }) });

test('blank credentials do not configure AI', () => {
  assert.equal(aiAvailable({ OPENAI_API_KEY: ' ', OPENAI_MODEL: 'model' }), false);
  assert.equal(aiAvailable({ OPENAI_API_KEY: 'key', OPENAI_MODEL: '\n' }), false);
});

test('malformed, extra or refused output falls back without displaying provider text', async () => {
  for (const output of ['null', '[]', '{"category":"supported","answer":"secret solution"}', '{"category":42}', 'broken']) {
    let result;
    const category = await assessWithAI('No sé por qué elegí esa opción.', lessons[0], { env, fetchImpl: async () => ({ ok: true, json: async () => ({ status: 'completed', output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: output }] }] }) }), onResult: value => { result = value; } });
    assert.equal(category, 'unsure'); assert.deepEqual(result, { source: 'local', reason: 'invalid-response' });
  }
  const category = await assessWithAI('No sé por qué elegí esa opción.', lessons[0], { env, fetchImpl: async () => ({ ok: true, json: async () => ({ status: 'completed', output: [{ type: 'message', role: 'assistant', content: [{ type: 'refusal' }, { type: 'output_text', text: '{"category":"supported"}' }] }] }) }) });
  assert.equal(category, 'unsure');
});

test('global call cap is reserved atomically across concurrent sessions', async () => {
  let calls = 0;
  const service = createAIService({ env: { ...env, LUMA_AI_MAX_CALLS: '2' }, fetchImpl: async () => { calls++; return success(); } });
  const results = await Promise.all(Array.from({ length: 5 }, (_, i) => service.assess('No sé por qué elegí esa opción.', lessons[0], { runId: `run-${i}` })));
  assert.equal(calls, 2); assert.deepEqual(results, ['supported', 'supported', 'unsure', 'unsure', 'unsure']);
  assert.equal(service.status().successes, 2); assert.equal(service.status().blockedReason, 'limit');
});

test('a fraction-specific category cannot be applied to logic or patterns', async () => {
  let result;
  const category = await assessWithAI('No sé por qué elegí esa opción.', { kind: 'logic' }, { env, fetchImpl: async () => ({ ok: true, json: async () => ({ status: 'completed', output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: '{"category":"denominator-error"}' }] }] }) }), onResult: value => { result = value; } });
  assert.equal(category, 'unsure'); assert.deepEqual(result, { source: 'local', reason: 'invalid-response' });
});

test('each expedition has a separate ten-call cap and caps cannot exceed one hundred', async () => {
  let calls = 0;
  const service = createAIService({ env: { ...env, LUMA_AI_MAX_CALLS: '999' }, fetchImpl: async () => { calls++; return success(); } });
  for (let i = 0; i < 11; i++) await service.assess('No sé por qué elegí esa opción.', lessons[0], { runId: 'first' });
  await service.assess('No sé por qué elegí esa opción.', lessons[0], { runId: 'second' });
  assert.equal(calls, 11); assert.equal(service.status().maxCalls, 100);
});

test('credentials and quota errors stop repeat requests without exposing provider messages', async () => {
  for (const [status, code, reason] of [[401, 'invalid_api_key', 'credentials'], [429, 'insufficient_quota', 'quota'], [403, null, 'access'], [404, 'model_not_found', 'model']]) {
    let calls = 0;
    const service = createAIService({ env, fetchImpl: async () => { calls++; return { ok: false, status, json: async () => ({ error: { code, message: 'private provider diagnostic' } }) }; } });
    for (let i = 0; i < 3; i++) assert.equal(await service.assess('No sé por qué elegí esa opción.', lessons[0]), 'unsure');
    assert.equal(calls, 1); assert.equal(service.status().blockedReason, reason);
    assert.equal(JSON.stringify(service.status()).includes('private provider diagnostic'), false);
    assert.equal(JSON.stringify(service.status()).includes(env.OPENAI_API_KEY), false);
  }
});

test('temporary errors wait before retrying and failed calls count toward the cap', async () => {
  let time = 0, calls = 0;
  const service = createAIService({ env, now: () => time, fetchImpl: async () => { calls++; if (calls === 1) throw new Error('private network detail'); return success(); } });
  assert.equal(await service.assess('No sé por qué elegí esa opción.', lessons[0]), 'unsure');
  assert.equal(await service.assess('No sé por qué elegí esa opción.', lessons[0]), 'unsure'); assert.equal(calls, 1);
  time = 30000;
  assert.equal(await service.assess('No sé por qué elegí esa opción.', lessons[0]), 'supported'); assert.equal(calls, 2);
  assert.equal(service.status().calls, 2); assert.equal(service.status().blockedReason, null);
});

test('a zero cap and unconfigured mode never call the provider', async () => {
  for (const config of [{ ...env, LUMA_AI_MAX_CALLS: '0' }, {}]) {
    const service = createAIService({ env: config, fetchImpl: async () => { assert.fail('Provider must not be called'); } });
    assert.equal(await service.assess('No sé por qué elegí esa opción.', lessons[0]), 'unsure'); assert.equal(service.status().calls, 0);
  }
});

test('tool calls, extra messages and oversized provider content are rejected', async () => {
  const message = { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: '{"category":"supported"}' }] };
  for (const output of [[{ type: 'function_call', name: 'read_file', arguments: '{}' }, message], [message, message], [{ ...message, role: 'user' }], [{ ...message, content: [{ type: 'output_text', text: 'x'.repeat(257) }] }]]) {
    let result;
    const category = await assessWithAI('No sé por qué elegí esa opción.', lessons[0], { env, fetchImpl: async () => ({ ok: true, json: async () => ({ status: 'completed', output }) }), onResult: value => { result = value; } });
    assert.equal(category, 'unsure'); assert.deepEqual(result, { source: 'local', reason: 'invalid-response' });
  }
});
