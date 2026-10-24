import test from 'node:test';import assert from 'node:assert/strict';
import worker from '../workers/context/index.js';
import {TRANSLATION_PREVIOUS_CACHE_VERSION,TRANSLATION_LEGACY_CACHE_VERSION,cleanTranslation,translationPrompt} from '../src/translation-service.js';
const text='The treatment reduced mortality from 12.5% to 8.0%, but the difference was not statistically significant (p = 0.08).';
const translated='治疗使死亡率从12.5%降至8.0%，但差异没有统计显著性（p = 0.08）。';
const incomplete={status:'incomplete',incomplete_details:{reason:'max_output_tokens'},response:translated};
const request=()=>new Request('https://fixture.test/translate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text,translationRevision:TRANSLATION_PREVIOUS_CACHE_VERSION})});
const env=run=>({AI:{run},TRANSLATION_IP:{limit:async()=>({success:true})},TRANSLATION_TOTAL:{limit:async()=>({success:true})}});
test('previous v3 translation can complete a short reasoning-bound response within one bounded inference',async()=>{
 const prompts=[];const response=await worker.fetch(request(),env(async(_model,prompt)=>{prompts.push(prompt);return prompt.max_output_tokens<1600?incomplete:{response:translated};}));
 assert.equal(response.status,200);assert.equal((await response.json()).data.text,translated);assert.equal(prompts.length,1);assert.ok(prompts[0].max_output_tokens<=2600);assert.deepEqual(prompts[0].reasoning,{effort:'low'});
});
test('headroom still rejects complete-looking truncated output and keeps two-attempt ceiling and final limit diagnostics',async()=>{
 const limits=[];const response=await worker.fetch(request(),env(async(_model,prompt)=>{limits.push(prompt.max_output_tokens);return incomplete;})),body=await response.json();
 assert.equal(response.status,503);assert.equal(body.failureReason,'invalid-result');assert.equal(body.validationReason,'incomplete');assert.equal(body.incompleteReason,'max-output-tokens');assert.deepEqual(limits,[1600,1600]);assert.equal(body.outputTokenLimit,limits.at(-1));assert.equal(body.data,undefined);assert.equal(body.retryable,false);assert.ok(!JSON.stringify(body).includes(translated));
});
test('a slow token-limited first response does not start another inference or extend the deadline',async t=>{
 const originalNow=Date.now.bind(Date),origin=originalNow();let elapsed=0,calls=0;const deadlines=[];const timeout=AbortSignal.timeout.bind(AbortSignal);t.mock.method(Date,'now',()=>origin+elapsed);t.mock.method(AbortSignal,'timeout',ms=>{deadlines.push(ms);return timeout(ms);});
 const response=await worker.fetch(request(),env(async()=>{calls++;elapsed=5001;return incomplete;})),body=await response.json();
 assert.equal(response.status,503);assert.equal(calls,1);assert.deepEqual(deadlines,[16000]);assert.equal(body.outputTokenLimit,1600);assert.equal(body.incompleteReason,'max-output-tokens');
});
test('long inputs remain capped and legacy clients keep their original short-text budget',()=>{
 const long='A public sentence about the result. '.repeat(50);assert.ok(long.length<=1800);
 const current=translationPrompt(cleanTranslation({text:long,translationRevision:TRANSLATION_PREVIOUS_CACHE_VERSION}));assert.ok(current.max_output_tokens>1600&&current.max_output_tokens<=2600);
 for(const revision of [undefined,TRANSLATION_LEGACY_CACHE_VERSION])assert.equal(translationPrompt(cleanTranslation({text,...(revision?{translationRevision:revision}:{})})).max_output_tokens,1000);
});
