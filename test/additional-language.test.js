import test from 'node:test';
import assert from 'node:assert/strict';
import {additionalLanguageCases} from '../lib/additional-language-cases.js';
import {evaluateDifficultConversation} from '../lib/difficult-dialogue-evaluation.js';
import {missions} from '../lib/catalog.js';
import {screenExplanation} from '../lib/ai-guard.js';
import {assessLocally} from '../lib/reasoning.js';
const lesson=id=>missions.flatMap(m=>m.lessons).find(l=>l.id===id);

for(const permissive of [false,true])for(const spec of additionalLanguageCases)test(`additional language (${permissive?'permissive fixture':'local'}): ${spec.id}`,async()=>{
 const result=await evaluateDifficultConversation(spec,{permissive});
 for(const turn of result.turns){
  assert.equal(turn.passed,true,JSON.stringify(turn));
  if(turn.guard)assert.notEqual(turn.localCategory,'supported',turn.text);
 }
});

test('a scoped uncertainty or question cannot excuse a later individual assertion',()=>{
 for(const text of [
  'No sabemos si Luna lleva un collar azul, pero Luna no lleva un collar azul.',
  '¿Luna lleva un collar azul? Luna no lleva un collar azul. Faltan datos.',
  'Tal vez Luna lleva un collar azul, pero Luna lleva un collar azul.',
 ]){
  assert.equal(screenExplanation(text,lesson('some'))?.reason,'contradiction',text);
  assert.equal(assessLocally(text,lesson('some')),'unclear',text);
 }
});
test('uncertainty remains scoped to positive and negative properties in each authored setting',()=>{
 for(const [id,claim] of [['some','Luna no lleva un collar azul'],['birds','Pipo no tiene plumas amarillas'],['boats-transfer','Brisa no tiene una vela blanca']]){
  for(const prefix of ['No sabemos si ','Tal vez ','No podemos asegurar que ']){
   const text=prefix+claim+'. Faltan datos.';
   assert.equal(screenExplanation(text,lesson(id)),null,text);
   assert.equal(assessLocally(text,lesson(id)),'supported',text);
  }
 }
});
test('question scope ends at a sentence and an individual assertion alone is not proof',()=>{
 for(const [id,claim] of [['some','Luna lleva un collar azul'],['birds','Pipo tiene plumas amarillas'],['boats-transfer','Brisa tiene una vela blanca']]){
  assert.equal(screenExplanation(claim,lesson(id))?.reason,'contradiction');
  assert.equal(assessLocally(claim,lesson(id)),'unclear');
  assert.equal(screenExplanation('¿'+claim+'? Faltan datos.',lesson(id)),null);
 }
});
