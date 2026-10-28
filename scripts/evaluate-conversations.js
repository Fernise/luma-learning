import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {octoberDialogueCases} from '../lib/dialogue-october-cases.js';
import {conversationCases as originalCases} from '../lib/conversation-cases.js';
import {dialogueExpansionCases} from '../lib/dialogue-expansion-cases.js';
const expanded = process.argv.includes('--expanded');
const fresh = process.argv.includes('--fresh-dialogue');
const conversationCases = fresh ? octoberDialogueCases : expanded ? dialogueExpansionCases : originalCases;
const artifactDirectory = fresh ? 'conversaciones-1021' : expanded ? 'dialogo-ampliado' : 'conversaciones-nuevas';
import {missions} from '../lib/catalog.js';
import {advance,createSession,correctChoice} from '../lib/tutor.js';
import {assessLocally} from '../lib/reasoning.js';
const results=[];
for(const item of conversationCases){
 const mission=missions.find(m=>m.lessons.some(l=>l.id===item.lessonId));const lesson=mission.lessons.find(l=>l.id===item.lessonId);
 const session=Object.assign(createSession({missionId:mission.id}),{lessonIds:[lesson.id],routeLength:1});
 await advance(session,{type:'hint'});await advance(session,{type:'answer',choice:item.wrongChoice?1-correctChoice(lesson):correctChoice(lesson)});
 const turns=[];
 for(const turn of item.turns){let calls=0,error=null,guardReason=null;try{
  await advance(session,turn.action?{type:turn.action==='correct-choice'?'answer':turn.action,...(turn.action==='correct-choice'?{choice:correctChoice(lesson)}:{})}:{type:'explain',text:turn.text},{onGuard:({reason})=>{guardReason=reason;},assess:(text,l)=>{calls++;return turn.guard?'supported':assessLocally(text,l);}});
 }catch(e){error=e.message;}
 const state=session.paused?'paused':session.phase==='complete'?session.records.at(-1)?.reasoning:'open';
 const response=session.messages.at(-1).text;
 const passed=!error&&state===turn.expect&&(!turn.contains||response.includes(turn.contains))&&(!turn.guard||calls===0)&&(!turn.reason||guardReason===turn.reason);
 turns.push({...turn,state,response,simulatedClassifierCalls:calls,guardReason,error,passed});
 }
 results.push({id:item.id,lessonId:lesson.id,passed:turns.every(t=>t.passed),turns});
}
const summary={conversations:results.length,turns:results.reduce((n,r)=>n+r.turns.length,0),passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).map(r=>r.id),realProviderCalls:0};
await mkdir(new URL(`../artifacts/${artifactDirectory}/`,import.meta.url),{recursive:true});
await writeFile(new URL(`../artifacts/${artifactDirectory}/${process.argv.includes('--baseline')?'antes':'despues'}.json`,import.meta.url),JSON.stringify({date:new Date().toISOString(),corpusHash:createHash('sha256').update(JSON.stringify(conversationCases)).digest('hex'),scope:'Authored expectations frozen before corrections; post-fix cases are known regressions, not independent child accuracy.',summary,results},null,2)+'\n',process.argv.includes('--baseline')?{flag:'wx'}:undefined);
console.log(JSON.stringify(summary));if(summary.failed.length)process.exitCode=1;
