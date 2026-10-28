import {readFile} from 'node:fs/promises';
import {adaptiveEvaluationCases} from '../lib/adaptive-evaluation-cases.js';
import {createApp} from '../server.js';import {missions} from '../lib/catalog.js';import {assessLocally} from '../lib/reasoning.js';
const recorded=new Map();
if(process.argv.includes('--recorded'))for(const name of ['1021-diagnostico','1021-nuevo-real']){
 const report=JSON.parse(await readFile(new URL('../artifacts/tutor-adaptativo/evaluacion-real-'+name+'.json',import.meta.url),'utf8'));
 for(const item of report.results){const id=item.lessonId??adaptiveEvaluationCases.find(c=>c.id===item.id)?.lesson;for(const turn of item.turns)if(turn.diagnostic)recorded.set(id+'\0'+turn.text,turn.diagnostic);}
}
if(process.argv.includes('--recorded-expedition')){
 const report=JSON.parse(await readFile(new URL('../artifacts/expediciones-1022/real-1022.json',import.meta.url),'utf8'));
 for(const event of report.results[0].events)if(event.diagnostic)recorded.set(event.lessonId+'\0'+event.action.text,event.diagnostic);
}
const server=createApp({env:{OPENAI_API_KEY:'simulated-only',OPENAI_MODEL:'simulated-local'},fetchImpl:async(_url,options)=>{
 const payload=JSON.parse(options.body);const input=JSON.parse(payload.input[0].content);
 const lesson=missions.flatMap(m=>m.lessons).find(l=>l.context===input.exercise.context&&l.prompt===input.exercise.prompt);
 const replay=recorded.get(lesson.id+'\0'+input.learnerExplanation);
 const category=replay?.category??assessLocally(input.learnerExplanation,lesson);
 const question=process.argv.includes('--observation-echo')&&lesson.fractions&&category==='unclear'?'¿Qué has comparado entre los tamaños de los trozos?':replay?replay.question:category==='unclear'?(lesson.kind==='pattern'?'¿Qué cambio observas entre pasos conocidos?':lesson.kind==='logic'?'¿Qué pista del ejercicio apoya tu elección?':'¿Qué has comparado entre las partes de las cantidades?'):null;
 return {ok:true,json:async()=>({status:'completed',usage:{input_tokens:300,output_tokens:35},output:[{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify({category,question})}]}]})};
}});
server.listen(4174,'127.0.0.1',()=>console.log((recorded.size?'Recorded real proposals replay: ':'Simulated adaptive tutor: ')+'http://localhost:4174 · memory only · no new API calls'));
