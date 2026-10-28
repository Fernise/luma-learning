import test from 'node:test';import assert from 'node:assert/strict';
import {advance,createSession,currentLesson,correctChoice} from '../lib/tutor.js';import {createProgressStore} from '../lib/progress-store.js';
import {octoberHeldoutCases} from '../lib/heldout-october-cases.js';import {missions} from '../lib/catalog.js';import {screenExplanation} from '../lib/ai-guard.js';import {assessLocally} from '../lib/reasoning.js';import {validExplanation} from '../lib/evaluation-cases.js';
const find=id=>missions.flatMap(m=>m.lessons).find(l=>l.id===id);
for(const c of octoberHeldoutCases)test(`new authored relation: ${c.id}`,async()=>{
 const l=find(c.lessonId);const category=screenExplanation(c.text,l)?.category??assessLocally(c.text,l);assert.equal(category==='supported',c.expect==='supported');
 if(c.guard){assert.ok(screenExplanation(c.text,l));const m=missions.find(m=>m.lessons.includes(l));const s=Object.assign(createSession({missionId:m.id}),{lessonIds:[l.id],routeLength:1});await advance(s,{type:'hint'});await advance(s,{type:'answer',choice:correctChoice(l)});await advance(s,{type:'explain',text:c.text},{assess:()=>assert.fail('Guard must stop a permissive classifier')});assert.equal(s.records.length,0);}
});
for(const missionId of ['fractions','patterns','logic'])test(`choice revision does not reuse old explanation count: ${missionId}`,async()=>{
 const s=createSession({missionId,adaptive:true}),l=currentLesson(s);await advance(s,{type:'answer',choice:1-correctChoice(l)});
 for(let i=0;i<2;i++)await advance(s,{type:'explain',text:'He comparado las partes.'},{assess:()=> 'unclear'});
 await advance(s,{type:'answer',choice:correctChoice(l)});await advance(s,{type:'explain',text:'He comparado las partes.'},{assess:()=> 'unclear'});
 assert.equal(s.records.length,0);assert.equal(s.reasoningAttempts,3);assert.equal(s.choiceReasoningAttempts,1);
 await advance(s,{type:'explain',text:validExplanation(l)});assert.equal(s.records[0].reasoning,'supported');assert.equal(s.records[0].reasoningAttempts,4);
});
test('choice count survives checkpoints without explanation text, and old checkpoints start conservatively',async t=>{
 const store=createProgressStore();t.after(()=>store.close());const token='a'.repeat(64);store.enable(token);
 const s=createSession({adaptive:true}),l=currentLesson(s);await advance(s,{type:'answer',choice:correctChoice(l)});await advance(s,{type:'explain',text:'He comparado las partes.'});
 store.save(token,'new',s);const restored=store.restore(token,'new');assert.equal(restored.choiceReasoningAttempts,1);assert.equal(restored.reasoningAttempts,1);assert.ok(!restored.messages.some(m=>m.text==='He comparado las partes.'));
 delete s.choiceReasoningAttempts;store.save(token,'old',s);const old=store.restore(token,'old');assert.equal(old.choiceReasoningAttempts,0);assert.equal(old.reasoningAttempts,1);
 await advance(old,{type:'explain',text:'He comparado las partes.'});assert.equal(old.records.length,0);assert.equal(old.choiceReasoningAttempts,1);
});
test('copy wording never overrides a different operation or a negated claim',()=>{
 const l=find('doubling');for(const text of ['Junto dos copias del número anterior y multiplico por tres.','No junto dos copias del número anterior.','Junto dos copias del número anterior y cada término vale tres veces el anterior.']){assert.notEqual(assessLocally(text,l),'supported',text);assert.equal(screenExplanation(text,l)?.reason,'contradiction',text);}
});
