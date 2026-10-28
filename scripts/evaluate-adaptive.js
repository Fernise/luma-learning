import {mkdir,writeFile,readFile,access} from 'node:fs/promises';import {createHash} from 'node:crypto';
import {createAIService} from '../lib/ai.js';import {previousQuestions} from '../lib/question-policy.js';
import {advance,createSession,correctChoice} from '../lib/tutor.js';import {missions} from '../lib/catalog.js';
import {novelAdaptiveCases} from '../lib/novel-adaptive-cases.js';
import {adaptiveEvaluationCases} from '../lib/adaptive-evaluation-cases.js';
const live=process.argv.includes('--live');
const tag=process.argv.find(a=>a.startsWith('--tag='))?.slice(6) ?? (live?'live-'+new Date().toISOString().replace(/[^0-9]/g,''):null);
if(tag&&!/^[a-z0-9-]{1,40}$/.test(tag))throw new Error('Invalid report tag');
const targetReport=new URL(`../artifacts/tutor-adaptativo/${live?'evaluacion-real':'evaluacion-offline'}${tag?'-'+tag:''}.json`,import.meta.url);
if(tag){try{await access(targetReport);throw new Error('Report already exists; no calls were made.');}catch(error){if(error.code!=='ENOENT')throw error;}}
const requestedCalls=Number(process.argv.find(a=>a.startsWith('--max-calls='))?.slice(12)??8);
if(!Number.isInteger(requestedCalls)||requestedCalls<1||requestedCalls>8)throw new Error('Use 1–8 calls');
const allCases=[...adaptiveEvaluationCases,...novelAdaptiveCases];
const selected=process.argv.find(a=>a.startsWith('--cases='))?.slice(8).split(',');
if(selected?.some(id=>!allCases.some(c=>c.id===id)))throw new Error('Unknown case');
const cases=selected?allCases.filter(c=>selected.includes(c.id)):process.argv.includes('--novel')?novelAdaptiveCases:adaptiveEvaluationCases;
const version=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8')).version;
const implementationHash=createHash('sha256');
for(const file of ['ai.js','question-policy.js','ai-guard.js','tutor.js','reasoning.js','learner-language.js'])implementationHash.update(await readFile(new URL('../lib/'+file,import.meta.url)));
const implementationDigest=implementationHash.digest('hex');
const price=name=>{const input=process.argv.find(a=>a.startsWith(`--${name}=`))?.split('=')[1];const n=Number(input);return input!==undefined&&Number.isFinite(n)&&n>=0?n:null;};
const inputRate=price('input-usd-per-million'),outputRate=price('output-usd-per-million');
let scenario,simulatedCalls=0,simulatedTime=Date.now();
const mocked=async()=>{simulatedCalls++;if(scenario.failure==='connection')throw new Error('Simulated connection failure');return {ok:true,json:async()=>({status:'completed',usage:{input_tokens:300,output_tokens:35},output:[{type:'message',role:'assistant',content:scenario.failure==='refusal'?[{type:'refusal'}]:[{type:'output_text',text:JSON.stringify({category:scenario.category??'unclear',question:scenario.question??null})}]}]})};};
const service=createAIService({now:live?Date.now:()=>simulatedTime,env:live?{...process.env,LUMA_AI_MAX_CALLS:String(requestedCalls)}:{OPENAI_API_KEY:'simulated',OPENAI_MODEL:'simulated',LUMA_AI_MAX_CALLS:'100'},...(live?{}:{fetchImpl:mocked})});
if(live&&!service.status().configured)throw new Error('Configure the API before explicitly running the live evaluation.');
const results=[];
for(const item of cases){
 simulatedTime+=30001;
 const mission=missions.find(m=>m.lessons.some(l=>l.id===item.lesson));const lesson=mission.lessons.find(l=>l.id===item.lesson);
 const session=Object.assign(createSession({missionId:mission.id,useAI:true}),{lessonIds:[lesson.id],routeLength:1});
 await advance(session,{type:'hint'});await advance(session,{type:'answer',choice:item.wrong?1-correctChoice(lesson):correctChoice(lesson)});
 const turns=[];
 for(const turn of item.turns){scenario=turn;let question=null,result=null,error=null,diagnostic=null;const before=service.status().calls;const start=performance.now();
  try{await advance(session,turn.action?{type:'answer',choice:correctChoice(lesson)}:{type:'explain',text:turn.text},{getQuestion:()=>question,onGuard:r=>{result=r;},assess:(text,l)=>service.assess(text,l,{runId:session.runId,context:{previousQuestions:previousQuestions(session.messages),help:session.help},onQuestion:q=>{question=q;},onDiagnostic:d=>{diagnostic={...d,question:typeof d.question==='string'?d.question.slice(0,240).replace(/sk-[A-Za-z0-9_-]+/g,'[redacted]').replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[redacted]'):null};},onResult:r=>{result=r;}})});}catch(e){error=e.message;}
  const state=session.paused?'paused':session.phase==='complete'?session.records.at(-1)?.reasoning:'open';const shown=session.messages.at(-1)?.questionSource==='ai';
  const passed=!error&&state===turn.expect&&(turn.shown===undefined||shown===turn.shown)&&(!turn.guard||before===service.status().calls)&&(!turn.failure||result?.reason===turn.failure);
  turns.push({text:turn.text??turn.action,state,expectedState:turn.expect,expectedShown:turn.shown??null,response:session.messages.at(-1).text,shown,assessment:result,diagnostic,elapsedMs:Math.round(performance.now()-start),providerCalls:service.status().calls-before,passed:live?null:passed,error});
 }
 results.push({id:item.id,lessonId:item.lesson,passed:live?null:turns.every(t=>t.passed),turns});
}
const status=service.status();const estimated=live&&inputRate!==null&&outputRate!==null?(status.inputTokens*inputRate+status.outputTokens*outputRate)/1e6:null;
const report={version,implementationHash:implementationDigest,date:new Date().toISOString(),mode:live?'live adult review required':'simulated, no real calls',corpusHash:createHash('sha256').update(JSON.stringify(cases)).digest('hex'),summary:{conversations:results.length,turns:results.reduce((n,r)=>n+r.turns.length,0),passed:live?null:results.filter(r=>r.passed).length,failed:live?[]:results.filter(r=>!r.passed).map(r=>r.id),realProviderCalls:live?status.calls:0,simulatedCalls:live?0:simulatedCalls},telemetry:{...status,tokenMeaning:live?'reported by provider, may be incomplete':'synthetic fixture values, not billed',latencyMeaning:live?'measured wall time; manually review completeness':'simulated round trips, not real model latency',missingUsageCalls:status.calls-status.usageReports,reportedUsageCostUSD:estimated,inputRateUSDPerMillion:inputRate,outputRateUSDPerMillion:outputRate},results};
await mkdir(new URL('../artifacts/tutor-adaptativo/',import.meta.url),{recursive:true});await writeFile(targetReport,JSON.stringify(report,null,2)+'\n',tag?{flag:'wx'}:undefined);console.log(JSON.stringify(report.summary));if(!live&&report.summary.failed.length)process.exitCode=1;
