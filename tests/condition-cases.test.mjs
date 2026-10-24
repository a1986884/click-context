import test from 'node:test';import assert from 'node:assert/strict';
import {conditionCases,assertSufficientCondition,assertBiconditional,assertNotAbove} from './live/condition-cases.mjs';
import {collectTranslationSamples} from './live/translation-probe.mjs';
import {TRANSLATION_CACHE_VERSION,TRANSLATION_CURRENT_MODEL} from '../src/translation-service.js';
test('if constraints accept sufficiency and reject a stronger necessary condition',()=>{
 assert.doesNotThrow(()=>assertSufficientCondition('若观测相互独立，则估计有效。'));assert.throws(()=>assertSufficientCondition('估计仅在观测相互独立时才有效。'));assert.throws(()=>assertSufficientCondition('当且仅当观测相互独立时，估计有效。'));assert.throws(()=>assertSufficientCondition('若观测相互独立，估计才有效。'));
});
test('if-and-only-if constraints reject either single direction',()=>{
 assert.doesNotThrow(()=>assertBiconditional('当且仅当观测相互独立时，估计有效。'));assert.throws(()=>assertBiconditional('若观测相互独立，则估计有效。'));assert.throws(()=>assertBiconditional('估计仅在观测相互独立时才有效。'));
});
test('not-above constraints preserve the inclusive bound and decimal',()=>{
 for(const text of ['压力不高于5.0巴','压力小于或等于5.0巴','压力≤5.0巴'])assert.doesNotThrow(()=>assertNotAbove(text));
 for(const text of ['压力高于5.0巴','压力不低于5.0巴','压力低于5.0巴','压力不超过5巴'])assert.throws(()=>assertNotAbove(text));
});
test('a custom seven-case matrix awaits validation and continues after a semantic failure exactly once per case',async()=>{
 const outputs=['估计仅在观测相互独立时有效；见式（3）和图2。','估计只有在观测相互独立时才有效；见式（3）和图2。','当且仅当观测相互独立时，估计有效；见式（3）和图2。','只有压力不高于5.0巴，警报才停止。','若压力不高于5.0巴，则警报停止。','当且仅当压力不高于5.0巴时，警报停止。','估计仅在观测相互独立时有效；见式（3）和图2。'],calls=[],report={};
 const page={evaluate:async(fn,{text})=>{const index=calls.length;calls.push(text);return {status:200,elapsedMs:1,body:{ok:true,data:{text:outputs[index],model:TRANSLATION_CURRENT_MODEL,version:TRANSLATION_CACHE_VERSION}}};}};
 await collectTranslationSamples(page,report,{samples:conditionCases.map(c=>c.text),validate:async(translated,index)=>{await Promise.resolve();conditionCases[index].validate(translated);}});
 assert.equal(report.samples.length,7);assert.deepEqual(calls,conditionCases.map(c=>c.text));assert.equal(report.failureCount,1);assert.equal(report.samples[1].failureKind,'validation');assert.ok(report.samples.filter((_,i)=>i!==1).every(s=>s.verdict==='passed'));
});
test('observed compound biconditional wording retains both directions',()=>{
 assert.doesNotThrow(()=>assertBiconditional('只要且仅当观测值相互独立，该估计才有效；参见式(3)和图2。'));
 assert.throws(()=>assertBiconditional('只要观测值相互独立，该估计有效。'));assert.throws(()=>assertBiconditional('仅当观测值相互独立，该估计才有效。'));
});

test('the current probe validates the current model and still rejects a legacy model under the new revision',async()=>{
 for(const model of [TRANSLATION_CURRENT_MODEL,'@cf/openai/gpt-oss-120b']){
  const report={},page={evaluate:async()=>({status:200,elapsedMs:1,body:{ok:true,data:{text:'公开译文',model,version:TRANSLATION_CACHE_VERSION}}})};
  await collectTranslationSamples(page,report,{samples:['A public sentence.'],validate:()=>{}});assert.equal(report.failureCount,model===TRANSLATION_CURRENT_MODEL?0:1);if(model!==TRANSLATION_CURRENT_MODEL)assert.equal(report.samples[0].failureKind,'protocol');
 }
});
