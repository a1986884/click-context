import {test} from 'node:test';import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {parseTranslationResult,cleanTranslation,translationPrompt,TRANSLATION_CACHE_VERSION,TRANSLATION_LEGACY_CACHE_VERSION} from '../src/translation-service.js';
import {conditionalRelation} from '../src/condition-direction.js';
import worker from '../workers/context/index.js';
// Actual 0.7.85 failures. Successful HTTP responses must not make these correct.
const actualFailures=[
 ['If the observations are independent, the estimate is valid; see Eq. (3) and Fig. 2.','仅当观测相互独立时，估计才有效；见式 (3) 和图 2。'],
 ['The estimate is valid if and only if the observations are independent; see Eq. (3) and Fig. 2.','只有当观测值相互独立时，估计才有效；见式 (3) 和图 2。'],
 ['The alarm stops if and only if the pressure is not above 5.0 bar.','警报仅在压力不超过5.0 bar时才会停止。']
];
for(const [text,output] of actualFailures)test('reject actual direction loss: '+text,()=>{
 assert.throws(()=>parseTranslationResult({response:output},{text}),error=>error.validationReason==='condition-mismatch');
});
const unseen=[
 ['The door unlocks if the code matches.','如果密码匹配，门就会解锁。','只有密码匹配，门才会解锁。'],
 ['The door unlocks only if the code matches.','只有密码匹配，门才会解锁。','只要密码匹配，门就会解锁。'],
 ['The door unlocks if and only if the code matches.','当且仅当密码匹配，门才会解锁。','如果密码匹配，门就会解锁。'],
 ['If the sensor is dry, the fan stops.','如果传感器干燥，风扇就会停止。','仅当传感器干燥，风扇才会停止。']
];
for(const [text,correct,incorrect] of unseen)test('unseen-topic conditional preserves its direction: '+text,()=>{
 assert.equal(parseTranslationResult({response:correct},{text}).text,correct);assert.throws(()=>parseTranslationResult({response:incorrect},{text}),e=>e.validationReason==='condition-mismatch');
});
test('only-if is not strengthened into a biconditional or mixed only-if/if wording',()=>{
 const text='The lamp lights only if the button is pressed.';
 for(const output of ['只要按下按钮，灯才会亮。','当且仅当按下按钮，灯才会亮。','只要且仅当按下按钮，灯才会亮。'])assert.throws(()=>parseTranslationResult({response:output},{text}),e=>e.validationReason==='condition-mismatch');
});
test('modality in the consequent and ordinary premise wording do not invent a direction mismatch',()=>{
 for(const [text,response] of [['If pressure rises, the valve must close.','如果压力升高，阀门必须关闭。'],['The result is valid if the assumption holds.','在假设成立的前提下，结果有效。']])assert.equal(parseTranslationResult({response},{text}).text,response);
 assert.equal(conditionalRelation('If the gate is open, only the blue light flashes.'),null);
});
test('single-clause classification explicitly declines nested, metalinguistic and hypothetical cases',()=>{
 for(const text of ['If A holds, B holds only if C holds.','What if the lamp fails?','Even if the button is pressed, the lamp stays dark.','The phrase "only if" denotes a necessary condition.','If needed.'])assert.equal(conditionalRelation(text),null);
 assert.equal(conditionalRelation('Only if the button is pressed does the lamp light.'),'necessary');
});
test('v2 missing-request behavior preserves the actual 0.7.85 prompt bytes and parser contract',()=>{
 const input=cleanTranslation({text:'A public statement 12.5.'});assert.equal(input.translationRevision,TRANSLATION_LEGACY_CACHE_VERSION);
 const hash=createHash('sha256').update(JSON.stringify(translationPrompt(input))).digest('hex');assert.equal(hash,'f3a65cca627388c7f80f4c0bb5f38e66768b80de4a58d966c66e86753ef62ec9');
 const [text,response]=actualFailures[0];assert.equal(parseTranslationResult({response},{text,translationRevision:TRANSLATION_LEGACY_CACHE_VERSION}).version,TRANSLATION_LEGACY_CACHE_VERSION);
});
const environment=run=>({AI:{run},TRANSLATION_IP:{limit:async()=>({success:true})},TRANSLATION_TOTAL:{limit:async()=>({success:true})}});
const request=(text,translationRevision)=>new Request('https://fixture.test/translate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,...(translationRevision===undefined?{}:{translationRevision})})});
test('the backend simultaneously serves explicit v3 and unversioned legacy v2 clients',async()=>{
 const input='The lamp lights if the button is pressed.',output='如果按下按钮，灯就会亮。';
 for(const [requested,expected] of [[undefined,TRANSLATION_LEGACY_CACHE_VERSION],[TRANSLATION_LEGACY_CACHE_VERSION,TRANSLATION_LEGACY_CACHE_VERSION],[TRANSLATION_CACHE_VERSION,TRANSLATION_CACHE_VERSION]]){
  const r=await worker.fetch(request(input,requested),environment(async()=>({response:output})));assert.equal(r.status,200);assert.equal((await r.json()).data.version,expected);
 }
});
test('a rejected direction gets at most one bounded retry, then a safe fixed cause with no output',async()=>{
 let calls=0;const [input,output]=actualFailures[0];const r=await worker.fetch(request(input,TRANSLATION_CACHE_VERSION),environment(async()=>{calls++;return {response:output};})),body=await r.json();
 assert.equal(r.status,503);assert.equal(body.validationReason,'condition-mismatch');assert.equal(body.translationRevision,TRANSLATION_CACHE_VERSION);assert.equal(body.retryable,false);assert.equal(calls,2);assert.equal(body.data,undefined);assert.ok(!JSON.stringify(body).includes(output));
});
test('an unsupported revision is rejected before model invocation',async()=>{
 let calls=0;const r=await worker.fetch(request('The lamp lights.','unknown-private-revision'),environment(async()=>{calls++;return {response:'灯亮了。'};}));assert.equal(r.status,400);assert.equal(calls,0);assert.ok(!(await r.text()).includes('unknown-private-revision'));
});
