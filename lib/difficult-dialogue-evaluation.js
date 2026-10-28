import {missions} from './catalog.js';
import {advance,createSession,correctChoice} from './tutor.js';
import {assessLocally} from './reasoning.js';

export async function evaluateDifficultConversation(spec,{permissive=false}={}){
 const mission=missions.find(m=>m.lessons.some(l=>l.id===spec.lessonId));
 const lesson=mission.lessons.find(l=>l.id===spec.lessonId);
 const session=Object.assign(createSession({missionId:mission.id}),{lessonIds:[lesson.id],routeLength:1});
 await advance(session,{type:'hint'});
 await advance(session,{type:'answer',choice:spec.wrongChoice?1-correctChoice(lesson):correctChoice(lesson)});
 const turns=[];
 for(const turn of spec.turns){
  let calls=0,guardReason=null,error=null;
  try{
   await advance(session,turn.action?{type:'answer',choice:correctChoice(lesson)}:{type:'explain',text:turn.text},{onGuard:r=>{guardReason=r.reason;},assess:(text,l)=>{calls++;return permissive&&turn.guard?'supported':assessLocally(text,l);}});
  }catch(e){error=e.message;}
  const state=session.paused?'paused':session.phase==='complete'?session.records.at(-1)?.reasoning:'open';
  const originalTextPreserved=!turn.text||session.messages.some(m=>m.role==='student'&&m.text===turn.text);
  const response=session.messages.at(-1).text;
  const correctLabel=lesson.fractions?lesson.fractions[correctChoice(lesson)].join('/'):String(lesson.options[correctChoice(lesson)]);
  const solutionLeaked=spec.wrongChoice&&session.choice!==correctChoice(lesson)&&response.includes(correctLabel);
  turns.push({...turn,state,response,calls,guardReason,error,originalTextPreserved,solutionLeaked,localCategory:turn.text?assessLocally(turn.text,lesson):null,passed:!error&&state===turn.expect&&originalTextPreserved&&!solutionLeaked&&(!turn.guard||calls===0)&&(!turn.reason||guardReason===turn.reason)});
 }
 return {id:spec.id,lessonId:lesson.id,mode:permissive?'permissive-fixture':'local',passed:turns.every(t=>t.passed),turns};
}
