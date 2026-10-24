import test from 'node:test';import assert from 'node:assert/strict';
import {executeEngineTranslation} from '../src/engine-executor.js';
import {normalizeEngineSettings} from '../src/engine-profiles.js';
import {createTranslationProvider} from '../src/providers.js';
import {TRANSLATION_CACHE_VERSION} from '../src/translation-service.js';
const sourceNegative='The temperature was -2.0 degrees Celsius.',sourcePositive='The temperature was 2.0 degrees Celsius.',cold='温度为零下2.0摄氏度。';
const profile=preset=>normalizeEngineSettings({body:'example',selection:'example',profiles:[{id:'example',preset,label:'Example provider',model:['openai'].includes(preset)?'fixture':'',apiKey:'EXAMPLE_NUMBER_FORMAT_KEY'}]}).profiles[0];
const response=(preset,text)=>Response.json(preset==='google'?{data:{translations:[{translatedText:text}]}}:preset==='microsoft'?[{translations:[{to:'zh-Hans',text}]}]:preset==='deepl'?{translations:[{text}]}:{choices:[{finish_reason:'stop',message:{role:'assistant',content:text}}]});
for(const preset of ['google','microsoft','deepl']){
 for(const [id,source,text]of [['below-zero',sourceNegative,cold],['negative-percent','The change was -3.5%.','变化为负3.5%。']])test(preset+' accepts correct Chinese '+id+' and preserves its displayed wording',async()=>{let calls=0;const p=profile(preset);assert.equal(await executeEngineTranslation(p,source,{fetcher:async(_url,options)=>{calls++;assert.ok(options.body.includes(source));return response(preset,text);}}),text);assert.equal(calls,1);});
 for(const [id,source,text]of [['below-zero',sourcePositive,cold],['negative-percent','The change was 3.5%.','变化为负3.5%。']])test(preset+' rejects a Chinese '+id+' sign reversal without retry or fallback',async()=>{let calls=0;await assert.rejects(executeEngineTranslation(profile(preset),source,{fetcher:async()=>{calls++;return response(preset,text);}}),error=>error.code==='TRANSLATION_UNAVAILABLE'&&error.retryable===false);assert.equal(calls,1);});
}
for(const [source,text]of [
 ['The value was negative 2.0.','值为负2.0。'],
 ['The temperature was minus 2.0 degrees Celsius.',cold],
 ['The temperature was 2.0 degrees below zero.',cold],
 ['The expression is 5 minus 2.','表达式为5减2。'],
 ['The tolerance was ±2.0.','公差为正负2.0。'],
 ['The load was 3.5 watts.','负载为3.5瓦。'],
 ['The return was a loss of 3.5%.','回报为负3.5%。']
])test('client sign handling preserves valid expression: '+source,async()=>assert.equal(await executeEngineTranslation(profile('google'),source,{fetcher:async()=>response('google',text)}),text));
test('an explicitly negative English value cannot become positive Chinese',async()=>await assert.rejects(executeEngineTranslation(profile('google'),'The value was negative 2.0.',{fetcher:async()=>response('google','值为2.0。')}),e=>e.code==='TRANSLATION_UNAVAILABLE'&&e.retryable===false));
test('Google entity-decoded signs keep the original degree glyph in displayed text',async()=>assert.equal(await executeEngineTranslation(profile('google'),sourceNegative,{fetcher:async()=>response('google','温度为&#38646;&#19979;2.0&#8451;。')}),'温度为零下2.0℃。'));
test('a numeric-only Chinese answer keeps its negative word',async()=>assert.equal(await executeEngineTranslation(profile('google'),'The value is -2.0.',{fetcher:async()=>response('google','负2.0')}),'负2.0'));
test('builtin client rejects a verbal sign reversal as nonretryable and does not cache failure',async()=>{let calls=0;const p=createTranslationProvider({request:async()=>({ok:true,data:{text:++calls===1?cold:'温度为2.0摄氏度。',version:TRANSLATION_CACHE_VERSION}})});await assert.rejects(p.translate(sourcePositive),e=>e.code==='TRANSLATION_UNAVAILABLE'&&e.retryable===false);assert.equal(await p.translate(sourcePositive),'温度为2.0摄氏度。');assert.equal(calls,2);});
test('builtin client preserves a valid verbal negative returned by a synthetic compatible endpoint',async()=>{const p=createTranslationProvider({request:async()=>({ok:true,data:{text:cold,version:TRANSLATION_CACHE_VERSION}})});assert.equal(await p.translate(sourceNegative),cold);});
for(const kind of ['external','builtin'])test(kind+' does not display an unexpected inline reasoning block as translation',async()=>{const text='<think>EXAMPLE_ANALYSIS_NOT_TRANSLATION</think>河流很安静。',source='The river is quiet.';if(kind==='external')await assert.rejects(executeEngineTranslation(profile('openai'),source,{fetcher:async()=>response('openai',text)}),e=>e.code==='TRANSLATION_UNAVAILABLE');else{const p=createTranslationProvider({request:async()=>({ok:true,data:{text,version:TRANSLATION_CACHE_VERSION}})});await assert.rejects(p.translate(source),e=>e.code==='TRANSLATION_UNAVAILABLE'&&e.retryable===false);}});
test('literal think-tag text in the source remains data to translate',async()=>{const text='<think> 标签用于标记一个部分。';assert.equal(await executeEngineTranslation(profile('openai'),'The literal <think> tag marks a section.',{fetcher:async()=>response('openai',text)}),text);});
