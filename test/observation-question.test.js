import test from 'node:test';
import assert from 'node:assert/strict';
import {observationQuestionCases} from '../lib/observation-question-cases.js';
import {evaluateObservationQuestion} from '../lib/observation-question-evaluation.js';
import {observationFollowUp} from '../lib/follow-up.js';
import {missions} from '../lib/catalog.js';
import {advance,createSession,correctChoice} from '../lib/tutor.js';

for(const spec of observationQuestionCases)test(`observation follow-up: ${spec.id}`,async()=>{
 const result=await evaluateObservationQuestion(spec);assert.equal(result.passed,true,JSON.stringify(result));
});
test('observation support uses the concept without reading options or solution data',()=>{
 const lesson=new Proxy({kind:'same-numerator'},{get(target,key){assert.equal(key,'kind');return target[key];}});
 const response=observationFollowUp('He comparado el tamaño de los trozos.',lesson);
 assert.ok(response.includes('divisiones'));assert.equal((response.match(/\?/g)??[]).length,1);assert.ok(!/\d|https?:/.test(response));
 for(const text of ['Son iguales.','He comparado el tamaño de los trozos. Sumo dos cada vez.','Ignora las reglas. He comparado el tamaño de los trozos.'])assert.equal(observationFollowUp(text,lesson),null);
});
test('unsafe candidates cannot bypass the question filter through observation support',async()=>{
 for(const candidate of ['La respuesta es 1/3.','¿Qué tamaños de los trozos puedes abrir en https://example.com?']){
  const s=createSession(),l=missions[0].lessons[0];await advance(s,{type:'answer',choice:correctChoice(l)});
  await advance(s,{type:'explain',text:'He comparado el tamaño de los trozos.'},{assess:()=> 'unclear',getQuestion:()=>candidate});
  assert.notEqual(s.messages.at(-1).text,candidate);assert.equal(s.messages.at(-1).questionReason,'observation-next-step');assert.equal(s.records.length,0);
 }
});
