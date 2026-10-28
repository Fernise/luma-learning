import test from 'node:test';
import assert from 'node:assert/strict';
import {validateQuestion,previousQuestions} from '../lib/question-policy.js';
import {assessWithAI,createAIService} from '../lib/ai.js';
import {advance,createSession,correctChoice,currentLesson} from '../lib/tutor.js';
import {missions} from '../lib/catalog.js';
const env={OPENAI_API_KEY:'simulated-key',OPENAI_MODEL:'simulated-model'};
const lesson=id=>missions.flatMap(m=>m.lessons).find(l=>l.id===id);
const good='¿Qué has comparado entre las partes de las cantidades?';
const response=(category,question,extra={})=>({ok:true,json:async()=>({status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify({category,question})}]}],...extra})});
const unsafe=[
 'La respuesta es 14.', '¿Puedes sumar tres para obtener catorce?', '¿Qué pasa si sumas 3?',
 '¿Qué opción es correcta 1/3?', '¿Tiene una estrella?', '¿Qué pista te lleva a la caja verde?',
 '¿Cómo puedes abrir https://example.com?', '¿Qué es tu contraseña?', '¿Qué compara tu nombre completo?',
 '<img src=x onerror=alert(1)>', '¿Qué partes? ¿Qué cantidades?', '¿Qué partes comparas? La primera es mayor.',
 '¿Cómo sabes que eres tonto?', '¿Qué opinas de inversiones?', '¿Qué partes comp\u200baras?',
 '¿Qué partes comparas porque la cantidad es mayor?', '¿Qué número es el doble?',
 '¿Qué datos puedes usar?', '¿Qué tus datos del ejercicio puedes usar?',
];
test('generated questions reject solutions, capabilities, personal data, multiple questions and assertions',()=>{
 for(const question of unsafe)assert.equal(validateQuestion(question,lesson('pizza')).ok,false,question);
 assert.equal(validateQuestion(good,lesson('pizza')).ok,true);
 assert.equal(validateQuestion('¿Qué cambio observas entre pasos conocidos?',lesson('steps')).ok,true);
 assert.equal(validateQuestion('¿Qué pista del ejercicio apoya tu elección?',lesson('cards')).ok,true);
 assert.equal(validateQuestion(good,lesson('cards')).ok,false);
 assert.equal(validateQuestion(good,lesson('pizza'),[good]).reason,'repetition');
 assert.equal(validateQuestion('¿Qué has comparado entre las cantidades de las partes?',lesson('pizza'),[good]).reason,'repetition');
});
test('one structured call classifies and proposes a question without tools, child history or access identifiers',async()=>{
 let requestBody,result,question;
 const service=createAIService({env,fetchImpl:async(url,options)=>{assert.equal(url,'https://api.openai.com/v1/responses');requestBody=JSON.parse(options.body);return response('unclear',good,{usage:{input_tokens:120,output_tokens:30}});}});
 assert.equal(await service.assess('He comparado las partes.',lesson('pizza'),{runId:'private-run',context:{previousQuestions:['¿Qué has mirado?'],help:1,studentHistory:['do-not-send'],cookie:'do-not-send'},onQuestion:q=>{question=q;},onResult:r=>{result=r;}}),'unclear');
 assert.equal(question,good);assert.equal(result.questionSource,'ai');
 assert.equal(requestBody.store,false);assert.deepEqual(requestBody.tools,[]);assert.equal(requestBody.tool_choice,'none');
 assert.equal(requestBody.max_output_tokens,250);assert.deepEqual(requestBody.text.format.schema.required,['category','question']);
 assert.ok(!JSON.stringify(requestBody).includes('private-run'));assert.ok(!JSON.stringify(requestBody).includes('do-not-send'));
 assert.equal(service.status().calls,1);assert.equal(service.status().inputTokens,120);assert.equal(service.status().outputTokens,30);
});
test('unsafe question is discarded while valid classification is preserved',async()=>{
 for(const question of unsafe){let called=false,result;
  assert.equal(await assessWithAI('He comparado las partes.',lesson('pizza'),{env,fetchImpl:async()=>response('unclear',question),onQuestion:()=>{called=true;},onResult:r=>{result=r;}}),'unclear');
  assert.equal(called,false);assert.equal(result.questionSource,'local');
 }
});
test('supported, unsure and off-topic classifications cannot attach generated tutoring text',async()=>{
 for(const category of ['supported','unsure','off-topic']){let shown=false;assert.equal(await assessWithAI('He comparado las partes.',lesson('pizza'),{env,fetchImpl:async()=>response(category,good),onQuestion:()=>{shown=true;}}),category);assert.equal(shown,false);}
});
test('repetition, refusal, incomplete output, tools and connection errors keep local guidance',async()=>{
 const malformed=[{ok:true,json:async()=>({status:'incomplete'})},{ok:true,json:async()=>({status:'completed',output:[{type:'function_call'}]})},{ok:true,json:async()=>({status:'completed',output:[{type:'message',role:'assistant',content:[{type:'refusal'}]}]})}];
 for(const fetchImpl of [...malformed.map(r=>async()=>r),async()=>{throw new Error('private-error');}]){
  let shown=false,result;await assessWithAI('He comparado las partes.',lesson('pizza'),{env,fetchImpl,onQuestion:()=>{shown=true;},onResult:r=>{result=r;}});assert.equal(shown,false);assert.equal(result.source,'local');assert.ok(!JSON.stringify(result).includes('private-error'));
 }
 let result;await assessWithAI('He comparado las partes.',lesson('pizza'),{env,fetchImpl:async()=>response('unclear',good),context:{previousQuestions:[good]},onQuestion:()=>assert.fail('repeated'),onResult:r=>{result=r;}});assert.equal(result.questionReason,'repetition');
});
test('tutor substitutes only a validated first follow-up; completion, help, contradiction and pause stay authored',async()=>{
 const s=createSession();const l=currentLesson(s);await advance(s,{type:'answer',choice:correctChoice(l)});
 await advance(s,{type:'explain',text:'He comparado las partes.'},{assess:()=> 'unclear',getQuestion:()=>good});
 assert.equal(s.messages.at(-1).text,good);assert.equal(s.messages.at(-1).questionSource,'ai');assert.equal(s.phase,'explain');
 await advance(s,{type:'explain',text:'Más partes dan trozos más grandes.'},{assess:()=>assert.fail('guard'),getQuestion:()=>good});
 assert.notEqual(s.messages.at(-1).questionSource,'ai');assert.equal(s.records.length,0);
 await advance(s,{type:'pause'});assert.equal(s.paused,true);assert.notEqual(s.messages.at(-1).questionSource,'ai');
 assert.ok(previousQuestions(s.messages).length<=3);
});
test('generated question failures share call caps and no second call is attempted',async()=>{
 let calls=0;const service=createAIService({env:{...env,LUMA_AI_MAX_CALLS:'1'},fetchImpl:async()=>{calls++;return response('unclear','La respuesta es 14.');}});
 for(let i=0;i<2;i++)await service.assess('He comparado las partes.',lesson('pizza'),{onQuestion:()=>assert.fail('unsafe')});
 assert.equal(calls,1);assert.equal(service.status().questionsRejected,1);assert.equal(service.status().blockedReason,'limit');
});

test('adult diagnostics are explicit and rejected text never enters ordinary result metadata',async()=>{
 const privateProposal='¿Qué parte del ejercicio puedes abrir en https://private.invalid?';
 let diagnostic,result,shown=false;
 await assessWithAI('He comparado las partes.',lesson('pizza'),{env,fetchImpl:async()=>response('unclear',privateProposal),onQuestion:()=>{shown=true;},onDiagnostic:d=>{diagnostic=d;},onResult:r=>{result=r;}});
 assert.equal(shown,false);assert.equal(diagnostic.question,privateProposal);assert.equal(diagnostic.validation.ok,false);
 assert.ok(!JSON.stringify(result).includes('private.invalid'));assert.ok(!Object.hasOwn(result,'question'));
});

test('reviewed real proposals accept neutral synonyms only in their exercise scope',()=>{
 assert.equal(validateQuestion('¿Qué has observado sobre el tamaño de los trozos en el ejercicio?',lesson('juice')).ok,true);
 assert.equal(validateQuestion('¿Qué parte del ejercicio has revisado para tu respuesta?',lesson('cards')).ok,true);
 assert.equal(validateQuestion('¿Qué has observado entre las partes de las pizzas?',lesson('pizza')).ok,true);
 for(const id of ['cards','steps','juice'])assert.equal(validateQuestion('¿Qué has observado entre las partes de las pizzas?',lesson(id)).ok,false,id);
 for(const q of ['¿Cuál es la respuesta del ejercicio?','¿Qué parte del ejercicio muestra la respuesta correcta?','¿Qué has observado entre las partes de las pizzas mayores?','¿Qué parte del ejercicio has revisado para tu contraseña?'])assert.equal(validateQuestion(q,lesson('pizza')).ok,false,q);
});
