import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { missions } from '../lib/catalog.js';
import { freshEvaluationCases } from '../lib/fresh-evaluation-cases.js';
import { screenExplanation } from '../lib/ai-guard.js';
import { assessLocally } from '../lib/reasoning.js';
const results = freshEvaluationCases.map(item => {
 const lesson = missions.flatMap(m => m.lessons).find(l => l.id === item.lessonId);
 const guard = screenExplanation(item.text, lesson); const category = guard?.category ?? assessLocally(item.text, lesson);
 const classificationOK = item.expect === 'not-supported' ? category !== 'supported' : category === item.expect;
 return { ...item, category, guard: guard ?? null, passed: classificationOK && (!item.guardRequired || !!guard) };
});
const summary = { total: results.length, passed: results.filter(r=>r.passed).length, failed: results.filter(r=>!r.passed).map(r=>r.id), coverage: new Set(results.map(r=>r.lessonId)).size, realProviderCalls: 0 };
await mkdir(new URL('../artifacts/revision-provisional/',import.meta.url),{recursive:true});
await writeFile(new URL(`../artifacts/revision-provisional/${process.argv.includes('--baseline') ? 'primera-ejecucion' : 'final'}.json`,import.meta.url),JSON.stringify({ date:new Date().toISOString(), corpusHash:createHash('sha256').update(JSON.stringify(freshEvaluationCases)).digest('hex'), note:'Synthetic authored expectations frozen before engine corrections. Post-fix examples are regressions, not independent or representative child accuracy. Guard-required cases also test a permissive simulated classifier boundary.', summary, results },null,2)+'\n',process.argv.includes('--baseline')?{flag:'wx'}:undefined);
console.log(JSON.stringify(summary));
if(summary.failed.length)process.exitCode=1;
