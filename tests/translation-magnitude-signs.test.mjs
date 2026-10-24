import test from 'node:test';import assert from 'node:assert/strict';import {createTranslationProvider} from '../src/providers.js';import {TRANSLATION_CACHE_VERSION} from '../src/translation-service.js';import {executeEngineTranslation} from '../src/engine-executor.js';
const p={id:'example',preset:'google',protocol:'google',endpoint:'https://translation.googleapis.com/language/translate/v2',apiKey:'EXAMPLE_MAGNITUDE_KEY'};
const run=(source,target)=>executeEngineTranslation(p,source,{fetcher:async()=>Response.json({data:{translations:[{translatedText:target}]}})});
for(const [source,target]of [
 ['The temperature fell to 2.0 degrees Celsius.','温度降至负2.0摄氏度。'],
 ['The pressure decreased to 2.0 pascals.','压力降至负2.0帕斯卡。'],
 ['The loss was 3.5% and the temperature was 2.0 degrees Celsius.','损失为3.5%，温度为负2.0摄氏度。'],
 ['The return was a loss of 3.5% and the temperature was 2.0 degrees Celsius.','回报为负3.5%，温度为负2.0摄氏度。'],
 ['The return was a loss of 3.5% and the temperature was 3.5 degrees Celsius.','回报为3.5%，温度为负3.5摄氏度。'],
 ['The output fell by 3.5%, and the temperature was 2.0 degrees Celsius.','产量变化为负3.5%，温度为负2.0摄氏度。'],
 ['The temperature fell by 3.5 degrees Celsius.','温度为负3.5摄氏度。']
])test('reject unrelated/level sign reversal: '+source,async()=>await assert.rejects(run(source,target),e=>e.code==='TRANSLATION_UNAVAILABLE'&&e.retryable===false));
for(const [source,target]of [
 ['The return was a loss of 3.5%.','回报为负3.5%。'],
 ['The output fell by 3.5%.','产量变化为负3.5%。'],
 ['The return was a loss of 3.5% and the temperature was 2.0 degrees Celsius.','回报为负3.5%，温度为2.0摄氏度。'],
 ['The return was a loss of 3.5% and the temperature was 3.5 degrees Celsius.','回报为负3.5%，温度为3.5摄氏度。'],
 ['The temperature fell to 2.0 degrees Celsius.','温度降至2.0摄氏度。'],
 ['The output fell by 3.5%.','产量下降了3.5%。'],
 ['The result was a loss of 3.5.','回报为负3.5。'],
 ['The return was a loss of 3.5, and the balance was 2.0.','回报为负3.5，余额为2.0。'],
 ['The output decreased by 3.5.','产量变化为负3.5。']
])test('preserve explicit magnitude or positive level: '+source,async()=>assert.equal(await run(source,target),target));

for(const [source,target,valid]of [["The temperature fell to 2.0 degrees Celsius.","温度降至负2.0摄氏度。",false],["The return was a loss of 3.5%.","回报为负3.5%。",true]])test("builtin client uses the same scoped exception: "+source,async()=>{let calls=0;const provider=createTranslationProvider({request:async()=>{calls++;return {ok:true,data:{text:target,version:TRANSLATION_CACHE_VERSION}};}});if(valid)assert.equal(await provider.translate(source),target);else await assert.rejects(provider.translate(source),e=>e.code==="TRANSLATION_UNAVAILABLE"&&e.retryable===false);assert.equal(calls,1);});
