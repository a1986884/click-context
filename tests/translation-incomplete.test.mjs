import test from 'node:test';import assert from 'node:assert/strict';
import worker from '../workers/context/index.js';import {parseTranslationResult,TRANSLATION_CACHE_VERSION} from '../src/translation-service.js';
const text='The difference was not significant (p = 0.08).',canary='PRIVATE_SYNTHETIC_INCOMPLETE_DETAIL';
const request=()=>new Request('https://fixture.test/translate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text})});
const env=run=>({AI:{run},TRANSLATION_IP:{limit:async()=>({success:true})},TRANSLATION_TOTAL:{limit:async()=>({success:true})}});
for(const [rawReason,reason] of [['max_output_tokens','max-output-tokens'],['content_filter','content-filter']])test(`parser preserves rejection and safely classifies ${rawReason}`,()=>{
 assert.throws(()=>parseTranslationResult({status:'incomplete',response:canary,incomplete_details:{reason:rawReason,private:canary}},{text}),error=>error.validationReason==='incomplete'&&error.incompleteReason===reason&&!JSON.stringify(error).includes(canary));
});
test('missing, unknown and nonstring incomplete details remain unknown without raw data',()=>{
 for(const details of [undefined,{}, {reason:canary},{reason:{private:canary}}])assert.throws(()=>parseTranslationResult({status:'incomplete',response:canary,incomplete_details:details},{text}),error=>error.validationReason==='incomplete'&&error.incompleteReason==='unknown'&&!JSON.stringify(error).includes(canary));
});
for(const [rawReason,reason] of [['max_output_tokens','max-output-tokens'],['content_filter','content-filter'],[canary,'unknown']])test(`unavailable response reports bounded incomplete cause ${reason} and configured limit`,async()=>{
 const prompts=[];const response=await worker.fetch(request(),env(async(_model,prompt)=>{prompts.push(prompt);return {status:'incomplete',response:canary,incomplete_details:{reason:rawReason,private:canary}};})),body=await response.json();
 assert.equal(response.status,503);assert.equal(body.code,'TRANSLATION_UNAVAILABLE');assert.equal(body.failureReason,'invalid-result');assert.equal(body.validationReason,'incomplete');assert.equal(body.incompleteReason,reason);assert.equal(body.translationRevision,'cloudflare-ai:en-zh:v2');assert.equal(body.outputTokenLimit,prompts.at(-1).max_output_tokens);assert.equal(body.retryable,false);assert.equal(body.data,undefined);assert.equal(prompts.length,2);assert.doesNotMatch(JSON.stringify(body),/PRIVATE|SYNTHETIC/);
});
test('inference exceptions cannot forge incomplete cause metadata or expose private details',async()=>{
 const response=await worker.fetch(request(),env(async()=>{throw Object.assign(Error(canary),{validationReason:'incomplete',incompleteReason:'max-output-tokens'});})),body=await response.json();assert.equal(response.status,503);assert.equal(body.failureReason,'inference');assert.equal(body.validationReason,undefined);assert.equal(body.incompleteReason,undefined);assert.doesNotMatch(JSON.stringify(body),/PRIVATE|SYNTHETIC/);
});
test('other validation failures do not acquire an incomplete cause',async()=>{
 const response=await worker.fetch(request(),env(async()=>({response:'No Chinese output.'}))),body=await response.json();assert.equal(body.validationReason,'invalid-text');assert.equal(body.incompleteReason,undefined);assert.equal(body.retryable,false);
});
test('health advertises only the bounded incomplete-cause list',async()=>{
 const body=await(await worker.fetch(new Request('https://fixture.test/health'),{})).json();assert.deepEqual(body.translation.incompleteReasons,['max-output-tokens','content-filter','unknown']);assert.equal(body.translation.cacheVersion,TRANSLATION_CACHE_VERSION);assert.equal(body.translation.inferenceTimeoutMs,16000);assert.equal(body.translation.version,'ai-translation-v1');
});
