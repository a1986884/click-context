import {test} from 'node:test';
import assert from 'node:assert/strict';
import worker from '../workers/context/index.js';
const input={word:'bank',sentence:'The bank holds deposits.',offset:4,senses:[{id:'finance',lemma:'bank',pos:'N',zh:'银行',definition:'A financial institution.'}]};
const request=signal=>new Request('https://context.test/meaning',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input),...(signal?{signal}:{})});
const environment=run=>({AI:{run},PER_IP:{limit:async()=>({success:true})},TOTAL:{limit:async()=>({success:true})}});
const tick=()=>new Promise(setImmediate);
test('an already cancelled context request never invokes the model',async()=>{
 let calls=0;const controller=new AbortController();controller.abort();
 const response=await worker.fetch(request(controller.signal),environment(async()=>{calls++;return {response:'{"senseId":"finance","zh":"银行"}'};}));
 assert.equal(response.status,503);assert.equal(calls,0);assert.equal((await response.json()).code,'CONTEXT_CANCELLED');
});
test('cancelling running context inference returns without retry even if the binding ignores abort',{timeout:1000},async()=>{
 let calls=0,seen,lateReject;const controller=new AbortController();
 const pending=worker.fetch(request(controller.signal),environment((_model,_input,options)=>{calls++;seen=options?.signal;return new Promise((_resolve,reject)=>lateReject=reject);}));
 await tick();assert.equal(calls,1);controller.abort();const response=await pending;
 assert.equal(response.status,503);assert.equal(calls,1);assert.equal(seen.aborted,true);assert.equal((await response.json()).code,'CONTEXT_CANCELLED');
 lateReject(Error('Synthetic late binding rejection'));await tick();
});
test('the server bounds context inference wait and consumes a late binding failure',{timeout:1000},async t=>{
 // AbortSignal.timeout uses an unreferenced timer in Node. Keep this test alive
 // while exercising the real timeout signal; a pending Promise alone cannot.
 const keepAlive=setInterval(()=>{},1000);t.after(()=>clearInterval(keepAlive));
 const timeout=AbortSignal.timeout.bind(AbortSignal),deadlines=[];t.mock.method(AbortSignal,'timeout',ms=>{deadlines.push(ms);return timeout(8);});
 let calls=0,seen,lateReject;
 const response=await worker.fetch(request(),environment((_model,_input,options)=>{calls++;seen=options?.signal;return new Promise((_resolve,reject)=>lateReject=reject);}));
 assert.equal(response.status,503);assert.equal(calls,1);assert.deepEqual(deadlines,[16000]);assert.equal(seen.aborted,true);assert.equal((await response.json()).code,'CONTEXT_TIMEOUT');
 lateReject(Error('Synthetic late timed-out binding rejection'));await tick();
});
