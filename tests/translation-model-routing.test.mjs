import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import worker from '../workers/context/index.js';import {cleanTranslation,translationPrompt,parseTranslationResult,TRANSLATION_CACHE_VERSION} from '../src/translation-service.js';
const v4='cloudflare-ai:en-zh:v4',v3='cloudflare-ai:en-zh:v3',v2='cloudflare-ai:en-zh:v2',model='@cf/zai-org/glm-4.7-flash',previous='@cf/openai/gpt-oss-120b';
const text='The difference was not significant (p = 0.08).',zh='差异不显著（p = 0.08）。';
const request=revision=>new Request('https://fixture.test/translate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text,...(revision?{translationRevision:revision}:{})})});
const env=run=>({AI:{run},TRANSLATION_IP:{limit:async()=>({success:true})},TRANSLATION_TOTAL:{limit:async()=>({success:true})}});
test('new clients use the corrected v5 cache namespace',()=>assert.equal(TRANSLATION_CACHE_VERSION,'cloudflare-ai:en-zh:v5'));
test('v4 uses messages and bounded nonreasoning generation without changing the public success shape',async()=>{
 const calls=[];const response=await worker.fetch(request(v4),env(async(m,p,o)=>{calls.push({m,p,o});return {response:zh,choices:[{finish_reason:'stop',message:{role:'assistant',content:zh,refusal:null}}],usage:{completion_tokens:20}};}));
 assert.equal(response.status,200);assert.deepEqual((await response.json()).data,{text:zh,provider:'cloudflare-ai',model,version:v4});assert.equal(calls.length,1);assert.equal(calls[0].m,model);assert.ok(calls[0].o.signal instanceof AbortSignal);assert.equal(calls[0].p.messages[0].role,'system');assert.equal(calls[0].p.messages[1].role,'user');assert.deepEqual(JSON.parse(calls[0].p.messages[1].content),{text});assert.equal(calls[0].p.temperature,0);assert.deepEqual(calls[0].p.chat_template_kwargs,{enable_thinking:false});assert.equal(calls[0].p.reasoning,undefined);assert.equal(calls[0].p.max_output_tokens,undefined);assert.ok(calls[0].p.max_tokens>=1600&&calls[0].p.max_tokens<=2600);
});
test('unversioned, v2 and v3 clients retain the previous model and response revision',async()=>{
 for(const revision of [undefined,v2,v3]){let called;const response=await worker.fetch(request(revision),env(async(m,p)=>{called={m,p};return {response:zh};}));assert.equal(response.status,200);const data=(await response.json()).data;assert.equal(called.m,previous);assert.equal(data.model,previous);assert.equal(data.version,revision??v2);assert.equal(JSON.parse(called.p.input).text,text);assert.deepEqual(called.p.reasoning,{effort:'low'});assert.equal(called.p.max_output_tokens,revision===v3?1600:1000);}
});
test('actual 97 short and long v3 prompt bytes remain frozen',()=>{
 for(const [text,hash]of [['A public statement 12.5.','1a44be345215e6cd8c6625b0aa130153620343da83acbcd72e0c260d7afad989'],['A public sentence about the result. '.repeat(50),'1ec4e4133771e361419fd8d4a1ff332c2fce47a478b376975bec47c767c9b812']])assert.equal(createHash('sha256').update(JSON.stringify(translationPrompt(cleanTranslation({text,translationRevision:v3})))).digest('hex'),hash);
});
for(const [name,raw,reason]of [
 ['length-finished text',{response:zh,choices:[{finish_reason:'length'}]},'max-output-tokens'],
 ['output at the token ceiling',{response:zh,usage:{completion_tokens:1600}},'max-output-tokens'],
 ['filtered output',{response:zh,choices:[{finish_reason:'content_filter'}]},'content-filter']
])test('v4 rejects '+name+' even when the text looks complete',async()=>{
 let calls=0;const response=await worker.fetch(request(v4),env(async()=>{calls++;return raw;})),body=await response.json();assert.equal(response.status,503);assert.equal(calls,2);assert.equal(body.validationReason,'incomplete');assert.equal(body.incompleteReason,reason);assert.equal(body.outputTokenLimit,1600);assert.equal(body.data,undefined);assert.equal(body.retryable,false);assert.ok(!JSON.stringify(body).includes(zh));
});
test('v4 preserves numbers and condition direction guards',()=>{
 assert.throws(()=>parseTranslationResult({response:'差异不显著（p = 0.8）。'},{text,translationRevision:v4}),e=>e.validationReason==='number-mismatch');assert.throws(()=>parseTranslationResult({response:'只要按下按钮，灯就会亮。'},{text:'The lamp lights only if the button is pressed.',translationRevision:v4}),e=>e.validationReason==='condition-mismatch');
});
test('v3 still applies the balanced condition direction guard',()=>assert.throws(()=>parseTranslationResult({response:'只要按下按钮，灯就会亮。'},{text:'The lamp lights only if the button is pressed.',translationRevision:v3}),e=>e.validationReason==='condition-mismatch'));
test('health distinguishes current model from the unversioned legacy model and preserves word context',async()=>{
 const body=await(await worker.fetch(new Request('https://fixture.test/health'),{})).json();assert.equal(body.model,previous);assert.equal(body.translation.model,previous);assert.equal(body.translation.currentModel,model);assert.equal(body.translation.defaultCacheVersion,v2);assert.deepEqual(body.translation.acceptedCacheVersions,[v2,v3,v4,TRANSLATION_CACHE_VERSION]);assert.equal(body.translation.inferenceTimeoutMs,16000);
});
test('v4 cancellation prevents retries even if the model binding ignores its signal',{timeout:1000},async()=>{
 const controller=new AbortController();let calls=0,signal;const pending=worker.fetch(new Request(request(v4),{signal:controller.signal}),env((_m,_p,o)=>{calls++;signal=o.signal;return new Promise(()=>{});}));await new Promise(setImmediate);controller.abort();const body=await(await pending).json();assert.equal(body.failureReason,'cancelled');assert.equal(body.retryable,false);assert.equal(calls,1);assert.equal(signal.aborted,true);
});
test('v4 shares the original deadline across inference instead of waiting on an uncooperative binding',{timeout:1000},async t=>{
 const original=AbortSignal.timeout.bind(AbortSignal),deadlines=[];t.mock.method(AbortSignal,'timeout',ms=>{deadlines.push(ms);return original(8);});let calls=0;const keepAlive=setTimeout(()=>{},500);
 try{const body=await(await worker.fetch(request(v4),env(()=>{calls++;return new Promise(()=>{});}))).json();assert.equal(body.failureReason,'timeout');assert.equal(calls,1);assert.deepEqual(deadlines,[16000]);}finally{clearTimeout(keepAlive);}
});
