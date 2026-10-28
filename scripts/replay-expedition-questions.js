import {mkdir,readFile,writeFile,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createAIService} from '../lib/ai.js';
import {evaluateExpedition} from '../lib/expedition-evaluation.js';

// Reuses recorded output only. Never loads .env or calls a network provider.
const baseline=process.argv.includes('--baseline');
const dir=new URL('../artifacts/preguntas-1023/',import.meta.url);await mkdir(dir,{recursive:true});
const path=new URL(baseline?'reproduccion-antes.json':'reproduccion-despues.json',dir);
if(baseline){try{await access(path);throw new Error('Baseline exists.');}catch(e){if(e.code!=='ENOENT')throw e;}}
const source=await readFile(new URL('../artifacts/expediciones-1022/real-1022.json',import.meta.url),'utf8');
const original=JSON.parse(source),recorded=original.results[0].events.filter(e=>e.diagnostic);let index=0;
const service=createAIService({env:{OPENAI_API_KEY:"offline-fixture",OPENAI_MODEL:'recorded-output',LUMA_AI_MAX_CALLS:'8'},fetchImpl:async(_url,options)=>{
  const input=JSON.parse(JSON.parse(options.body).input[0].content),event=recorded[index++];
  if(!event||event.action.text!==input.learnerExplanation)throw new Error('Recording order does not match the authored journey.');
  return {ok:true,json:async()=>({status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify({category:event.diagnostic.category,question:event.diagnostic.question})}]}]})};
}});
const result=await evaluateExpedition({missionId:'fractions',profile:'guided',service});
const summary={realCalls:0,recordedProposals:recorded.filter(e=>e.diagnostic.question).length,originallyShown:original.telemetry.questionsAccepted,shownNow:result.events.filter(e=>e.questionSource==='ai').length,simulatedCalls:service.status().calls,recordedResponsesConsumed:index,passed:result.passed&&index===recorded.length&&service.status().successes===recorded.length,violations:result.violations};
await writeFile(path,JSON.stringify({date:new Date().toISOString(),scope:'Replay of already-known recorded output. No new generation, latency or model accuracy claim.',sourceHash:createHash('sha256').update(source).digest('hex'),summary,result},null,2)+'\n',baseline?{flag:'wx'}:undefined);
console.log(JSON.stringify(summary));if(!summary.passed)process.exitCode=1;
