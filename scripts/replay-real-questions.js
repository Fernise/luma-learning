import {readFile,writeFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
import {advance,createSession,correctChoice} from '../lib/tutor.js';import {validateQuestion,previousQuestions} from '../lib/question-policy.js';
import {adaptiveEvaluationCases} from '../lib/adaptive-evaluation-cases.js';import {novelAdaptiveCases} from '../lib/novel-adaptive-cases.js';import {missions} from '../lib/catalog.js';
const cases=[...adaptiveEvaluationCases,...novelAdaptiveCases];const results=[];
for(const tag of ['1021-diagnostico','1021-nuevo-real']){
 const source=await readFile(new URL('../artifacts/tutor-adaptativo/evaluacion-real-'+tag+'.json',import.meta.url),'utf8');const report=JSON.parse(source);
 for(const item of report.results){
  const spec=cases.find(c=>c.id===item.id);const mission=missions.find(m=>m.lessons.some(l=>l.id===spec.lesson));const lesson=mission.lessons.find(l=>l.id===spec.lesson);
  const session=Object.assign(createSession({missionId:mission.id}),{lessonIds:[lesson.id],routeLength:1});await advance(session,{type:'hint'});await advance(session,{type:'answer',choice:spec.wrong?1-correctChoice(lesson):correctChoice(lesson)});
  for(const turn of item.turns){
   const diagnostic=turn.diagnostic;const validation=diagnostic?.question?validateQuestion(diagnostic.question,lesson,previousQuestions(session.messages)):null;
   await advance(session,turn.text==='correct-choice'?{type:'answer',choice:correctChoice(lesson)}:{type:'explain',text:turn.text},{assess:()=>diagnostic?.category??'unclear',getQuestion:()=>diagnostic?.question??null});
   results.push({case:item.id,lesson:lesson.id,source:tag,sourceHash:createHash('sha256').update(source).digest('hex'),input:turn.text,question:diagnostic?.question??null,validation,originallyShown:turn.shown,shownNow:session.messages.at(-1).questionSource==='ai',response:session.messages.at(-1).text,state:session.phase==='complete'?session.records.at(-1)?.reasoning:'open',expectedState:turn.expectedState});
  }
 }
}
const summary={realCalls:0,recordedQuestions:results.filter(r=>r.question).length,originallyShown:results.filter(r=>r.originallyShown).length,shownNow:results.filter(r=>r.shownNow).length,stateMismatches:results.filter(r=>r.state!==r.expectedState).length};
await writeFile(new URL('../artifacts/tutor-adaptativo/reproduccion-1021.json',import.meta.url),JSON.stringify({date:new Date().toISOString(),scope:'Replay of already-known real proposals, no new generation or independent accuracy claim.',summary,results},null,2)+'\n');console.log(JSON.stringify(summary));if(summary.stateMismatches)process.exitCode=1;
