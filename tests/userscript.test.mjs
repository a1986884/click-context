import test from 'node:test';
import assert from 'node:assert/strict';
import {createGMFetch,createGMAdapter} from '../userscript/gm-adapter.js';
test('userscript restricts hosts, credentials, protocols and ports before request',async()=>{
 let calls=0;const fetcher=createGMFetch(()=>calls++);
 for(const url of ['https://example.com/','http://dict.youdao.com/','https://user@dict.youdao.com/','https://dict.youdao.com:8443/'])await assert.rejects(fetcher(url));
 assert.equal(calls,0);
});
test('userscript forwards body anonymously, preserves HTTP errors and decodes response',async()=>{
 let details;const fetcher=createGMFetch(d=>{details=d;queueMicrotask(()=>d.onload({status:403,response:new TextEncoder().encode('{"ok":false}').buffer}));});
 const result=await fetcher('https://lextide-context.aa1986884.workers.dev/meaning',{method:'POST',body:'{"word":"bank"}',headers:{'Content-Type':'application/json'}});
 assert.equal(details.anonymous,true);assert.equal(details.data,'{"word":"bank"}');assert.equal(details.headers.Origin,undefined);assert.equal(result.status,403);assert.deepEqual(await result.json(),{ok:false});
});
test('userscript cancels privileged request and ignores late result',async()=>{
 let details,aborts=0;const controller=new AbortController(),fetcher=createGMFetch(d=>{details=d;return {abort(){aborts++;d.onabort();}};});
 const result=fetcher('https://dict.youdao.com/w/eng/bank/',{signal:controller.signal});controller.abort();await assert.rejects(result,{name:'AbortError'});assert.equal(aborts,1);
 details.onload({status:200,response:new ArrayBuffer(0)});
});
test('userscript rejects cross-origin redirects, oversized data, timeout and denied requests',async()=>{
 for(const response of [{status:200,finalUrl:'https://example.com/',response:new ArrayBuffer(0)},{status:200,response:new ArrayBuffer(1024*1024+1)}]){
  await assert.rejects(createGMFetch(d=>queueMicrotask(()=>d.onload(response)))('https://dict.youdao.com/'));
 }
 for(const event of ['onerror','ontimeout','onabort'])await assert.rejects(createGMFetch(d=>queueMicrotask(()=>d[event]()))('https://dict.youdao.com/'));
});
test('userscript store shares vocabulary across origins but isolates preferences',async()=>{
 const data=new Map(),api={getValue:async(k,d)=>data.get(k)??d,setValue:async(k,v)=>data.set(k,v)};
 const a=createGMAdapter({...api,origin:'https://a.example'}),b=createGMAdapter({...api,origin:'https://b.example'});
 await a.set('words',[{word:'bank'}]);assert.deepEqual(await b.get('words'),[{word:'bank'}]);await a.set('prefs',{words:true});assert.equal(await b.get('prefs'),null);
 assert.ok([...data.keys()].every(k=>k.startsWith('click-context:v1:')));
});
test('an unresponsive manager still reaches a local deadline and aborts its request',async()=>{
 let aborts=0,details;const controller=new AbortController();const fetcher=createGMFetch(d=>{details=d;return {abort(){aborts++;d.onabort();}};},{timeoutMs:5});let timer;
 try{await assert.rejects(Promise.race([fetcher('https://dict.youdao.com/',{signal:controller.signal}),new Promise(resolve=>timer=setTimeout(()=>resolve('still pending'),60))]),/超时/);assert.equal(aborts,1);details.onload({status:200,response:'Late result'});assert.equal(aborts,1);}finally{clearTimeout(timer);controller.abort();}
});
test('completed manager requests clear their local deadline and do not abort later',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});let aborts=0;const fetcher=createGMFetch(d=>{queueMicrotask(()=>d.onload({status:200,response:'Complete'}));return {abort(){aborts++;}};},{timeoutMs:20});assert.equal(await (await fetcher('https://dict.youdao.com/')).text(),'Complete');t.mock.timers.tick(25001);assert.equal(aborts,0);
});
test('deadline survives a throwing abort handle and synchronous oversized progress cancels after handle assignment',async()=>{
 await assert.rejects(createGMFetch(()=>({abort(){throw Error('Manager abort failure');}}),{timeoutMs:5})('https://dict.youdao.com/'),/超时/);
 let aborts=0;await assert.rejects(createGMFetch(d=>{d.onprogress({loaded:1024*1024+1});return {abort(){aborts++;d.onabort();}};})('https://dict.youdao.com/'),/过大/);assert.equal(aborts,1);
});
