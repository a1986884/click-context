import test from 'node:test';import assert from 'node:assert/strict';import worker from '../workers/context/index.js';import {createTranslationProvider} from '../src/providers.js';
const request=revision=>new Request('https://fixture.test/userscript/translate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:'Water freezes at 0 degrees Celsius.',translationRevision:revision})});
const env=run=>({AI:{run},TRANSLATION_IP:{limit:async()=>({success:true})},TRANSLATION_TOTAL:{limit:async()=>({success:true})}});
test('v5 requests skip the provider capacity queue and do not retry a documented 3040 rejection',async()=>{
 let calls=0;const r=await worker.fetch(request('cloudflare-ai:en-zh:v5'),env(async(_m,_p,o)=>{calls++;assert.equal(o.rejectIfBusy,true);throw Object.assign(Error('PRIVATE_PROVIDER_DETAILS'),{code:3040});})),b=await r.json();assert.equal(r.status,503);assert.equal(calls,1);assert.equal(b.code,'TRANSLATION_BUSY');assert.equal(b.failureReason,'capacity');assert.equal(b.retryable,false);assert.doesNotMatch(JSON.stringify(b),/PRIVATE/);
});
test('v4 keeps its original inference options and retry behavior',async()=>{
 let calls=0;const r=await worker.fetch(request('cloudflare-ai:en-zh:v4'),env(async(_m,_p,o)=>{calls++;assert.equal(o.rejectIfBusy,undefined);throw Object.assign(Error('PRIVATE_DETAILS'),{code:3040});}));assert.equal(r.status,503);assert.equal(calls,2);assert.equal((await r.json()).code,'TRANSLATION_UNAVAILABLE');
});
test('capacity response does not cause the client to retry or fall back',async()=>{
 let calls=0;const provider=createTranslationProvider({request:async()=>{calls++;return {ok:false,error:'内置翻译服务繁忙，请稍后重试',code:'TRANSLATION_BUSY',retryable:false};}});await assert.rejects(provider.translate('A public sentence.'),e=>e.code==='TRANSLATION_BUSY'&&e.retryable===false);assert.equal(calls,1);
});
test('explicit context v4 rejects capacity without retry while legacy context options stay unchanged',async()=>{
 for(const revision of [undefined,'ai-context-v4']){
  let calls=0;const input={word:'bank',sentence:'The bank is here.',offset:4,senses:[],...(revision?{contextRevision:revision}:{})};const r=await worker.fetch(new Request('https://fixture.test/userscript/meaning',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)}),{AI:{run:async(_m,_p,o)=>{calls++;assert.equal(o.rejectIfBusy,revision?true:undefined);throw Object.assign(Error('PRIVATE_PROVIDER_ERROR'),{code:3040});}},PER_IP:{limit:async()=>({success:true})},TOTAL:{limit:async()=>({success:true})}});const b=await r.json();assert.equal(b.code,revision?'CONTEXT_BUSY':'CONTEXT_UNAVAILABLE');assert.equal(calls,revision?1:2);assert.equal(b.retryable,false);assert.doesNotMatch(JSON.stringify(b),/PRIVATE/);
 }
});
