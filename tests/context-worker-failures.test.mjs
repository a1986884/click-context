import {test} from 'node:test';import assert from 'node:assert/strict';import worker from '../workers/context/index.js';import {createContextClient} from '../src/context-meaning.js';
const input={word:'bank',sentence:'They sat on the bank.',offset:16,senses:[{id:'river',lemma:'bank',pos:'N',zh:'河岸',definition:'Land beside water.'}]};
const request=()=>new Request('https://context.test/meaning',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});
const environment=run=>({AI:{run},PER_IP:{limit:async()=>({success:true})},TOTAL:{limit:async()=>({success:true})}});
test('the service distinguishes invalid output from inference failure without exposing raw model/error data',async()=>{
 for(const [run,code]of [[async()=>{throw Error('PRIVATE SYNTHETIC MODEL ERROR');},'CONTEXT_UNAVAILABLE'],[async()=>({response:'PRIVATE SYNTHETIC MODEL OUTPUT'}),'CONTEXT_INVALID_RESULT'],[async()=>({status:'incomplete',response:'{"senseId":"river","zh":"河岸"}'}),'CONTEXT_INVALID_RESULT']]){
  let calls=0;const response=await worker.fetch(request(),environment(async()=>{calls++;return run();}));assert.equal(response.status,503);const body=await response.json();assert.equal(body.code,code);assert.equal(body.retryable,false);assert.equal(calls,2);assert.doesNotMatch(JSON.stringify(body),/PRIVATE/);
 }
 let calls=0;const response=await worker.fetch(request(),environment(async()=>++calls===1?{status:'incomplete',response:'{"senseId":"river","zh":"河岸"}'}:{response:'{"senseId":"river","zh":"河岸"}'}));assert.equal(response.status,200);assert.equal(calls,2);assert.equal((await response.json()).data.zh,'河岸');
});
test('client honors bounded server error categories without accepting arbitrary upstream codes',async()=>{
 for(const code of ['CONTEXT_TIMEOUT','CONTEXT_INVALID_RESULT','CONTEXT_UNAVAILABLE']){
  const client=createContextClient({fetcher:async()=>Response.json({ok:false,error:'Generic response',code},{status:503})});await assert.rejects(client(input),e=>e.code===code&&e.upstreamStatus===503);
 }
 const client=createContextClient({fetcher:async()=>Response.json({ok:false,error:'Unavailable',code:'UNTRUSTED_CODE'},{status:503})});await assert.rejects(client(input),e=>e.code==='CONTEXT_UNAVAILABLE');
});
