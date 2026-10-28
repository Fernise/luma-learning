import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { getMission } from '../lib/catalog.js';
import { allInferenceCases } from '../lib/all-inference-cases.js';
import { screenExplanation } from '../lib/ai-guard.js';
import { assessLocally, advance, createSession, correctChoice } from '../lib/tutor.js';
const rows = [];
for (const item of allInferenceCases) {
  const lesson = getMission('logic').lessons.find(lesson => lesson.id === item.id);
  for (const group of ['positive', 'negative', 'possibilities']) for (const text of item[group]) {
    const session = Object.assign(createSession({ missionId: 'logic' }), { lessonIds: [lesson.id], routeLength: 1 });
    await advance(session, { type: 'answer', choice: correctChoice(lesson) });
    await advance(session, { type: 'explain', text });
    const guard = screenExplanation(text, lesson);
    const observed = assessLocally(text, lesson);
    assert.equal(observed === 'supported', group === 'positive', text);
    assert.equal(session.records.length === 1, group === 'positive', text);
    rows.push({ lesson: lesson.id, group, text, observed, guard, reply: session.messages.at(-1).text, phase: session.phase });
  }
}
const directory = new URL('../artifacts/reglas-todos/', import.meta.url);
await mkdir(directory, { recursive: true });
const summary = { cases: rows.length, recognized: rows.filter(row => row.observed === 'supported').length, guardedExclusions: rows.filter(row => row.guard?.detail === 'unsupported-exclusion').length, clarifiedAmbiguities: rows.filter(row => row.guard?.detail === 'ambiguous-quantity').length, guardedConverse: rows.filter(row => row.guard?.detail === 'unsupported-converse').length, guardedRuleDenials: rows.filter(row => row.guard?.detail === 'negated-rule').length, providerCalls: 0 };
await writeFile(new URL('revision-offline.json', directory), JSON.stringify({ summary, note: 'Authored regression examples; not independent precision or educational validation.', rows }, null, 2));
console.log(JSON.stringify(summary));
