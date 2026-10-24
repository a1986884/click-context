import {test} from 'node:test';
import assert from 'node:assert/strict';
import {executeEngineTranslation} from '../src/engine-executor.js';
import {createTranslationProvider} from '../src/providers.js';
import {TRANSLATION_CACHE_VERSION} from '../src/translation-service.js';

// Synthetic transport fixtures only: echoing source does not test translation quality.
const source='A sentence. '.repeat(420).trim();
const profile=protocol=>({protocol,preset:protocol,endpoint:'https://api.example.test/translate',apiKey:'synthetic-key',model:'fixture-model'});
const compact=value=>value.replace(/\s+/gu,' ').trim();
function input(protocol,options){
 const body=JSON.parse(options.body);
 if(protocol==='google')return body.q;
 if(protocol==='microsoft')return body[0].Text;
 if(protocol==='deepl')return body.text[0];
 return JSON.parse(protocol==='responses'?body.input:protocol==='gemini'?body.contents[0].parts[0].text:body.messages.at(-1).content).text;
}
function response(protocol,text){
 const value='译文 '+text;
 switch(protocol){
  case 'google':return Response.json({data:{translations:[{translatedText:value}]}});
  case 'microsoft':return Response.json([{translations:[{text:value,to:'zh-Hans'}]}]);
  case 'deepl':return Response.json({translations:[{text:value}]});
  case 'openai':return Response.json({choices:[{finish_reason:'stop',message:{content:value}}]});
  case 'anthropic':return Response.json({stop_reason:'end_turn',content:[{type:'text',text:value}]});
  case 'gemini':return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:value}]}}]});
  case 'responses':return Response.json({status:'completed',output:[{type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text:value}]}]});
 }
}
for(const protocol of ['google','microsoft','deepl']){
 test(protocol+' sends 5039-character source in two complete sequential native requests',async()=>{
  const parts=[];let active=0;
  const translated=await executeEngineTranslation(profile(protocol),source,{fetcher:async(url,options)=>{
   assert.equal(++active,1);const part=input(protocol,options);parts.push(part);
   assert.ok(part.length<=4000);assert.ok(Buffer.byteLength(options.body)<100*1024);
   await Promise.resolve();active--;return response(protocol,part);
  }});
  assert.equal(parts.length,2);assert.equal(compact(parts.join(' ')),source);
  assert.equal(compact(translated.replaceAll('译文 ','')),source);
 });
 test(protocol+' sends a 2000-character selection as one native request',async()=>{
  const selected=('Selection text. '.repeat(125)).trim()+'!';assert.equal(selected.length,2000);let calls=0;
  await executeEngineTranslation(profile(protocol),selected,{fetcher:async(url,options)=>{calls++;assert.equal(input(protocol,options),selected);return response(protocol,selected);}});
  assert.equal(calls,1);
 });
 test(protocol+' rejects a later native chunk failure without returning partial text or retrying',async()=>{
  let calls=0;await assert.rejects(executeEngineTranslation(profile(protocol),source,{fetcher:async(url,options)=>{
   calls++;return calls===1?response(protocol,input(protocol,options)):new Response('',{status:503});
  }}),error=>error.code==='TRANSLATION_UNAVAILABLE');assert.equal(calls,2);
 });
 test(protocol+' cancellation after the first response prevents all later native requests',async()=>{
  const controller=new AbortController();let calls=0;
  await assert.rejects(executeEngineTranslation(profile(protocol),source,{signal:controller.signal,fetcher:async(url,options)=>{
   calls++;const result=response(protocol,input(protocol,options));controller.abort();return result;
  }}),error=>error.name==='AbortError');assert.equal(calls,1);
 });
 test(protocol+' preserves Unicode and escaped content within request byte limits',async()=>{
  const text=('A 😀 sample with \"quotes\", \\slashes and café. '.repeat(105)).trim(),parts=[];
  await executeEngineTranslation(profile(protocol),text,{fetcher:async(url,options)=>{
   const part=input(protocol,options);parts.push(part);assert.ok(part.length<=4000);assert.ok(Buffer.byteLength(options.body)<100*1024);
   assert.equal(part.isWellFormed(),true);return response(protocol,part);
  }});
  assert.equal(parts.length,2);assert.equal(compact(parts.join(' ')),compact(text));
 });
 test(protocol+' keeps numeric validation for a later large native chunk',async()=>{
  const text=source+' The value is 12.5.';let calls=0;
  await assert.rejects(executeEngineTranslation(profile(protocol),text,{fetcher:async(url,options)=>{
   calls++;return response(protocol,input(protocol,options).replace('12.5','13'));
  }}),error=>error.code==='TRANSLATION_UNAVAILABLE');assert.equal(calls,2);
 });
 test(protocol+' rejects oversized input before sending any native request',async()=>{
  let calls=0;await assert.rejects(executeEngineTranslation(profile(protocol),'a'.repeat(20001),{fetcher:async()=>{calls++;throw Error('unexpected');}}));assert.equal(calls,0);
 });
}
for(const protocol of ['openai','responses','anthropic','gemini'])test(protocol+' retains 1200-character AI chunks and five requests',async()=>{
 const parts=[];
 await executeEngineTranslation(profile(protocol),source,{fetcher:async(url,options)=>{const part=input(protocol,options);parts.push(part);assert.ok(part.length<=1200);return response(protocol,part);}});
 assert.equal(parts.length,5);assert.equal(compact(parts.join(' ')),source);
});
test('default Cloudflare translation retains 1200-character chunks and its revision',async()=>{
 const parts=[],provider=createTranslationProvider({request:async(url,fetcher,options)=>{
  const body=JSON.parse(options.body);parts.push(body.text);assert.ok(body.text.length<=1200);assert.equal(body.translationRevision,TRANSLATION_CACHE_VERSION);
  return {ok:true,data:{text:'译文 '+body.text,version:TRANSLATION_CACHE_VERSION}};
 }});
 await provider.translate(source);assert.equal(parts.length,5);assert.equal(compact(parts.join(' ')),source);
});
