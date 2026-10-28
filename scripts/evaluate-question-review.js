import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {missions} from '../lib/catalog.js';
import {validateQuestion} from '../lib/question-policy.js';
import {questionReviewCases} from '../lib/question-review-cases.js';

const baseline=process.argv.includes('--baseline');
const results=questionReviewCases.map(c=>{
  const lesson=missions.flatMap(m=>m.lessons).find(l=>l.id===c.lesson);
  const validation=validateQuestion(c.question,lesson,c.previous);
  return {...c,validation,passed:validation.ok===c.accept};
});
const summary={cases:results.length,passed:results.filter(r=>r.passed).length,expectedAccepts:results.filter(r=>r.accept).length,falseRejections:results.filter(r=>r.accept&&!r.validation.ok).map(r=>r.id),falseAcceptances:results.filter(r=>!r.accept&&r.validation.ok).map(r=>r.id),rejectionStageDifferences:results.filter(r=>r.reason&&r.validation.reason!==r.reason).map(r=>({id:r.id,preferred:r.reason,actual:r.validation.reason})),realCalls:0};
const dir=new URL('../artifacts/preguntas-1023/',import.meta.url);await mkdir(dir,{recursive:true});
await writeFile(new URL(baseline?'antes.json':'despues.json',dir),JSON.stringify({date:new Date().toISOString(),scope:'Fixed authored regression corpus; no provider or independent child accuracy claim.',corpusHash:createHash('sha256').update(JSON.stringify(questionReviewCases)).digest('hex'),summary,results},null,2)+'\n',baseline?{flag:'wx'}:undefined);
console.log(JSON.stringify(summary));if(summary.passed!==summary.cases)process.exitCode=1;
