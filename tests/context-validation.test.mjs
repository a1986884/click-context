import {test} from 'node:test';import assert from 'node:assert/strict';
import {parseContextResult,createContextClient} from '../src/context-meaning.js';
import worker from '../workers/context/index.js';
const input={word:'bank',sentence:'They sat on the bank.',offset:16,senses:[{id:'river',zh:'河岸',definition:'Land beside water.',pos:'N'}]};
const request=signal=>new Request('https://context.test/meaning',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input),signal});
const env=run=>({AI:{run},PER_IP:{limit:async()=>({success:true})},TOTAL:{limit:async()=>({success:true})}});
const privateText='PRIVATE SYNTHETIC OUTPUT';
const cases=[
 ['incomplete',{status:'incomplete',response:'{"senseId":"river","zh":"河岸"}'}],
 ['invalid-json',{response:privateText}],
 ['invalid-shape',{response:'{"wrong":"field"}'}],
 ['unknown-sense',{response:'{"senseId":"invented","zh":"河岸"}'}],
 ['invalid-text',{response:'{"senseId":"river","zh":"'+privateText+'"}'}]
];
for(const [reason,raw]of cases)test('context validation exposes only fixed '+reason+' classification',async()=>{
 assert.throws(()=>parseContextResult(raw,input),error=>error.validationReason===reason&&!error.message.includes(privateText));
 let calls=0;const response=await worker.fetch(request(),env(async()=>{calls++;return raw;})),body=await response.json();
 assert.equal(response.status,503);assert.equal(body.code,'CONTEXT_INVALID_RESULT');assert.equal(body.validationReason,reason);assert.equal(body.retryable,false);assert.equal(calls,2);assert.doesNotMatch(JSON.stringify(body),/PRIVATE|invented|wrong/);
});
test('final failed attempt determines the reason; successful retry has no diagnostic fields',async()=>{
 let calls=0;const response=await worker.fetch(request(),env(async()=>++calls===1?cases[1][1]:cases[0][1]));assert.equal((await response.json()).validationReason,'incomplete');assert.equal(calls,2);
 calls=0;const ok=await worker.fetch(request(),env(async()=>++calls===1?cases[1][1]:{response:'{"senseId":"river","zh":"河岸"}'})),body=await ok.json();assert.equal(ok.status,200);assert.equal(body.data.zh,'河岸');assert.ok(!('validationReason'in body));assert.ok(!('validationReason'in body.data));
});
test('inference errors cannot supply validation reasons, and cancellation takes priority',async()=>{
 const bad=await worker.fetch(request(),env(async()=>{throw Object.assign(Error(privateText),{validationReason:'incomplete'});})),body=await bad.json();assert.equal(body.code,'CONTEXT_UNAVAILABLE');assert.ok(!('validationReason'in body));assert.doesNotMatch(JSON.stringify(body),/PRIVATE/);
 const controller=new AbortController();const canceled=await worker.fetch(request(controller.signal),env(async()=>{controller.abort();return cases[0][1];})),c=await canceled.json();assert.equal(c.code,'CONTEXT_CANCELLED');assert.ok(!('validationReason'in c));
});
test('client accepts only the fixed reason list and keeps old server responses compatible',async()=>{
 for(const reason of ['incomplete','invalid-json','invalid-shape','unknown-sense','invalid-text','unknown',privateText,undefined]){
  const client=createContextClient({fetcher:async()=>Response.json({ok:false,code:'CONTEXT_INVALID_RESULT',validationReason:reason},{status:503})});
  await assert.rejects(client(input),error=>error.code==='CONTEXT_INVALID_RESULT'&&error.validationReason===(reason===privateText||reason===undefined?'unknown':reason)&&!error.message.includes(privateText));
 }
 const client=createContextClient({fetcher:async()=>Response.json({ok:false,code:'CONTEXT_UNAVAILABLE',validationReason:privateText},{status:503})});await assert.rejects(client(input),error=>!('validationReason'in error));
});
test('health publishes the fixed context reasons separately from translation diagnostics',async()=>{
 const body=await(await worker.fetch(new Request('https://context.test/health'),{})).json();assert.deepEqual(body.contextValidationReasons,['incomplete','invalid-json','invalid-shape','unknown-sense','invalid-text','unknown']);assert.equal(body.translation.inferenceTimeoutMs,16000);
});
