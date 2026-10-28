import test from 'node:test';
import assert from 'node:assert/strict';
import {questionReviewCases} from '../lib/question-review-cases.js';
import {missions} from '../lib/catalog.js';
import {validateQuestion} from '../lib/question-policy.js';
import {createAIService} from '../lib/ai.js';
import {advance,createSession,correctChoice} from '../lib/tutor.js';

const find=id=>missions.flatMap(m=>m.lessons).find(l=>l.id===id);
for(const c of questionReviewCases)test(`reviewed process question: ${c.id}`,()=>{
  const result=validateQuestion(c.question,find(c.lesson),c.previous);
  assert.equal(result.ok,c.accept);
  // A rejection at an earlier scope check is also valid. The report preserves
  // preferred-vs-actual stage differences rather than weakening the scope rule.
});

for(const id of ['recorded-sizes','recorded-compared','sizes-in-logic','answer-relation'])test(`recorded-output boundaries through classifier and tutor: ${id}`,async()=>{
  const c=questionReviewCases.find(c=>c.id===id),lesson=find(c.lesson);
  const mission=missions.find(m=>m.lessons.includes(lesson));
  const session=Object.assign(createSession({missionId:mission.id}),{lessonIds:[lesson.id],routeLength:1});
  const service=createAIService({env:{OPENAI_API_KEY:'simulated',OPENAI_MODEL:'simulated'},fetchImpl:async()=>({ok:true,json:async()=>({status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify({category:'unclear',question:c.question})}]}]})})});
  await advance(session,{type:'hint'});
  await advance(session,{type:'answer',choice:correctChoice(lesson)});
  let question=null;
  await advance(session,{type:'explain',text:lesson.kind==='logic'?'He mirado la pista.':'He comparado las partes.'},{assess:(text,l)=>service.assess(text,l,{onQuestion:q=>{question=q;}}),getQuestion:()=>question});
  assert.equal(service.status().calls,1);
  assert.equal(session.messages.at(-1).questionSource==='ai',c.accept);
  if(c.accept)assert.equal(session.messages.at(-1).text,c.question);
  else assert.notEqual(session.messages.at(-1).text,c.question);
  assert.equal(session.records.length,0,'A process question must not complete a partial explanation');
});
