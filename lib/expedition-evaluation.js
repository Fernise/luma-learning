import {advance,createSession,currentLesson,correctChoice} from './tutor.js';
import {validExplanation} from './evaluation-cases.js';
import {freshEvaluationCases} from './fresh-evaluation-cases.js';
import {previousQuestions} from './question-policy.js';

// Frozen behavioural expectations; fictitious adult journeys, not child accuracy.
export const expeditionPlan={activities:5,profiles:{stress:['wrong-choice-two-partials-revise-one-partial-proof','pause-resume-proof','contradiction-then-proof','provider-failure-then-proof','why-transfer-proof'],guided:['partial-proof','proof','contradiction-proof','partial-proof','partial-proof']},expectations:['revision does not close on the first partial explanation of a new choice','wrong choices never complete','explicit contradictions never call the classifier','five distinct activities end with transfer in a practiced skill','pause and resume preserve the choice','no generated answer, link or multiple question','all five activities finish']};

export async function evaluateExpedition({missionId='fractions',profile='stress',service}={}){
 const session=createSession({missionId,adaptive:true,useAI:true});const events=[],violations=[],skills=[];let scenario='normal';
 const check=(ok,detail)=>{if(!ok)violations.push(detail);};
 async function act(action,expect){
  let candidate=null,result=null,diagnostic=null,error=null;const lesson=currentLesson(session);const before=service.status().calls;const start=performance.now();
  try{await advance(session,action,{getQuestion:()=>candidate,onGuard:r=>{result=r;},assess:(text,l)=>service.assess(text,l,{runId:session.runId,context:{previousQuestions:previousQuestions(session.messages),help:session.help},onQuestion:q=>{candidate=q;},onResult:r=>{result=r;},onDiagnostic:d=>{diagnostic=d;}})});}catch(e){error=e.message;}
  const state=session.paused?'paused':['complete','finished'].includes(session.phase)?session.phase:'open';const last=session.messages.at(-1);
  if(error)violations.push(`${lesson.id}: ${error}`);
  if(expect)check(state===expect,`${lesson.id}: ${action.type} expected ${expect}, got ${state}`);
  if(last?.questionSource==='ai')check(!/[\d<>]|https?:|respuesta es/i.test(last.text)&&((last.text.match(/\?/g)??[]).length===1),`${lesson.id}: unsafe generated question`);
  const event={lessonId:lesson.id,scenario,action,state,expected:expect??null,records:session.records.length,reasoningAttempts:session.reasoningAttempts,choiceReasoningAttempts:session.choiceReasoningAttempts??null,response:last?.text,questionSource:last?.questionSource??'local',assessment:result,diagnostic,providerCalls:service.status().calls-before,elapsedMs:Math.round(performance.now()-start),error};events.push(event);return event;
 }
 for(let index=0;index<5;index++){
  const lesson=currentLesson(session);if(index===4)check(!!lesson.transfer&&skills.includes(lesson.skill),`${lesson.id}: transfer lacks practiced concept`);skills.push(lesson.skill);
  if(profile==='stress'&&index===0){
   await act({type:'answer',choice:1-correctChoice(lesson)},'open');
   for(let i=0;i<2;i++)await act({type:'explain',text:'He comparado las partes.'},'open');
   check(!session.records.length,'wrong choice completed');
   await act({type:'answer',choice:correctChoice(lesson)},'open');
   await act({type:'explain',text:'He comparado las partes.'},'open');
  }else{
   await act({type:'hint'},'open');await act({type:'answer',choice:correctChoice(lesson)},'open');
  }
  if(profile==='stress'&&index===1){
   const choice=session.choice;await act({type:'pause'},'paused');await act({type:'resume'},'open');check(session.choice===choice,`${lesson.id}: choice lost during pause`);
  }
  if(index===2){
   const invalid=freshEvaluationCases.find(c=>c.lessonId===lesson.id&&c.guardRequired);
   if(!invalid)throw new Error('Missing fixed contradiction for '+lesson.id);
   const event=await act({type:'explain',text:invalid.text},'open');check(event.providerCalls===0,`${lesson.id}: contradiction reached provider`);
  }
  if((profile==='guided'&&[0,3,4].includes(index))||(profile==='stress'&&index===3)){
   scenario=profile==='stress'?'connection-failure':'normal';await act({type:'explain',text:lesson.kind==='pattern'?'Comparé un paso con el anterior.':lesson.kind==='logic'?'Usé un dato del ejercicio.':'Comparé el tamaño de los trozos.'},'open');scenario='normal';
  }
  if(profile==='stress'&&index===4)await act({type:'explain',text:'¿Por qué?'},'open');
  if(session.paused)await act({type:'resume'},'open');
  if(session.phase!=='complete')await act({type:'explain',text:validExplanation(lesson)},'complete');
  check(session.phase==='complete',`${lesson.id}: did not complete`);
  check(session.records.at(-1)?.reasoning==='supported',`${lesson.id}: completed without a supported explanation`);
  if(session.phase!=='complete')break;
  await act({type:'next'},index===4?'finished':'open');
 }
 check(session.phase==='finished'&&session.records.length===5,'journey unfinished');check(new Set(session.lessonIds).size===5,'repeated activity');
 return {missionId,profile,passed:violations.length===0,violations,phase:session.phase,lessonIds:session.lessonIds,records:session.records,events,telemetry:service.status()};
}
