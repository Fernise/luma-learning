// Opt-in live evaluation: at most 48 provider calls; attacks are checked locally.
import { mkdir, writeFile } from 'node:fs/promises';
import { aiAvailable, createAIService } from '../lib/ai.js';
import { attackTexts, precisionCases } from '../lib/evaluation-cases.js';
import { getMission } from '../lib/catalog.js';

if (!aiAvailable()) { console.error('Falta la configuración de IA en .env.'); process.exit(1); }
const service = createAIService();
const negativeOnly = process.argv.includes('--negative-only');
const results = [];
const selected = [...precisionCases.filter(item => !negativeOnly || item.expect !== 'supported'), ...attackTexts.map((text, index) => ({ id: `attack-${index}`, lesson: getMission('fractions').lessons[0], text, expect: 'blocked' }))];
for (const example of selected) {
  let assessment;
  const start = performance.now();
  const category = await service.assess(example.text, example.lesson, { runId: example.lesson.id, onResult: value => { assessment = value; } });
  const interpreted = ['ai', 'guard'].includes(assessment.source) || (assessment.source === 'local' && assessment.reason === 'invalid-response');
  const passed = example.expect === 'supported' ? category === 'supported' && assessment.source === 'ai' : example.expect === 'blocked' ? category === 'off-topic' && assessment.source === 'guard' : category !== 'supported' && interpreted;
  const result = { case: example.id, expected: example.expect, category, ...assessment, passed, elapsedMs: Math.round(performance.now() - start) };
  results.push(result); console.log(JSON.stringify(result));
  if (assessment.source === 'local' && assessment.reason !== 'invalid-response') break;
}
const summary = { cases: results.length, passed: results.filter(item => item.passed).length, failed: results.filter(item => !item.passed).map(item => item.case), providerCalls: service.status().calls, validationFallbacks: results.filter(item => item.source === 'local' && item.reason === 'invalid-response').length };
await mkdir(new URL('../artifacts/ia-control/', import.meta.url), { recursive: true });
await writeFile(new URL(`../artifacts/ia-control/${negativeOnly ? 'evaluacion-negativos' : 'evaluacion'}.json`, import.meta.url), JSON.stringify({ date: new Date().toISOString(), model: service.status().model, note: 'One attempt per synthetic example; not a representative accuracy estimate. Invalid provider output may be handled by the local assessor; see validationFallbacks.', summary, results }, null, 2));
console.log(JSON.stringify(summary));
if (results.length !== selected.length || summary.failed.length) process.exitCode = 1;
