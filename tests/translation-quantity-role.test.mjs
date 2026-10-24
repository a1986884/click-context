import test from 'node:test';import assert from 'node:assert/strict';import {parseTranslationResult} from '../src/translation-service.js';import worker from '../workers/context/index.js';
const revision='cloudflare-ai:en-zh:v4';
const source='The mean temperature was -2.0 degrees Celsius, with a 95% confidence interval of [1.2, 2.3].';
const observed='平均温度为-2.0摄氏度，置信区间为95%，区间为[1.2, 2.3]。';
test('actual first98 confidence-level-as-interval output is rejected despite preserving every number',()=>assert.throws(()=>parseTranslationResult({response:observed},{text:source,translationRevision:revision}),e=>e.validationReason==='quantity-role-mismatch'));
for(const level of ['80','90','99.9'])test(`confidence role rejection is not hardcoded to the 95 percent sample: ${level}`,()=>assert.throws(()=>parseTranslationResult({response:`置信区间是${level}%，区间为[4.0, 9.0]。`},{text:`The ${level}% confidence interval is [4.0, 9.0].`,translationRevision:revision}),e=>e.validationReason==='quantity-role-mismatch'));
for(const zh of ['平均温度为-2.0摄氏度，95%置信区间为[1.2, 2.3]。','平均温度为-2.0摄氏度，置信区间（95%）为[1.2, 2.3]。','平均温度为-2.0摄氏度，置信水平为95%，区间为[1.2, 2.3]。'])test('correct confidence-role wording is accepted: '+zh,()=>assert.equal(parseTranslationResult({response:zh},{text:source,translationRevision:revision}).text,zh));
test('an endpoint genuinely equal to the confidence percentage is not a mismatched role',()=>{
 const text='The 95% confidence interval is [95%, 99%].',zh='95%置信区间为95%至99%。';assert.equal(parseTranslationResult({response:zh},{text,translationRevision:revision}).text,zh);
});
test('unrelated percentage intervals and legacy routes retain their previous acceptance',()=>{
 const text='The interval is 95%, with range [1.2, 2.3].',zh='区间为95%，范围为[1.2, 2.3]。';assert.equal(parseTranslationResult({response:zh},{text,translationRevision:revision}).text,zh);
 for(const translationRevision of ['cloudflare-ai:en-zh:v2','cloudflare-ai:en-zh:v3'])assert.equal(parseTranslationResult({response:observed},{text:source,translationRevision}).text,observed);
});
test('the service rejects the role error with bounded diagnostics and no partial output',async()=>{
 let calls=0;const request=new Request('https://fixture.test/translate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text:source,translationRevision:revision})});const response=await worker.fetch(request,{AI:{run:async()=>{calls++;return {response:observed};}},TRANSLATION_IP:{limit:async()=>({success:true})},TRANSLATION_TOTAL:{limit:async()=>({success:true})}}),body=await response.json();assert.equal(response.status,503);assert.equal(body.validationReason,'quantity-role-mismatch');assert.equal(calls,2);assert.equal(body.retryable,false);assert.equal(body.data,undefined);assert.ok(!JSON.stringify(body).includes(observed));
});
