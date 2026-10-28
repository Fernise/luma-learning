import {getMission} from './catalog.js';
import {createSession,advance,correctChoice} from './tutor.js';
export async function evaluateSpecificSupport(spec,{wrongChoice=false}={}){
 const lesson=getMission('logic').lessons.find(l=>l.id===spec.lessonId);
 const session=Object.assign(createSession({missionId:'logic'}),{lessonIds:[lesson.id],routeLength:1});
 await advance(session,{type:'answer',choice:wrongChoice?1-correctChoice(lesson):correctChoice(lesson)});
 const turns=[];let calls=0;
 for(let stage=0;stage<5;stage++){
  await advance(session,{type:'explain',text:spec.text},{assess:()=>{calls++;return 'supported';}});
  const text=session.messages.at(-1).text;
  const checks={open:session.records.length===0,originalText:session.messages.at(-2).text===spec.text,noProvider:calls===0,
   pause:session.paused===(stage===4),visual:stage<2||session.visual,
   focused:stage!==0||new RegExp(spec.focus,'i').test(text),
   question:stage===4||(text.match(/\?/g)??[]).length===1,
   progressive:stage===4||!turns.some(t=>t.text===text),
   evidence:stage!==1&&stage!==2||/pista|dato|informacion/.test(text.toLowerCase())};
  turns.push({stage,text,checks,passed:Object.values(checks).every(Boolean)});
 }
 await advance(session,{type:'resume'});
 if(wrongChoice)await advance(session,{type:'answer',choice:correctChoice(lesson)});
 const name={some:'Luna',birds:'Pipo','boats-transfer':'Brisa'}[lesson.id];
 await advance(session,{type:'explain',text:`Faltan datos sobre ${name}.`});
 const recovered=session.records.at(-1)?.reasoning==='supported';
 return {id:spec.id,wrongChoice,calls,recovered,passed:turns.every(t=>t.passed)&&recovered,turns};
}
