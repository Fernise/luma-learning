import test from 'node:test';
import assert from 'node:assert/strict';
import {specificSupportCases} from '../lib/specific-support-cases.js';
import {evaluateSpecificSupport} from '../lib/specific-support-evaluation.js';
import {inferenceSupport,followUpQuestion} from '../lib/follow-up.js';
for(const wrongChoice of [false,true])for(const spec of specificSupportCases)test(`specific support ${spec.id}, wrong choice ${wrongChoice}`,async()=>{
 const result=await evaluateSpecificSupport(spec,{wrongChoice});
 assert.equal(result.passed,true,JSON.stringify(result));
});
test('specific inference questions access only the concept and never a solution or learner text',()=>{
 const restricted=new Proxy({kind:'logic',reasoningType:'some'},{get(target,key){assert.ok(['kind','reasoningType'].includes(key));return target[key];}});
 for(const detail of ['unsupported-individual','unsupported-certainty','unsupported-universal','unsupported-exception']){
  const questions=[followUpQuestion(restricted,detail),...[1,2,3].map(stage=>inferenceSupport(restricted,detail,stage))];
  assert.equal(new Set(questions).size,4);
  for(const question of questions){
   assert.equal((question.match(/\?/g)??[]).length,1);
   assert.doesNotMatch(question,/Luna|Pipo|Brisa|collar|vela|plumas|correcta|comprendido|debes elegir|supported/);
  }
  assert.equal(inferenceSupport(restricted,detail,4),null);
 }
 assert.equal(inferenceSupport({kind:'pattern'},'unsupported-individual',1),null);
 assert.equal(inferenceSupport(restricted,'instruction',1),null);
});

test('a hint or uncertainty after a known inference keeps evidence-focused help without persisting text',async()=>{
 const {createSession,advance}=await import('../lib/tutor.js');
 const {createProgressStore}=await import('../lib/progress-store.js');
 for(const action of [{type:'hint'},{type:'explain',text:'No lo sé.'}]){
  const s=Object.assign(createSession({missionId:'logic'}),{lessonIds:['some'],routeLength:1});
  await advance(s,{type:'answer',choice:1});
  await advance(s,{type:'explain',text:'Faltan datos, pero Luna no lleva un collar azul.'});
  assert.equal(s.inferenceIssue,'unsupported-individual');
  await advance(s,action);
  assert.match(s.messages.at(-1).text,/pista que hable de este caso concreto/);
  assert.equal(s.records.length,0);
  assert.equal(s.help,1);
  const store=createProgressStore();
  try {
   const device='a'.repeat(64);store.enable(device);store.save(device,'specific-support-fixture',s);
   const restored=store.restore(device,'specific-support-fixture');
   assert.equal(restored.inferenceIssue,undefined);
   assert.equal(restored.choice,s.choice);
   assert.equal(restored.help,s.help);
   assert.doesNotMatch(JSON.stringify(restored),/Luna no lleva|unsupported-individual/);
  }finally{store.close();}
  await advance(s,{type:'answer',choice:0});
  assert.equal(s.inferenceIssue,undefined);
 }
});
test('new incomplete reasoning clears the earlier issue instead of forcing the same follow-up',async()=>{
 const {createSession,advance}=await import('../lib/tutor.js');
 const s=Object.assign(createSession({missionId:'logic'}),{lessonIds:['some'],routeLength:1});
 await advance(s,{type:'answer',choice:0});
 await advance(s,{type:'explain',text:'Luna no lleva un collar azul.'});
 await advance(s,{type:'explain',text:'He mirado las pistas.'});
 assert.equal(s.inferenceIssue,undefined);
 assert.equal(s.records.length,0);
});
