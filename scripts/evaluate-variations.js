import { mkdir, writeFile } from 'node:fs/promises';
import { variationCases } from '../lib/variation-cases.js';
import { assessLocally } from '../lib/reasoning.js';
import { screenExplanation } from '../lib/ai-guard.js';
import { aiAvailable, createAIService } from '../lib/ai.js';

const live = process.argv.includes('--live');
if (live && !aiAvailable()) { console.error('Falta la configuración de IA en .env.'); process.exit(1); }
const service = live ? createAIService() : null;
const results = [];
const group = process.argv.find(arg => arg.startsWith('--group='))?.slice(8);
const caseId = process.argv.find(arg => arg.startsWith('--case='))?.slice(7);
const selected = variationCases.filter(item => (!group || item.group === group) && (!caseId || item.id === caseId));
if (!selected.length) { console.error('Grupo de evaluación desconocido.'); process.exit(1); }
for (const example of selected) {
  let assessment = { source: 'local' };
  const screened = screenExplanation(example.text, example.lesson);
  const start = performance.now();
  const category = live
    ? await service.assess(example.text, example.lesson, { runId: example.lesson.id, onResult: value => { assessment = value; } })
    : screened?.category ?? assessLocally(example.text, example.lesson);
  if (!live && screened) assessment = { source: 'guard', reason: screened.reason };
  const passed = example.expect === 'not-supported' ? category !== 'supported' : category === example.expect;
  results.push({ case: example.id, group: example.group, expected: example.expect, category, ...assessment, passed, elapsedMs: Math.round(performance.now() - start) });
  if (live) console.log(JSON.stringify(results.at(-1)));
  if (live && assessment.source === 'local' && assessment.reason !== 'invalid-response') break;
}
const groups = Object.fromEntries([...new Set(variationCases.map(item => item.group))].map(group => {
  const rows = results.filter(item => item.group === group);
  return [group, { cases: rows.length, passed: rows.filter(item => item.passed).length }];
}));
const summary = { cases: results.length, planned: selected.length, passed: results.filter(item => item.passed).length, failed: results.filter(item => !item.passed).map(item => item.case), providerCalls: service?.status().calls ?? 0, sources: Object.fromEntries(['ai', 'guard', 'local'].map(source => [source, results.filter(item => item.source === source).length])), groups };
await mkdir(new URL('../artifacts/variaciones/', import.meta.url), { recursive: true });
await writeFile(new URL(`../artifacts/variaciones/${live ? 'ia' : 'local'}${caseId ? `-${caseId}` : group ? `-${group}` : ''}.json`, import.meta.url), JSON.stringify({ date: new Date().toISOString(), model: service?.status().model ?? null, note: 'Authored synthetic adult examples, one observation per case. Pipeline results include guards and fallback; not a representative accuracy estimate or an educator review.', summary, results }, null, 2));
console.log(JSON.stringify(summary));
if (results.length !== selected.length || summary.failed.length) process.exitCode = 1;
