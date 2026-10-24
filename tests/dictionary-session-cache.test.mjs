import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cacheWordLookup} from '../src/dictionary-cache.js';
const tick=()=>new Promise(setImmediate);
function sessionArea(){
 const data={unrelated:{keep:true}};
 return {data,async get(key){return key===null?structuredClone(data):{[key]:structuredClone(data[key])};},async set(values){Object.assign(data,structuredClone(values));},async remove(keys){for(const key of Array.isArray(keys)?keys:[keys])delete data[key];}};
}
const entries=storage=>Object.keys(storage.data).filter(key=>/^dict:(anonymous|session):/.test(key));
test('session cache survives worker recreation, preserves TTL and keeps credential partitions separate',async()=>{
 const storage=sessionArea();let now=1000,calls=0;
 const source=async(word,{useSession})=>{calls++;return {word,mode:useSession?'session':'anonymous',senses:[{zh:'测试'}]};};
 const worker=()=>cacheWordLookup(source,{storage,now:()=>now});
 const first=await worker()('study',{online:true});first.senses[0].zh='caller edit';
 assert.deepEqual(Object.keys(storage.data['dict:anonymous:study']).sort(),['at','value']);
 now+=100;const restarted=worker(),hit=await restarted('STUDY',{online:true});assert.equal(calls,1);assert.equal(hit.original,'STUDY');assert.equal(hit.senses[0].zh,'测试');assert.equal(storage.data['dict:anonymous:study'].at,1000);
 assert.equal((await restarted('study',{online:true,useSession:true})).mode,'session');assert.equal(calls,2);
 assert.equal((await worker()('study',{online:true})).mode,'anonymous');assert.equal(calls,2);
 now=1000+10*60*1000;await worker()('study',{online:true});assert.equal(calls,3,'exact TTL boundary is expired');
 assert.deepEqual(storage.data.unrelated,{keep:true});
});
test('session cache retains the global 32-entry LRU bound across worker recreation and excludes partial results',async()=>{
 const storage=sessionArea();let calls=0;const source=async word=>{calls++;return {word,...(word==='partial'?{partial:true}:{})};};
 const word=i=>'word'+String.fromCharCode(97+Math.floor(i/26))+String.fromCharCode(97+i%26);
 const first=cacheWordLookup(source,{storage});for(let i=0;i<32;i++)await first(word(i),{online:true});
 const restarted=cacheWordLookup(source,{storage});await restarted(word(0),{online:true});assert.equal(calls,32);
 await restarted(word(32),{online:true,useSession:true});assert.equal(entries(storage).length,32);assert.ok(storage.data['dict:anonymous:'+word(0)]);assert.equal(storage.data['dict:anonymous:'+word(1)],undefined);assert.ok(storage.data['dict:session:'+word(32)]);
 await restarted('partial',{online:true});await cacheWordLookup(source,{storage})('partial',{online:true});assert.equal(storage.data['dict:anonymous:partial'],undefined);assert.equal(entries(storage).length,32);assert.equal(calls,35);
});
test('persistent cache misses coalesce concurrent requests and isolate returned candidate objects',async()=>{
 const storage=sessionArea();let calls=0,finish;
 const source=async()=>{calls++;return new Promise(resolve=>finish=resolve);};
 const lookup=cacheWordLookup(source,{storage});const first=lookup('bank',{online:true}),second=lookup('BANK',{online:true});await tick();assert.equal(calls,1);
 finish({word:'bank',senses:[{id:'one',zh:'银行'}]});const [a,b]=await Promise.all([first,second]);a.senses[0].zh='edit';assert.equal(b.original,'BANK');assert.equal(b.senses[0].zh,'银行');
 assert.equal((await cacheWordLookup(source,{storage})('bank',{online:true})).senses[0].zh,'银行');assert.equal(calls,1);
});
test('one cancellation preserves the shared request; final cancellation prevents persistence and allows retry',async()=>{
 const storage=sessionArea(),jobs=[];const source=async(_word,{signal})=>new Promise(resolve=>jobs.push({signal,resolve}));const lookup=cacheWordLookup(source,{storage});
 const one=new AbortController(),two=new AbortController();const a=lookup('bank',{online:true,signal:one.signal}),b=lookup('bank',{online:true,signal:two.signal});await tick();
 const cancelled=assert.rejects(a,{name:'AbortError'});one.abort();await cancelled;assert.equal(jobs[0].signal.aborted,false);jobs[0].resolve({word:'bank'});await b;assert.ok(storage.data['dict:anonymous:bank']);
 const last=new AbortController(),old=lookup('ocean',{online:true,signal:last.signal});await tick();const stopped=assert.rejects(old,{name:'AbortError'});last.abort();await stopped;assert.equal(jobs[1].signal.aborted,true);
 const retry=lookup('ocean',{online:true});await tick();assert.equal(jobs.length,3);jobs[1].resolve({word:'stale'});await tick();assert.equal(storage.data['dict:anonymous:ocean'],undefined);jobs[2].resolve({word:'fresh'});assert.equal((await retry).word,'fresh');assert.equal((await cacheWordLookup(source,{storage})('ocean',{online:true})).word,'fresh');
 const aborted=new AbortController();aborted.abort();await assert.rejects(lookup('other',{online:true,signal:aborted.signal}),{name:'AbortError'});assert.equal(jobs.length,3);
});
test('cancellation during an unabortable storage write removes the late persistent result',async()=>{
 const storage=sessionArea(),set=storage.set.bind(storage);let release,started;
 const writing=new Promise(resolve=>started=resolve);
 storage.set=async values=>{await set(values);if(values['dict:anonymous:bank']){started();await new Promise(resolve=>release=resolve);}};
 const lookup=cacheWordLookup(async()=>({word:'bank'}),{storage}),controller=new AbortController();
 const result=lookup('bank',{online:true,signal:controller.signal});await writing;const cancelled=assert.rejects(result,{name:'AbortError'});controller.abort();await cancelled;release();await tick();assert.equal(storage.data['dict:anonymous:bank'],undefined);
});
test('offline cache clearing only removes dictionary data and preserves other session state',async()=>{
 const storage=sessionArea();const lookup=cacheWordLookup(async(word,{online})=>{if(!online)throw Error('offline');return {word};},{storage});await lookup('bank',{online:true});
 await assert.rejects(lookup('bank',{online:false}),/offline/);assert.deepEqual(entries(storage),[]);assert.deepEqual(storage.data.unrelated,{keep:true});
});
