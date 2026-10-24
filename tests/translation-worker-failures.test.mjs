import {test} from 'node:test';import assert from 'node:assert/strict';
import worker from '../workers/context/index.js';import {parseTranslationResult} from '../src/translation-service.js';import {createTranslationProvider} from '../src/providers.js';
const text='The difference was not significant (p = 0.08).';
const request=signal=>new Request('https://service.test/translate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text}),...(signal?{signal}:{})});
const environment=run=>({AI:{run},TRANSLATION_IP:{limit:async()=>({success:true})},TRANSLATION_TOTAL:{limit:async()=>({success:true})}});
const tick=()=>new Promise(setImmediate);
test('translation failures classify inference versus validation without exposing private details',async()=>{
 for(const [run,reason]of [[async()=>{throw Error('PRIVATE_SYNTHETIC_BINDING_ERROR');},'inference'],[async()=>({response:'PRIVATE_SYNTHETIC_OUTPUT'}),'invalid-result'],[async()=>({status:'incomplete',response:'差异不显著（p = 0.08）。'}),'invalid-result']]){
  let calls=0;const response=await worker.fetch(request(),environment(async()=>{calls++;return run();}));const body=await response.json();assert.equal(response.status,503);assert.equal(body.failureReason,reason);assert.equal(body.code,'TRANSLATION_UNAVAILABLE');assert.equal(body.retryable,false);assert.equal(body.data,undefined);assert.equal(calls,2);assert.doesNotMatch(JSON.stringify(body),/PRIVATE|SYNTHETIC/);
 }
 let calls=0;const recovered=await worker.fetch(request(),environment(async()=>++calls===1?{status:'incomplete'}:{response:'差异不显著（p = 0.08）。'}));assert.equal(recovered.status,200);assert.equal(calls,2);assert.equal((await recovered.json()).failureReason,undefined);
});
test('translation caller cancellation stays distinct and never retries a cancelled binding',{timeout:1000},async()=>{
 for(const before of [true,false]){
  let calls=0,lateReject,seen;const controller=new AbortController();if(before)controller.abort();
  const pending=worker.fetch(request(controller.signal),environment((_m,_i,options)=>{calls++;seen=options.signal;return new Promise((_resolve,reject)=>lateReject=reject);}));
  if(!before){await tick();assert.equal(calls,1);controller.abort();}
  const response=await pending,body=await response.json();assert.equal(response.status,503);assert.equal(body.failureReason,'cancelled');assert.equal(body.code,'TRANSLATION_UNAVAILABLE');assert.equal(body.retryable,false);assert.equal(calls,before?0:1);
  if(!before){assert.equal(seen.aborted,true);lateReject(Error('PRIVATE_LATE_REJECTION'));await tick();}
 }
});
test('translation deadline is reported without waiting for a binding that ignores abort',{timeout:1000},async t=>{
 const timeout=AbortSignal.timeout.bind(AbortSignal),deadlines=[];t.mock.method(AbortSignal,'timeout',ms=>{deadlines.push(ms);return timeout(8);});
 let calls=0,lateReject,seen;const keepAlive=setTimeout(()=>{},500);
 try{
  const response=await worker.fetch(request(),environment((_m,_i,options)=>{calls++;seen=options.signal;return new Promise((_resolve,reject)=>lateReject=reject);})),body=await response.json();assert.equal(response.status,503);assert.equal(body.failureReason,'timeout');assert.equal(body.code,'TRANSLATION_UNAVAILABLE');assert.equal(body.retryable,false);assert.equal(calls,1);assert.deepEqual(deadlines,[16000]);assert.equal(seen.aborted,true);lateReject(Error('PRIVATE_LATE_TIMEOUT'));await tick();
 }finally{clearTimeout(keepAlive);}
});
test('translation health advertises bounded diagnostics while preserving model and protocol',async()=>{
 const response=await worker.fetch(new Request('https://service.test/health'),{}),body=await response.json();assert.equal(response.status,200);assert.equal(body.translation.model,'@cf/openai/gpt-oss-120b');assert.equal(body.translation.version,'ai-translation-v1');assert.equal(body.translation.inferenceTimeoutMs,16000);assert.deepEqual(body.translation.failureReasons,['cancelled','timeout','inference','invalid-result','capacity']);assert.equal(body.version,'ai-context-v3');assert.equal(body.contextFailureCodes,true);
});
test('legacy translation clients still pause on every categorized unavailable response',async()=>{
 for(const reason of ['cancelled','timeout','inference','invalid-result','capacity']){
  let calls=0;const provider=createTranslationProvider({request:async()=>{calls++;return {ok:false,error:'正文翻译暂不可用，请稍后重试',code:'TRANSLATION_UNAVAILABLE',failureReason:reason,retryable:false};}});await assert.rejects(provider.translate(text),error=>error.code==='TRANSLATION_UNAVAILABLE'&&error.retryable===false);assert.equal(calls,1);
 }
});

const invalidSamples=[
 [{status:'incomplete',response:'差异不显著（p = 0.08）。'},'incomplete'],
 [{response:'PRIVATE_SYNTHETIC_INVALID_TEXT'},'invalid-text'],
 [{response:'差异不显著（p = 0.8）。'},'number-mismatch']
];
test('translation validation tags describe existing parser guards without accepting invalid text',()=>{
 for(const [raw,reason] of invalidSamples)assert.throws(()=>parseTranslationResult(raw,{text}),error=>error.validationReason===reason);
 assert.equal(parseTranslationResult({response:'差异不显著（p = 0.08）。'},{text}).text,'差异不显著（p = 0.08）。');
});
test('translation validation reasons are bounded and never expose output or internal exceptions',async()=>{
 const unexpected=Object.defineProperty({},'response',{get(){throw Object.assign(Error('PRIVATE_PARSER_ERROR'),{validationReason:'PRIVATE_UNREVIEWED_REASON'});}});
 for(const [raw,reason] of [...invalidSamples,[unexpected,'unknown']]){
  let calls=0;const response=await worker.fetch(request(),environment(async()=>{calls++;return raw;})),body=await response.json();assert.equal(response.status,503);assert.equal(body.code,'TRANSLATION_UNAVAILABLE');assert.equal(body.failureReason,'invalid-result');assert.equal(body.validationReason,reason);assert.equal(body.retryable,false);assert.equal(body.data,undefined);assert.equal(calls,2);assert.doesNotMatch(JSON.stringify(body),/PRIVATE|SYNTHETIC/);
 }
});
test('translation validation details cannot be forged by an inference exception',async()=>{
 const response=await worker.fetch(request(),environment(async()=>{throw Object.assign(Error('PRIVATE_BINDING_ERROR'),{validationReason:'number-mismatch'});})),body=await response.json();assert.equal(body.failureReason,'inference');assert.equal(body.validationReason,undefined);assert.doesNotMatch(JSON.stringify(body),/PRIVATE/);
});
test('translation validation capability is advertised without changing context or model protocols',async()=>{
 const body=await(await worker.fetch(new Request('https://service.test/health'),{})).json();assert.deepEqual(body.translation.validationReasons,['incomplete','invalid-text','number-mismatch','condition-mismatch','quantity-role-mismatch','unknown']);assert.deepEqual(body.translation.failureReasons,['cancelled','timeout','inference','invalid-result','capacity']);assert.equal(body.translation.model,'@cf/openai/gpt-oss-120b');assert.equal(body.translation.version,'ai-translation-v1');assert.equal(body.version,'ai-context-v3');
});
test('translation validation details leave legacy pause and no-retry behavior intact',async()=>{
 for(const validationReason of ['incomplete','invalid-text','number-mismatch','condition-mismatch','quantity-role-mismatch','unknown']){
  let calls=0;const provider=createTranslationProvider({request:async()=>{calls++;return {ok:false,error:'正文翻译暂不可用，请稍后重试',code:'TRANSLATION_UNAVAILABLE',failureReason:'invalid-result',validationReason,retryable:false};}});await assert.rejects(provider.translate(text),error=>error.code==='TRANSLATION_UNAVAILABLE'&&error.retryable===false);assert.equal(calls,1);
 }
});
