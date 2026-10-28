import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { getMission } from '../lib/catalog.js';
import { someInferenceCases } from '../lib/some-inference-cases.js';
import { screenExplanation } from '../lib/ai-guard.js';
import { assessLocally, advance, createSession, correctChoice } from '../lib/tutor.js';
const rows = [];
for (const item of someInferenceCases) {
  const lesson = getMission('logic').lessons.find(lesson => lesson.id === item.id);
  for (const expected of ['positive', 'negative']) for (const text of item[expected]) {
    const session = Object.assign(createSession({ missionId: 'logic' }), { lessonIds: [lesson.id], routeLength: 1 });
    await advance(session, { type: 'answer', choice: correctChoice(lesson) });
    await advance(session, { type: 'explain', text });
    const guard = screenExplanation(text, lesson);
    const observed = assessLocally(text, lesson);
    assert.equal(observed === 'supported', expected === 'positive', text);
    assert.equal(session.records.length === 1, expected === 'positive', text);
    rows.push({ lesson: lesson.id, text, expected: expected === 'positive' ? 'supported' : 'unclear', observed, guard, reply: session.messages.at(-1).text, phase: session.phase });
  }
}
const directory = new URL('../artifacts/algunos/', import.meta.url);
await mkdir(directory, { recursive: true });
const summary = { cases: rows.length, recognized: rows.filter(row => row.observed === 'supported').length, blockedInferences: rows.filter(row => row.guard?.reason === 'contradiction').length, providerCalls: 0 };
await writeFile(new URL('revision-offline.json', directory), JSON.stringify({ summary, note: 'Authored regression cases, not independent precision or educational validation.', rows }, null, 2));
console.log(JSON.stringify(summary));
