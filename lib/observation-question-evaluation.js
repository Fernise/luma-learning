import {missions} from './catalog.js';
import {advance,createSession,correctChoice} from './tutor.js';
import {createAIService} from './ai.js';
import {assessLocally} from './reasoning.js';
import {validExplanation} from './evaluation-cases.js';
export async function evaluateObservationQuestion(spec){
 const mission=missions.find(m=>m.lessons.some(l=>l.id===spec.lessonId));
 const lesson=mission.lessons.find(l=>l.id===spec.lessonId);
 const session=Object.assign(createSession({missionId:mission.id}),{lessonIds:[lesson.id],routeLength:1});
 await advance(session,{type:'hint'});await advance(session,{type:'answer',choice:spec.wrong?1-correctChoice(lesson):correctChoice(lesson)});
 const service=createAIService({env:{OPENAI_API_KEY:'simulated',OPENAI_MODEL:'simulated'},fetchImpl:async()=>({ok:true,json:async()=>({status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify({category:'unclear',question:spec.question??null})}]}]})})});
 let question=null,guard=null;
 await advance(session,{type:'explain',text:spec.text},{onGuard:r=>{guard=r.reason;},getQuestion:()=>question,assess:(text,l)=>spec.question===undefined?assessLocally(text,l):service.assess(text,l,{onQuestion:q=>{question=q;}})});
 const message=session.messages.at(-1),open=session.phase!=='complete'&&session.records.length===0;
 const originalPreserved=session.messages.some(m=>m.role==='student'&&m.text===spec.text);
 const shown=message.questionSource==='ai';
 const observation=message.questionReason==='observation-next-step';
 const partial={open,shown,observation,response:message.text,guard,calls:service.status().calls,acceptedProposals:service.status().questionsAccepted,originalPreserved};
 await advance(session,{type:'explain',text:validExplanation(lesson)});
 const final=spec.wrong?session.records.length===0:session.records.at(-1)?.reasoning==='supported';
 return {id:spec.id,lessonId:lesson.id,text:spec.text,question:spec.question??null,partial,validProofRespectsChoice:final,passed:open&&originalPreserved&&shown===spec.shown&&(!spec.observation||observation)&&(!spec.contains||message.text.includes(spec.contains))&&(!spec.guard||(guard===spec.guard&&service.status().calls===0))&&final};
}
