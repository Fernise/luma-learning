import {mkdir,readFile,writeFile,appendFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
import {reviewProvider} from '../lib/provider-review.js';
import {providerReviewCases,providerGuardCases} from '../lib/provider-review-cases.js';
const live=process.argv.includes('--live'),tag=process.argv.find(a=>a.startsWith('--tag='))?.slice(6);
if(!tag||!/^[a-z0-9-]{1,40}$/.test(tag))throw new Error('An explicit unique --tag is required.');
const dir=new URL('../artifacts/proveedor-1026/',import.meta.url);await mkdir(dir,{recursive:true});
const prefix=new URL(tag,dir),claim=new URL(prefix.href+'.claim.json');
const version=JSON.parse(await readFile(new URL('../package.json',import.meta.url))).version;
const implementation=createHash('sha256');for(const file of ['ai','ai-guard','tutor','reasoning','follow-up','question-policy','learner-language','language-relations','some-inference','all-inference','math-claims','provider-review'])implementation.update(await readFile(new URL('../lib/'+file+'.js',import.meta.url)));
const metadata={date:new Date().toISOString(),version,mode:live?'live provider, fictitious adult text':'simulated provider, no external calls',implementationHash:implementation.digest('hex'),corpusHash:createHash('sha256').update(JSON.stringify({providerReviewCases,providerGuardCases})).digest('hex'),plannedProviderCases:8,maxHttpAttempts:8,scope:'Frozen adult-authored cases and actual tutor pipeline; not independent child-language accuracy or pedagogical validation.',officialGuidance:'https://developers.openai.com/tracks/ai-application-development#evaluations'};
// Atomic claim before reading runtime configuration or making any paid request.
await writeFile(claim,JSON.stringify(metadata,null,2)+'\n',{flag:'wx'});
const mocked=async(_url,options)=>{const text=JSON.parse(JSON.parse(options.body).input[0].content).learnerExplanation,spec=providerReviewCases.find(c=>c.text===text);return {ok:true,json:async()=>({status:'completed',usage:{input_tokens:300,output_tokens:40},output:[{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify({category:spec.category,question:spec.category==='unclear'?(spec.lessonId==='pizza'?'¿Qué has comparado entre los tamaños de los trozos?':spec.lessonId==='steps'?'¿Qué cambio observas entre pasos conocidos?':'¿Qué pista del ejercicio apoya tu elección?'):null})}]}]})};};
try{
 const report=await reviewProvider({env:live?process.env:{OPENAI_API_KEY:'simulated-only',OPENAI_MODEL:'simulated'},...(live?{}:{fetchImpl:mocked}),onEvent:event=>appendFile(new URL(prefix.href+'.events.jsonl'),JSON.stringify(event)+'\n')});
 await writeFile(new URL(prefix.href+'.json'),JSON.stringify({...metadata,...report},null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({version,...report.summary,model:report.telemetry.model,realProviderCalls:live?report.summary.actualHttpAttempts:0}));if(!report.summary.passed)process.exitCode=1;
}catch{
 await writeFile(new URL(prefix.href+'.failed.json'),JSON.stringify({...metadata,error:'Review could not finish. Check safe event journal; the claimed tag cannot be rerun.'},null,2)+'\n',{flag:'wx'});console.error('Review could not finish. No automatic retries; see the safe event journal.');process.exitCode=1;
}
