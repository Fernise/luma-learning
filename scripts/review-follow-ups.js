import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { missions, getMission } from '../lib/catalog.js';
import { createSession, advance, correctChoice } from '../lib/tutor.js';

// Offline, synthetic adult examples. No provider configuration or learner storage is loaded.
const results = [];
async function observe(missionId, lesson, choice, text, reason) {
  const session = createSession({ missionId }); session.lessonIds = [lesson.id]; session.routeLength = 1;
  await advance(session, { type: 'hint' });
  await advance(session, { type: 'answer', choice });
  let providerCalls = 0; let guard;
  await advance(session, { type: 'explain', text }, {
    assess: () => { providerCalls++; assert.fail('Known guard cases must not call an assessor'); },
    onGuard: value => { guard = value; },
  });
  assert.equal(guard.reason, reason); assert.equal(session.records.length, 0);
  results.push({ mission: missionId, activity: lesson.id, concept: lesson.skill, selectedOption: choice,
    input: text, guard: guard.reason, question: session.messages.at(-1).text,
    phase: session.phase, explanationAttempts: session.reasoningAttempts, providerCalls });
}
for (const mission of missions) for (const lesson of mission.lessons) for (const choice of [0, 1]) {
  const text = lesson.fractions ? lesson.fractions[choice].join('/') : String(lesson.options[choice]);
  await observe(mission.id, lesson, choice, text, 'answer-only');
}
for (const [missionId, id, text] of [
  ['fractions', 'pizza', 'Más partes hacen trozos más grandes.'],
  ['fractions', 'ribbon', 'Dos trozos son más que cuatro.'],
  ['patterns', 'steps', 'Sumo cuatro cada vez.'],
  ['patterns', 'doubling', 'Multiplico por tres.'],
  ['logic', 'cards', 'Todas tienen estrella porque una tiene estrella.'],
  ['logic', 'some', 'Algunos significa todos.'],
  ['logic', 'number-clues', 'Cinco es par.'],
]) {
  const lesson = getMission(missionId).lessons.find(item => item.id === id);
  await observe(missionId, lesson, correctChoice(lesson), text, 'contradiction');
}
const report = { date: new Date().toISOString(), note: 'Synthetic authored examples for adult review. These checks establish guard routing and state preservation, not pedagogical quality, classifier accuracy or learning impact.',
  summary: { cases: results.length, answerOnly: results.filter(row => row.guard === 'answer-only').length,
    contradictions: results.filter(row => row.guard === 'contradiction').length, providerCalls: 0 }, results };
const folder = new URL('../artifacts/noche-preguntas/', import.meta.url);
await mkdir(folder, { recursive: true });
await writeFile(new URL('revision-offline.json', folder), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report.summary));
