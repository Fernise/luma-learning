import test from 'node:test';
import assert from 'node:assert/strict';
import { missions } from '../lib/catalog.js';
import { freshEvaluationCases } from '../lib/fresh-evaluation-cases.js';
import { screenExplanation } from '../lib/ai-guard.js';
import { assessLocally } from '../lib/reasoning.js';
import { createSession, advance, correctChoice } from '../lib/tutor.js';
import { pedagogicalReview } from '../lib/pedagogical-review.js';
import { falseMathClaim, patternArithmeticEvidence } from '../lib/math-claims.js';

for (const item of freshEvaluationCases) test(`new corpus: ${item.id}`, async () => {
 const mission=missions.find(m=>m.lessons.some(l=>l.id===item.lessonId));const lesson=mission.lessons.find(l=>l.id===item.lessonId);
 const guard=screenExplanation(item.text,lesson);const category=guard?.category??assessLocally(item.text,lesson);
 if(item.expect==='not-supported')assert.notEqual(category,'supported');else assert.equal(category,item.expect);
 if(item.guardRequired)assert.ok(guard,'A permissive provider must not bypass the guard');
 for(const choice of [correctChoice(lesson),1-correctChoice(lesson)]) {
  const session=createSession({missionId:mission.id});session.lessonIds=[lesson.id];session.routeLength=1;
  await advance(session,{type:'hint'});await advance(session,{type:'answer',choice});let calls=0;
  const options=item.guardRequired?{assess:()=>{calls++;return 'supported';}}:{};
  await advance(session,{type:'explain',text:item.text},options);
  if(choice!==correctChoice(lesson))assert.equal(session.records.length,0,'No explanation may override a wrong selection');
  else if(item.expect==='supported')assert.equal(session.records[0]?.reasoning,'supported');
  else assert.notEqual(session.records[0]?.reasoning,'supported');
  if(item.guardRequired){assert.equal(calls,0);await advance(session,{type:'explain',text:item.text},options);assert.equal(session.records.length,0);assert.equal(calls,0);}
  assert.ok(session.messages.some(m=>m.role==='student'&&m.text===item.text));
 }
});

test('provisional pedagogy covers every activity without granting human approval or numeric age labels', () => {
 assert.equal(new Set(freshEvaluationCases.map(c=>c.lessonId)).size,36);
 for(const lesson of missions.flatMap(m=>m.lessons)) {
  const review=pedagogicalReview(lesson);assert.match(review.source,/IA/);assert.match(review.status,/provisional/);
  for(const key of ['objective','prerequisites','younger','older','observation','ageScope'])assert.ok(review[key]);
  assert.equal(lesson.review,'pending');
 }
});
test('literal calculations cannot be bypassed by unrelated uncertainty or correct arithmetic elsewhere', () => {
 for(const text of ['no se, 2 + 3 = 6','2 + 3 = 5 y 5 + 3 = 9','1/0 > 1/3','3/8 > 3/4','6 es menor que 4'])assert.equal(falseMathClaim(text),true,text);
 for(const text of ['2 + 3 = 5','2 × 2 = 4','3/4 > 3/8','no es cierto que 1/4 > 1/3','antes pensaba que 2 + 3 = 6. ahora 2 + 3 = 5'])assert.equal(falseMathClaim(text),false,text);
});
test('two different context pairs are required when arithmetic expressions serve as pattern evidence', () => {
 const lesson=missions.find(m=>m.id==='patterns').lessons[0];
 assert.equal(patternArithmeticEvidence('2 + 3 = 5 y 5 + 3 = 8',lesson),true);
 for(const text of ['2 + 3 = 5','2 + 3 = 5 y 2 + 3 = 5','20 + 3 = 23 y 23 + 3 = 26','2 + 3 = 5 y 5 + 4 = 9'])assert.equal(patternArithmeticEvidence(text,lesson),false,text);
});
test('initial and correct-choice questions contain a single question in all activities without giving a solution', async () => {
 for(const mission of missions)for(const lesson of mission.lessons){
  assert.equal((lesson.question.match(/¿/g)||[]).length,1,lesson.id);
  const session=createSession({missionId:mission.id});session.lessonIds=[lesson.id];session.routeLength=1;
  await advance(session,{type:'hint'});await advance(session,{type:'answer',choice:correctChoice(lesson)});
  assert.match(session.messages.at(-1).text,/Tu elección es correcta/);
  assert.equal((session.messages.at(-1).text.match(/¿/g)||[]).length,1,lesson.id);
 }
});
