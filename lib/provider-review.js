import {createAIService} from './ai.js';
import {missions} from './catalog.js';
import {advance,createSession,correctChoice} from './tutor.js';
import {previousQuestions,validateQuestion} from './question-policy.js';
import {providerReviewCases,providerGuardCases} from './provider-review-cases.js';
export const PROVIDER_REVIEW_MAX_CALLS=8;
const safeQuestion=q=>typeof q==='string'?q.slice(0,240).replace(/sk-[A-Za-z0-9_-]+/g,'[redacted]').replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[redacted]'):null;
async function prepare(spec){
 const mission=missions.find(m=>m.lessons.some(l=>l.id===spec.lessonId)),lesson=mission.lessons.find(l=>l.id===spec.lessonId);
 const session=Object.assign(createSession({missionId:mission.id,useAI:true}),{lessonIds:[lesson.id],routeLength:1});
 await advance(session,{type:'hint'});await advance(session,{type:'answer',choice:spec.wrongChoice?1-correctChoice(lesson):correctChoice(lesson)});
 return {lesson,session};
}
export async function reviewProvider({env,fetchImpl=fetch,onEvent=async()=>{}}){
 let httpAttempts=0;
 const service=createAIService({env:{...env,LUMA_AI_MAX_CALLS:String(PROVIDER_REVIEW_MAX_CALLS)},fetchImpl:async(url,options)=>{
  if(httpAttempts>=PROVIDER_REVIEW_MAX_CALLS)throw new Error('Review request budget exhausted');
  const body=JSON.parse(options.body);
  if(url!=='https://api.openai.com/v1/responses'||body.store!==false||body.max_output_tokens!==250||body.tools?.length!==0||body.tool_choice!=='none'||body.text?.format?.strict!==true)throw new Error('Unexpected request configuration');
  httpAttempts++;
  // Journal before transmitting. Headers, API keys and provider error bodies are never recorded.
  await onEvent({type:'request-reserved',number:httpAttempts});
  return fetchImpl(url,options);
 }});
 if(!service.status().configured)throw new Error('Provider not configured; no request made.');
 const guards=[],results=[];
 for(const spec of providerGuardCases){
  const {lesson,session}=await prepare(spec);const before=httpAttempts;let assessment;
  for(let n=0;n<spec.repeats;n++)await advance(session,{type:'explain',text:spec.text},{onGuard:r=>{assessment=r;service.recordGuard();},assess:()=>{throw new Error('Guard attempted provider access');}});
  const row={id:spec.id,reason:assessment?.reason,expectedReason:spec.reason,phase:session.phase,repeats:spec.repeats,httpAttempts:httpAttempts-before,passed:httpAttempts===before&&assessment?.reason===spec.reason&&session.phase!=='complete'&&session.messages.some(m=>m.role==='student'&&m.text===spec.text)};
  guards.push(row);await onEvent({type:'guard-result',...row});
 }
 for(const spec of providerReviewCases){
  const {lesson,session}=await prepare(spec),choice=session.choice;const before=httpAttempts;const started=performance.now();let assessment=null,diagnostic=null,question=null,error=null;
  try{await advance(session,{type:'explain',text:spec.text},{getQuestion:()=>question,onGuard:r=>{assessment=r;service.recordGuard();},assess:(text,l)=>service.assess(text,l,{runId:session.runId,context:{previousQuestions:previousQuestions(session.messages),help:session.help},onResult:r=>{assessment=r;},onQuestion:q=>{question=q;},onDiagnostic:d=>{diagnostic={category:d.category,question:safeQuestion(d.question),validation:d.validation};}})});}catch(e){error=e.message;}
  const state=session.paused?'paused':session.phase==='complete'?session.records.at(-1)?.reasoning:'open',last=session.messages.at(-1);
  const shown=last.questionSource==='ai';
  const checks={providerResponse:assessment?.source==='ai',category:assessment?.reasoningCategory===spec.category,state:state===spec.state,originalText:session.messages.some(m=>m.role==='student'&&m.text===spec.text),choice:session.choice===choice,shownQuestionSafe:!shown||validateQuestion(last.text,lesson).ok,oneRequest:httpAttempts-before===1,error:!error};
  const row={...spec,assessment,diagnostic,actualState:state,response:last.text,questionSource:last.questionSource??'local',questionReason:last.questionReason??null,shown,httpAttempts:httpAttempts-before,elapsedMs:Math.round(performance.now()-started),checks,passed:Object.values(checks).every(Boolean),error};
  results.push(row);await onEvent({type:'provider-result',...row});
  // Do not spend more attempts after a real connection/configuration failure or cooldown.
  if(assessment?.source==='local')break;
 }
 let limit=null;
 if(service.status().calls===PROVIDER_REVIEW_MAX_CALLS){
  const before=httpAttempts;let assessment;
  const {lesson,session}=await prepare({lessonId:'steps'});
  await advance(session,{type:'explain',text:'He mirado los números.'},{assess:(text,l)=>service.assess(text,l,{runId:session.runId,onQuestion:()=>{},onResult:r=>{assessment=r;}})});
  limit={assessment,httpAttempts:httpAttempts-before,phase:session.phase,passed:httpAttempts===before&&assessment?.source==='local'&&assessment.reason==='limit'&&session.phase!=='complete'};
  await onEvent({type:'limit-result',...limit});
 }
 const telemetry=service.status();
 return {summary:{providerCasesPlanned:providerReviewCases.length,providerCasesExecuted:results.length,providerCasesPassed:results.filter(r=>r.passed).length,guards:guards.length,guardsPassed:guards.filter(r=>r.passed).length,actualHttpAttempts:httpAttempts,maxHttpAttempts:PROVIDER_REVIEW_MAX_CALLS,questionsProposed:results.filter(r=>r.diagnostic?.question).length,questionsPassedFilter:results.filter(r=>r.diagnostic?.validation.ok).length,questionsShown:results.filter(r=>r.shown).length,localObservationReplacements:results.filter(r=>r.questionReason==='observation-next-step').length,limitPassed:limit?.passed??null,complete:results.length===providerReviewCases.length,passed:guards.every(r=>r.passed)&&results.length===providerReviewCases.length&&results.every(r=>r.passed)&&limit?.passed===true},telemetry,guards,results,limit};
}
