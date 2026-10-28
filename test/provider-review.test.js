import test from 'node:test';import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import {readFile} from 'node:fs/promises';import {randomUUID} from 'node:crypto';
import {reviewProvider} from '../lib/provider-review.js';import {providerReviewCases} from '../lib/provider-review-cases.js';
const env={OPENAI_API_KEY:'fixture-key',OPENAI_MODEL:'simulated',LUMA_AI_MAX_CALLS:'100'};
const response=category=>({ok:true,json:async()=>({status:'completed',usage:{input_tokens:10,output_tokens:5},output:[{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify({category,question:null})}]}]})});
const correct=options=>providerReviewCases.find(c=>c.text===JSON.parse(JSON.parse(options.body).input[0].content).learnerExplanation).category;
test('review enforces eight HTTP attempts, blocks guards before the provider, and verifies the ninth uses local fallback',async()=>{
 let calls=0;const events=[];
 const report=await reviewProvider({env,fetchImpl:async(url,options)=>{calls++;const body=JSON.parse(options.body);assert.equal(url,'https://api.openai.com/v1/responses');assert.equal(body.store,false);assert.deepEqual(body.tools,[]);assert.equal(body.tool_choice,'none');assert.equal(body.max_output_tokens,250);return response(correct(options));},onEvent:async e=>events.push(e)});
 assert.equal(calls,8);assert.equal(report.summary.passed,true);assert.equal(report.guards.length,6);assert.ok(report.guards.every(r=>r.httpAttempts===0));
 assert.deepEqual(report.limit.assessment,{source:'local',reason:'limit'});assert.equal(report.limit.httpAttempts,0);assert.equal(report.telemetry.usageReports,8);
 assert.doesNotMatch(JSON.stringify(events),/fixture-key|Authorization|Bearer/);
});
test('an incorrect model classification is recorded as a failure even when the response schema is valid',async()=>{
 const report=await reviewProvider({env,fetchImpl:async(_url,options)=>response(JSON.parse(JSON.parse(options.body).input[0].content).learnerExplanation===providerReviewCases[0].text?'supported':correct(options))});
 assert.equal(report.results[0].assessment.source,'ai');assert.equal(report.results[0].checks.category,false);assert.equal(report.results[0].actualState,'supported');assert.equal(report.summary.passed,false);assert.equal(report.summary.providerCasesPassed,7);
});
test('connection failure stops the review without retries and cannot count local fallback as a model success',async()=>{
 let calls=0;const report=await reviewProvider({env,fetchImpl:async()=>{calls++;throw new Error('Connection unavailable');}});
 assert.equal(calls,1);assert.equal(report.summary.providerCasesPassed,0);assert.equal(report.summary.complete,false);assert.equal(report.results[0].assessment.source,'local');assert.equal(report.limit,null);
});
test('missing configuration cannot transmit any request',async()=>{
 await assert.rejects(reviewProvider({env:{},fetchImpl:()=>assert.fail('No request allowed')}),/not configured/);
});
test('an atomic report claim prevents concurrent or repeated runs from consuming a second budget',async()=>{
 const tag='test-'+randomUUID().slice(0,20),run=promisify(execFile);
 const args=['scripts/review-provider-current.js','--tag='+tag];
 const pair=await Promise.allSettled([run(process.execPath,args),run(process.execPath,args)]);
 assert.equal(pair.filter(r=>r.status==='fulfilled').length,1);assert.equal(pair.filter(r=>r.status==='rejected').length,1);
 const path=new URL('../artifacts/proveedor-1026/'+tag,import.meta.url);
 const initial=await readFile(new URL(path.href+'.json'),'utf8');
 await assert.rejects(run(process.execPath,args));
 assert.equal(await readFile(new URL(path.href+'.json'),'utf8'),initial);
 const journal=(await readFile(new URL(path.href+'.events.jsonl'),'utf8')).trim().split('\n').map(JSON.parse);
 assert.equal(journal.filter(e=>e.type==='request-reserved').length,8);
 assert.equal(JSON.parse(initial).mode,'simulated provider, no external calls');
});
