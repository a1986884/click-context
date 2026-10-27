import {test} from 'node:test';import assert from 'node:assert/strict';
import {buildExperimentPlan,scoreExperiment,EXPERIMENT_INSTRUCTIONS,experimentCases} from '../scripts/context-specificity-experiment.mjs';
import {specificityAccuracyCases} from './live/context-accuracy-specificity.mjs';
const cases=specificityAccuracyCases.slice(0,2),plan=()=>buildExperimentPlan({cases,createdAt:'2026-10-25T13:00:00Z'});
function observation(request,zh,{lemma='terminal',pos='NOUN'}={}){return {requestId:request.id,promptSHA256:request.promptSHA256,model:request.model,success:true,raw:{response:JSON.stringify({senseId:null,lemma,pos,zh})}};}
test('experiment separates benchmark answers from requests and changes instructions only',()=>{
 const p=buildExperimentPlan();assert.equal(p.requests.length,60);assert.equal(experimentCases().length,30);assert.match(p.kind,/no inference/);assert.doesNotMatch(EXPERIMENT_INSTRUCTIONS,/航站楼|应变|应力|She saw|terminal|station|TCP/);
 for(const sample of p.samples){const a=p.requests.find(r=>r.caseId===sample.id&&r.variant==='baseline'),b=p.requests.find(r=>r.caseId===sample.id&&r.variant==='candidate');const {instructions:ai,...ar}=a.body,{instructions:bi,...br}=b.body;assert.deepEqual(ar,br);assert.notEqual(ai,bi);const data=JSON.parse(a.body.input);assert.equal(data.senses,undefined);assert.equal(data.expected,undefined);assert.equal(data.forbidden,undefined);assert.equal(data.markedSentence.slice(0,data.offset),data.sentence.slice(0,data.offset));}
});
test('quota refusal and missing observations cannot be counted as completed comparisons',()=>{
 const p=plan(),r=p.requests[0],report=scoreExperiment(p,[{requestId:r.id,promptSHA256:r.promptSHA256,model:r.model,success:false,http:429,code:4006}],{cases});assert.deepEqual(report.counts,{unavailable:1,'not-run':3});assert.ok(report.pairs.every(p=>p.status==='not-comparable'));assert.equal(report.runtimePromptChanged,false);
});
test('synthetic paired results keep improvements provisional and report regressions alongside them',()=>{
 const p=plan(),observations=p.requests.map(r=>observation(r,r.caseId===cases[0].id?(r.variant==='baseline'?'航站楼':'终端（具体类型不明）'):(r.variant==='baseline'?'航站楼':'不明'))),report=scoreExperiment(p,observations,{cases});assert.deepEqual(report.pairs.map(p=>p.status),['possible-rule-improvement','rule-regression']);assert.ok(report.allOutputsNeedHumanReview);assert.equal(report.rows.find(r=>r.variant==='candidate'&&r.caseId===cases[0].id).evaluation.status,'needs-human-review');
});
test('replayed, duplicate, unknown, altered-budget and mismatched observations are rejected',()=>{
 const p=plan(),o=observation(p.requests[0],'终端');assert.throws(()=>scoreExperiment(p,[o,o],{cases}),/duplicate/);assert.throws(()=>scoreExperiment(p,[{...o,requestId:'unknown'}],{cases}),/Unknown/);assert.throws(()=>scoreExperiment(p,[{...o,promptSHA256:'wrong'}],{cases}),/mismatched/);
 const changed=structuredClone(p);changed.requests[0].body.max_output_tokens=1800;assert.throws(()=>scoreExperiment(changed,[],{cases}),/altered/);
 const shifted=structuredClone(p);shifted.samples[0].input.offset=0;assert.throws(()=>scoreExperiment(shifted,[],{cases}),/Changed sample/);
 const missing=structuredClone(p);missing.requests.pop();assert.throws(()=>scoreExperiment(missing,[],{cases}),/Incomplete/);
});
test('incomplete and schema-invalid output is never a semantic success',()=>{
 const p=plan(),a=observation(p.requests[0],'终端');a.raw.status='incomplete';const b=observation(p.requests[1],'终端');b.raw={senseId:null,zh:'终端'};const report=scoreExperiment(p,[a,b],{cases});assert.equal(report.counts['invalid-output'],2);assert.ok(report.pairs.every(p=>p.status==='not-comparable'));
});
