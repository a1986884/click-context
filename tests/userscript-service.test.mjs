import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import worker from '../workers/context/index.js';
import {createGMFetch} from '../userscript/gm-adapter.js';
const input={word:'class',sentence:'This class is co-taught by Anish, Jon, and Jose.',offset:5,senses:[{id:'course',zh:'课程',definition:'A class is a course of teaching in a particular subject.',pos:'N-COUNT'}]};
const request=(path,origin,method='POST',body=input)=>new Request('https://context.test'+path,{method,headers:{Origin:origin,'Content-Type':'application/json'},...(method==='POST'?{body:JSON.stringify(body)}:{})});
const environment=(limit=true)=>({AI:{run:async()=>({response:JSON.stringify({senseId:'course',zh:'课程'})})},PER_IP:{limit:async()=>({success:limit})},TOTAL:{limit:async()=>({success:true})},TRANSLATION_IP:{limit:async()=>({success:limit})},TRANSLATION_TOTAL:{limit:async()=>({success:true})}});
test('userscript public routes accept website and Safari origins while legacy routes remain restricted',async()=>{
 for(const origin of ['https://course.example','safari-web-extension://12345678-1234-1234-1234-123456789abc','null']){
  const response=await worker.fetch(request('/userscript/meaning',origin),environment());assert.equal(response.status,200);assert.equal(response.headers.get('Access-Control-Allow-Origin'),'*');assert.equal(response.headers.get('Access-Control-Allow-Credentials'),null);assert.equal((await response.json()).data.zh,'课程');
  assert.equal((await worker.fetch(request('/meaning',origin),environment())).status,403);
 }
});
test('userscript preflight, method, content and rate limits still apply',async()=>{
 const origin='https://course.example';const preflight=await worker.fetch(request('/userscript/meaning',origin,'OPTIONS'),environment());assert.equal(preflight.status,204);assert.match(preflight.headers.get('Access-Control-Allow-Headers'),/Content-Type/);
 assert.equal((await worker.fetch(request('/userscript/meaning',origin,'GET'),environment())).status,405);
 assert.equal((await worker.fetch(request('/userscript/meaning',origin,'POST',{}),environment())).status,400);
 assert.equal((await worker.fetch(request('/userscript/meaning',origin),environment(false))).status,429);
 assert.equal((await worker.fetch(request('/userscript/translate',origin,'POST',{text:'The lesson is short.'}),environment(false))).status,429);
 assert.notEqual((await worker.fetch(request('/userscript/unknown',origin),environment())).status,200);
});
test('GM transport reads cross-realm ArrayBuffers and managers returning string bodies',async()=>{
 const crossRealm=vm.runInNewContext('new Uint8Array([123,125]).buffer');
 for(const response of [crossRealm,'{}',new Uint8Array([123,125])]){
  const fetcher=createGMFetch(d=>queueMicrotask(()=>d.onload({status:200,response})));
  assert.deepEqual(await (await fetcher('https://dict.youdao.com/')).json(),{});
 }
});
