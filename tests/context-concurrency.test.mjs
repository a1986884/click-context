import {test} from 'node:test';import assert from 'node:assert/strict';import {createContextClient} from '../src/context-meaning.js';
const input={word:'bank',sentence:'They sat beside the bank.',offset:20,senses:[{id:'river',lemma:'bank',pos:'N',zh:'河岸',definition:'Land beside water.'}]};
const tick=()=>new Promise(setImmediate);
const result=()=>Response.json({ok:true,data:{senseId:'river',zh:'河岸'}});
test('identical in-flight contexts share one HTTP request but receive isolated results',{timeout:5000},async()=>{
 let calls=0,finish;const client=createContextClient({fetcher:async()=>{calls++;return new Promise(resolve=>finish=resolve);}});
 const a=client(input),b=client({...input});await tick();assert.equal(calls,1);finish(result());const [one,two]=await Promise.all([a,b]);one.zh='changed';assert.equal(two.zh,'河岸');assert.equal((await client(input)).zh,'河岸');assert.equal(calls,1);
});
test('cancelling one context subscriber leaves the other waiting and caches only validated results',{timeout:5000},async()=>{
 let finish,sourceSignal,calls=0;const client=createContextClient({fetcher:async(_url,{signal})=>{calls++;sourceSignal=signal;return new Promise(resolve=>finish=resolve);}});const controller=new AbortController();const a=client(input,{signal:controller.signal}),b=client(input);await tick();const rejected=assert.rejects(a,{name:'AbortError'});controller.abort();await rejected;assert.equal(sourceSignal.aborted,false);finish(result());await b;await client(input);assert.equal(calls,1);
});
test('last context subscriber cancellation aborts upstream and a late response cannot overwrite a retry',{timeout:5000},async()=>{
 const jobs=[];const client=createContextClient({fetcher:async(_url,{signal})=>new Promise(resolve=>jobs.push({signal,resolve}))});const controller=new AbortController(),old=client(input,{signal:controller.signal});await tick();const rejected=assert.rejects(old,{name:'AbortError'});controller.abort();await rejected;assert.equal(jobs[0].signal.aborted,true);const retry=client(input);await tick();assert.equal(jobs.length,2);jobs[0].resolve(Response.json({ok:true,data:{senseId:'river',zh:'旧含义'}}));jobs[1].resolve(result());assert.equal((await retry).zh,'河岸');assert.equal((await client(input)).zh,'河岸');assert.equal(jobs.length,2);
});
test('different occurrences or dictionary candidates never share a context request; failure allows retry',{timeout:5000},async()=>{
 let calls=0;const client=createContextClient({fetcher:async()=>{calls++;return result();}});const sentence='The bank is beside another bank.';await Promise.all([client({...input,sentence,offset:sentence.indexOf('bank')}),client({...input,sentence,offset:sentence.lastIndexOf('bank')}),client(input),client({...input,sentence:input.sentence+' Later.'}),client({...input,senses:input.senses.map(s=>({...s,definition:'Different candidate.'}))})]);assert.equal(calls,5);
 let attempts=0;const retry=createContextClient({fetcher:async()=>{attempts++;return attempts===1?Response.json({ok:false,error:'暂不可用'},{status:503}):result();}});await assert.rejects(retry(input),/暂不可用/);assert.equal((await retry(input)).zh,'河岸');assert.equal(attempts,2);
});
