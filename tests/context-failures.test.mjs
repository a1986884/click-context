import {test} from 'node:test';import assert from 'node:assert/strict';import {createContextClient} from '../src/context-meaning.js';
const input={word:'bank',sentence:'They sat on the bank.',offset:16,senses:[{id:'river',lemma:'bank',pos:'N',zh:'河岸',definition:'Land beside water.'}]};
const valid=()=>Response.json({ok:true,data:{senseId:'river',zh:'河岸'}});
test('context HTTP failures retain an actionable category and status, including non-JSON rate limits',async()=>{
 for(const [status,code,json]of [[429,'RATE_LIMITED',false],[503,'CONTEXT_UNAVAILABLE',true],[502,'CONTEXT_UNAVAILABLE',false],[403,'CONTEXT_ACCESS_DENIED',true],[400,'CONTEXT_INVALID_REQUEST',true]]){
  const client=createContextClient({fetcher:async()=>json?Response.json({ok:false,error:'Synthetic service failure'},{status}):new Response('Non-JSON upstream error',{status})});
  await assert.rejects(client(input),e=>e.code===code&&e.upstreamStatus===status);
 }
});
test('malformed JSON and invalid model output are not confused with network failure or cached',async()=>{
 for(const bad of [()=>new Response('not json'),()=>Response.json({ok:true,data:{senseId:'invented',zh:'河岸'}})]){
  let calls=0;const client=createContextClient({fetcher:async()=>++calls===1?bad():valid()});await assert.rejects(client(input),e=>e.code==='CONTEXT_INVALID_RESULT');assert.equal((await client(input)).zh,'河岸');await client(input);assert.equal(calls,2);
 }
});
test('a disconnected context request is retryable and has a distinct network message',async()=>{
 for(const failure of [new TypeError('Failed to fetch'),new DOMException('Network failure','NetworkError'),Object.assign(Error('Disconnected'),{code:'ECONNRESET'})]){let calls=0;const client=createContextClient({fetcher:async()=>{if(++calls===1)throw failure;return valid();}});
 await assert.rejects(client(input),e=>e.code==='CONTEXT_NETWORK'&&e.retryable===true&&/连接/.test(e.message));assert.equal((await client(input)).zh,'河岸');assert.equal(calls,2);}
});
test('context response deadline is distinct from caller cancellation and allows a fresh retry',{timeout:1000},async()=>{
 let calls=0;const client=createContextClient({timeoutMs:8,fetcher:async(_url,{signal})=>{if(++calls>1)return valid();return new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));}});
 // A real timer keeps Node alive while AbortSignal.timeout is unrefed.
 const keepAlive=setTimeout(()=>{},500);try{await assert.rejects(client(input),e=>e.code==='CONTEXT_TIMEOUT'&&e.retryable===true);assert.equal((await client(input)).zh,'河岸');}finally{clearTimeout(keepAlive);}
 const controller=new AbortController(),reason=new DOMException('Caller stopped','AbortError');controller.abort(reason);await assert.rejects(client(input,{signal:controller.signal}),e=>e===reason);
});
