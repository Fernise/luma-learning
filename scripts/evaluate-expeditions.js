import {mkdir,readFile,writeFile,access} from 'node:fs/promises';import {createHash} from 'node:crypto';
import {createAIService} from '../lib/ai.js';import {assessLocally} from '../lib/reasoning.js';import {missions} from '../lib/catalog.js';import {evaluateExpedition,expeditionPlan} from '../lib/expedition-evaluation.js';
const live=process.argv.includes('--live'),baseline=process.argv.includes('--baseline');const tag=process.argv.find(a=>a.startsWith('--tag='))?.slice(6)??(live?'live-'+new Date().toISOString().replace(/\D/g,''):baseline?'antes':'despues');
if(!/^[a-z0-9-]{1,40}$/.test(tag))throw new Error('Invalid report tag');
const dir=new URL('../artifacts/expediciones-1022/',import.meta.url),path=new URL(tag+'.json',dir);await mkdir(dir,{recursive:true});
if(live||baseline){try{await access(path);throw new Error('Report exists; no API call made.');}catch(e){if(e.code!=='ENOENT')throw e;}}
const implementation=createHash('sha256');
for(const file of ['tutor.js','ai.js','ai-guard.js','reasoning.js','question-policy.js','language-relations.js','all-inference.js','expedition-evaluation.js'])implementation.update(await readFile(new URL('../lib/'+file,import.meta.url)));
const implementationHash=implementation.digest('hex');
const results=[];let time=Date.now(),current;
const fetchImpl=async(_url,options)=>{
 if(current?.scenario==='connection-failure')throw new Error('Simulated connection failure');
 const input=JSON.parse(JSON.parse(options.body).input[0].content);const lesson=missions.flatMap(m=>m.lessons).find(l=>l.context===input.exercise.context&&l.prompt===input.exercise.prompt);const category=assessLocally(input.learnerExplanation,lesson);
 const question=category==='unclear'?(lesson.kind==='pattern'?'¿Qué cambio observas entre pasos conocidos?':lesson.kind==='logic'?'¿Qué pista del ejercicio apoya tu elección?':'¿Qué has observado sobre las partes del ejercicio?'):null;
 return {ok:true,json:async()=>({status:'completed',usage:{input_tokens:400,output_tokens:40},output:[{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify({category,question})}]}]})};
};
// One server-like budget across all journeys; live run has a hard eight-call cap.
const service=createAIService({env:live?{...process.env,LUMA_AI_MAX_CALLS:'8'}:{OPENAI_API_KEY:'simulated',OPENAI_MODEL:'simulated',LUMA_AI_MAX_CALLS:'100'},now:live?Date.now:()=>time,...(live?{}:{fetchImpl})});
if(live&&!service.status().configured)throw new Error('API not configured');
for(const missionId of live?['fractions']:['fractions','patterns','logic']){
 time+=31000;
 // Scenario injection is tied to the exact authored partial input, not production.
 const proxy={status:()=>service.status(),assess:(text,l,options)=>{current={scenario:!live&&text.startsWith('Comparé')?'connection-failure':'normal'};time+=31000;return service.assess(text,l,options);}};
 results.push(await evaluateExpedition({missionId,profile:live?'guided':'stress',service:proxy}));
}
const version=JSON.parse(await readFile(new URL('../package.json',import.meta.url))).version;
const report={date:new Date().toISOString(),version,implementationHash,planHash:createHash('sha256').update(JSON.stringify(expeditionPlan)).digest('hex'),scope:live?'Fictitious adult guided expedition; real AI results must be distinguished from local fallback.':'Synthetic complete expeditions; classifier/failure fixtures, not child efficacy.',summary:{journeys:results.length,activities:results.reduce((n,r)=>n+r.records.length,0),finished:results.filter(r=>r.phase==='finished').length,passed:results.filter(r=>r.passed).length,realCalls:live?service.status().calls:0,violations:results.flatMap(r=>r.violations)},telemetry:service.status(),results};
await writeFile(path,JSON.stringify(report,null,2)+'\n',(live||baseline)?{flag:'wx'}:undefined);console.log(JSON.stringify(report.summary));if(report.summary.violations.length)process.exitCode=1;
