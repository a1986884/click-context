import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cacheWordLookup} from '../src/dictionary-cache.js';
test('partial English failures are not cached, so an explicit retry can recover and cache a complete result',async()=>{
 let calls=0;const lookup=cacheWordLookup(async()=>++calls===1?{word:'unit',zh:'单位',partial:true,definitions:[]}:{word:'unit',zh:'单位',partial:false,definitions:['A complete definition.']});
 assert.equal((await lookup('unit',{online:true})).partial,true);
 assert.equal((await lookup('unit',{online:true})).partial,false);assert.equal(calls,2);
 await lookup('unit',{online:true});assert.equal(calls,2);
});
test('repeated exact words and case variants skip the network, but offline consent still gates access',async()=>{
 let requests=0;const lookup=cacheWordLookup(async(word,{online}={})=>{if(!online)throw Object.assign(Error('需要联网授权'),{code:'ONLINE_REQUIRED'});requests++;return {word:'study',original:word,zh:'学习',definitions:['Test definition']};});
 const first=await lookup('study',{online:true});first.definitions.push('caller mutation');
 const second=await lookup('STUDY',{online:true});assert.equal(requests,1);assert.equal(second.original,'STUDY');assert.deepEqual(second.definitions,['Test definition']);
 await assert.rejects(lookup('study',{online:false}),e=>e.code==='ONLINE_REQUIRED');assert.equal(requests,1);
 await lookup('study',{online:true});assert.equal(requests,2);
});
test('expired and evicted words refresh, failed or cancelled requests are never cached',async()=>{
 let time=0,requests=0;const lookup=cacheWordLookup(async word=>{requests++;if(word==='bad')throw Error('failed');return {word};},{maxEntries:1,ttlMs:100,now:()=>time});
 await lookup('study',{online:true});time=101;await lookup('study',{online:true});assert.equal(requests,2);
 await lookup('ocean',{online:true});await lookup('study',{online:true});assert.equal(requests,4);
 for(let i=0;i<2;i++)await assert.rejects(lookup('bad',{online:true}));assert.equal(requests,6);
 const controller=new AbortController();controller.abort();await assert.rejects(lookup('study',{online:true,signal:controller.signal}));assert.equal(requests,6);
});
test('session mode changes cannot reuse an anonymous lookup result or send requests without consent',async()=>{
 let requests=0;const lookup=cacheWordLookup(async(word,{online,useSession})=>{if(!online)throw Error('offline');requests++;return {word,mode:useSession?'session':'anonymous'};});
 assert.equal((await lookup('study',{online:true})).mode,'anonymous');
 assert.equal((await lookup('study',{online:true,useSession:true})).mode,'session');assert.equal(requests,2);
 await lookup('study',{online:true,useSession:true});assert.equal(requests,2);
 await assert.rejects(lookup('study',{online:false,useSession:true}));assert.equal(requests,2);
});
test('repeating an official redirected headword preserves the provider explanation',async()=>{
 const lookup=cacheWordLookup(async()=>({word:'list',lemma:'list',original:'listed',morphology:'官网 listed → list'}));
 await lookup('listed',{online:true});assert.equal((await lookup('listed',{online:true})).morphology,'官网 listed → list');
});
const tick=()=>new Promise(setImmediate);
test('concurrent lookups share one source request while each caller receives isolated candidates',async()=>{
 let requests=0,finish;const lookup=cacheWordLookup(async()=>{requests++;return new Promise(resolve=>finish=resolve);});
 const first=lookup('study',{online:true}),second=lookup('STUDY',{online:true});await tick();assert.equal(requests,1);
 finish({word:'study',lemma:'study',senses:[{id:'1',zh:'学习'}]});const [a,b]=await Promise.all([first,second]);
 a.senses[0].zh='changed';assert.equal(b.original,'STUDY');assert.equal(b.senses[0].zh,'学习');
 assert.equal((await lookup('study',{online:true})).senses[0].zh,'学习');assert.equal(requests,1);
});
test('cancelling one subscriber leaves the shared source alive for the remaining caller',async()=>{
 let finish,sourceSignal;const lookup=cacheWordLookup(async(_word,{signal})=>{sourceSignal=signal;return new Promise(resolve=>finish=resolve);});
 const one=new AbortController(),two=new AbortController();
 const a=lookup('bank',{online:true,signal:one.signal}),b=lookup('bank',{online:true,signal:two.signal});await tick();
 const cancelled=assert.rejects(a,{name:'AbortError'});one.abort();await cancelled;assert.equal(sourceSignal.aborted,false);
 finish({word:'bank',senses:[{id:'river'}]});assert.equal((await b).word,'bank');
});
test('last subscriber cancellation aborts the source, permits immediate retry and discards late results',async()=>{
 const jobs=[];const lookup=cacheWordLookup(async(_word,{signal})=>new Promise(resolve=>jobs.push({signal,resolve})));
 const c=new AbortController(),first=lookup('bank',{online:true,signal:c.signal});await tick();
 const cancelled=assert.rejects(first,{name:'AbortError'});c.abort();await cancelled;assert.equal(jobs[0].signal.aborted,true);
 const retry=lookup('bank',{online:true});await tick();assert.equal(jobs.length,2);
 jobs[0].resolve({word:'stale'});await tick();jobs[1].resolve({word:'fresh'});assert.equal((await retry).word,'fresh');
 assert.equal((await lookup('bank',{online:true})).word,'fresh');assert.equal(jobs.length,2);
});
test('shared failures are not cached and an offline caller cannot join or cancel authorized work',async()=>{
 let requests=0,fail,sourceSignal;const lookup=cacheWordLookup(async(word,{online,signal})=>{
  if(!online)throw Object.assign(Error('offline'),{code:'ONLINE_REQUIRED'});
  requests++;sourceSignal=signal;return new Promise((_resolve,reject)=>fail=reject);
 });
 const a=lookup('bank',{online:true}),b=lookup('bank',{online:true});await tick();
 await assert.rejects(lookup('bank',{online:false}),e=>e.code==='ONLINE_REQUIRED');assert.equal(sourceSignal.aborted,false);
 const rejected=Promise.all([assert.rejects(a,/source failed/),assert.rejects(b,/source failed/)]);fail(Error('source failed'));await rejected;
 const retry=lookup('bank',{online:true});await tick();assert.equal(requests,2);const rejectedRetry=assert.rejects(retry);fail(Error('again'));await rejectedRetry;
});
test('unavailable entries without a partial flag do not block an explicit retry',async()=>{
 for(const first of [{word:'class',kind:'unavailable',senses:[]},{word:'class',kind:'collins',senses:[]}]){
  let calls=0;const lookup=cacheWordLookup(async()=>++calls===1?first:{word:'class',kind:'collins',senses:[{id:'course',zh:'课程'}]});assert.deepEqual((await lookup('class',{online:true})).senses,[]);await tick();assert.equal(calls,1,'No automatic retry');assert.equal((await lookup('class',{online:true})).senses[0].id,'course');await lookup('class',{online:true});assert.equal(calls,2,'Complete result remains cached');
 }
});
test('unavailable entries left by an older cache are evicted before use',async()=>{
 const key='dict:anonymous:class',data={[key]:{at:100,value:{word:'class',kind:'unavailable',senses:[]}},'dict:lru':[key]};let calls=0;const storage={get:async()=>structuredClone(data),set:async values=>Object.assign(data,structuredClone(values)),remove:async keys=>{for(const key of Array.isArray(keys)?keys:[keys])delete data[key];}};
 const lookup=cacheWordLookup(async()=>{calls++;return {word:'class',kind:'collins',senses:[{id:'course',zh:'课程'}]};},{storage,now:()=>101});assert.equal((await lookup('class',{online:true})).kind,'collins');await lookup('class',{online:true});assert.equal(calls,1);assert.equal(data[key].value.kind,'collins');
});
test('concurrent missing-entry callers share one request without caching the failure',async()=>{
 let calls=0,finish;const lookup=cacheWordLookup(async()=>{calls++;if(calls===1)return new Promise(resolve=>finish=resolve);return {word:'class',kind:'collins',senses:[{id:'course'}]};});const a=lookup('class',{online:true}),b=lookup('CLASS',{online:true});await tick();assert.equal(calls,1);finish({word:'class',kind:'unavailable',senses:[]});await Promise.all([a,b]);assert.equal(calls,1);assert.equal((await lookup('class',{online:true})).kind,'collins');await lookup('CLASS',{online:true});assert.equal(calls,2);
});
