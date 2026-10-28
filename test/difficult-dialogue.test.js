import test from 'node:test';
import assert from 'node:assert/strict';
import {difficultDialogueCases} from '../lib/difficult-dialogue-cases.js';
import {evaluateDifficultConversation} from '../lib/difficult-dialogue-evaluation.js';
import {missions} from '../lib/catalog.js';
import {screenExplanation} from '../lib/ai-guard.js';
import {assessLocally} from '../lib/reasoning.js';
const lesson=id=>missions.flatMap(m=>m.lessons).find(l=>l.id===id);

for(const permissive of [false,true])for(const spec of difficultDialogueCases)test(`difficult dialogue (${permissive?'permissive fixture':'local'}): ${spec.id}`,async()=>{
 const result=await evaluateDifficultConversation(spec,{permissive});
 for(const turn of result.turns)assert.equal(turn.passed,true,JSON.stringify(turn));
});

test('a directly negated claim does not inherit an unrelated negation rule',()=>{
 assert.notEqual(screenExplanation('No es cierto que con menos partes cada trozo es menor.',lesson('pizza'))?.reason,'contradiction');
 assert.notEqual(screenExplanation('No sumo tres cada vez.',lesson('doubling'))?.reason,'contradiction');
 for(const id of ['steps','countdown'])assert.notEqual(screenExplanation('No es cierto que cada número es el doble del anterior.',lesson(id))?.reason,'contradiction');
});
test('explicit certainty is checked for each authored some case, while missing evidence stays valid',()=>{
 for(const [id,text,uncertain] of [
  ['some','No hay un dato sobre Luna. Luna lleva un collar azul seguro.','No sabemos si Luna lleva un collar azul seguro.'],
  ['birds','Faltan datos sobre Pipo. Pipo tiene plumas amarillas sin duda.','No sabemos si Pipo tiene plumas amarillas seguro.'],
  ['boats-transfer','Faltan datos sobre Brisa. Brisa tiene una vela blanca seguro.','No sabemos si Brisa tiene una vela blanca seguro.'],
 ]){
  assert.equal(screenExplanation(text,lesson(id))?.reason,'contradiction');
  assert.notEqual(assessLocally(text,lesson(id)),'supported');
  assert.equal(screenExplanation(uncertain,lesson(id)),null);
  assert.equal(assessLocally(uncertain,lesson(id)),'supported');
 }
});
test('only one leading retraction is interpreted and present contradictions remain checked',()=>{
 for(const text of [
  'Antes pensaba que sumo dos cada vez. Ahora antes pensaba que sumo cuatro cada vez. Ahora sumo tres cada vez.',
  'Antes pensaba que sumo dos cada vez. Ahora sumo tres cada vez y sumo cuatro cada vez.',
 ]){
  assert.equal(screenExplanation(text,lesson('steps'))?.reason,'contradiction');
  assert.notEqual(assessLocally(text,lesson('steps')),'supported');
 }
 assert.equal(screenExplanation('Antes pensaba que sumo dos cada vez. Ahora elijo 14.',lesson('steps'))?.reason,'answer-only');
});
