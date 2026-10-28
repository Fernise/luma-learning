import test from 'node:test';
import assert from 'node:assert/strict';
import {buildProgressExport} from '../public/storage.js';
const id='5aaa0000-1111-2222-3333-444444444444';
const missions=[{id:'logic',title:'El club de las pistas'}];
const record={lessonId:'some',attempts:2,help:1,reasoningAttempts:2,reasoning:'needs-review',confidence:'sure',level:2,transfer:false,unaided:false};
const run={id,missionId:'logic',savedAt:'2026-10-25T09:00:00Z',finished:false,total:5,records:[record]};
test('export re-sanitizes history and removes credentials, raw conversation and learner explanations',()=>{
 const result=buildProgressExport([{...run,token:'CANARY',messages:['CANARY'],explanation:'CANARY',title:'CANARY',records:[{...record,explanation:'CANARY',title:'CANARY'}]}],missions,'2026-10-25T10:00:00Z');
 const json=JSON.stringify(result);
 assert.doesNotMatch(json,/CANARY|5aaa0000|token|messages|explanation|"id"/);
 assert.equal(result.runs.length,1);
 assert.deepEqual(result.runs[0].records[0],record);
 assert.equal(result.runs[0].title,missions[0].title);
 assert.match(result.note,/No constituyen una evaluación validada/);
});
test('export skips malformed and empty records, preserves older optional fields and bounds history',()=>{
 const old={...run,records:[{attempts:1,help:0,reasoning:'not-requested'}]};
 const result=buildProgressExport([null,{...run,savedAt:'invalid'},{...run,missionId:'unknown'},{...run,records:[]},old],missions);
 assert.equal(result.runs.length,1);
 assert.equal(result.runs[0].records[0].reasoningAttempts,null);
 assert.equal(result.runs[0].records[0].reasoning,'not-requested');
 assert.equal(buildProgressExport(Array(25).fill(run),missions).runs.length,20);
});
