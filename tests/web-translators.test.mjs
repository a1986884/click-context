import test from 'node:test';
import assert from 'node:assert/strict';
import {createWebTranslator} from '../src/web-translators.js';
import {normalizeEngineSettings,publicEngineSettings} from '../src/engine-profiles.js';
import {createUserscriptEngines} from '../userscript/engines.js';
const text='The river is quiet.',zh='河流很安静。';
const page='<script>IG:"TEST123"; var params_AbusePreventionHelper = [123456,"public-session-token",3600000];</script><div data-iid="translator.5023"></div>';
test('web engines are independent choices without profiles or credentials; context and profile IDs stay protected',()=>{
 const state=normalizeEngineSettings({body:'google-free',selection:'microsoft-free',profiles:[]});const view=publicEngineSettings(state);
 assert.equal(view.body.id,'google-free');assert.equal(view.selection.id,'microsoft-free');assert.notEqual(view.body.cacheKey,view.selection.cacheKey);assert.equal(view.context.id,'builtin');
 assert.throws(()=>normalizeEngineSettings({...state,context:'google-free'}));
 assert.throws(()=>normalizeEngineSettings({profiles:[{id:'google-free',preset:'ollama',label:'x',model:'x'}]}));
});
test('Google concatenates every segment, encodes source text, and sends no key/cookies',async()=>{
 let call;const api=createWebTranslator({fetcher:async(url,options)=>{call={url,options};return Response.json([[[zh,text],['水很清。','The water is clear.']]]);}});
 assert.equal(await api.translate('google-free',text),zh+'水很清。');assert.equal(new URL(call.url).searchParams.get('q'),text);assert.equal(call.options.credentials,'omit');assert.equal(call.options.redirect,'error');assert.equal(call.options.headers,undefined);
});
test('Microsoft reads public page parameters once and keeps the session only in memory until expiry',async()=>{
 const calls=[];let clock=0;const api=createWebTranslator({now:()=>clock,fetcher:async(url,options)=>{calls.push({url,options});return url.endsWith('/translator')?new Response(page):Response.json([{translations:[{to:'zh-Hans',text:zh}]}]);}});
 assert.equal(await api.translate('microsoft-free',text),zh);assert.equal(await api.translate('microsoft-free',text),zh);assert.equal(calls.length,3);
 assert.equal(new URL(calls[1].url).searchParams.get('IID'),'translator.5023');assert.equal(new URLSearchParams(calls[1].options.body).get('text'),text);assert.equal(calls[1].options.credentials,'omit');assert.equal(calls[1].options.headers.Authorization,undefined);
 clock=600001;await api.translate('microsoft-free',text);assert.equal(calls.length,5);
});
test('web translation failures never retry, switch providers, or accept challenge/malformed/partial results',async()=>{
 for(const response of [new Response('verification page'),Response.json({ShowCaptcha:true}),Response.json([[[zh,text],null]]),Response.json([[["The river is quiet.",text]]]),Response.json([], {status:429})]){
  let calls=0;const api=createWebTranslator({fetcher:async()=>{calls++;return response;}});await assert.rejects(api.translate('google-free',text));assert.equal(calls,1);
 }
 let calls=0;const api=createWebTranslator({fetcher:async()=>{calls++;return new Response('<html>verification</html>');}});await assert.rejects(api.translate('microsoft-free',text));assert.equal(calls,1);
});
test('numeric validation and response size guards also apply to keyless engines',async()=>{
 const api=createWebTranslator({fetcher:async()=>Response.json([[["数值为 13。","The value is 12."]]])});await assert.rejects(api.translate('google-free','The value is 12.'));
 const large=createWebTranslator({fetcher:async()=>new Response('x'.repeat(1024*1024+1))});await assert.rejects(large.translate('google-free',text));
});
test('long prose uses bounded sequential chunks',async()=>{
 let calls=0;const api=createWebTranslator({fetcher:async url=>{calls++;const part=new URL(url).searchParams.get('q');assert.ok(part.length<=600);return Response.json([[[zh,part]]]);}});
 await api.translate('google-free',Array(60).fill(text).join(' '));assert.ok(calls>1);
});
test('abort and deadline settle even when transport ignores abort',async()=>{
 const controller=new AbortController(),api=createWebTranslator({fetcher:()=>new Promise(()=>{})});const task=api.translate('google-free',text,{signal:controller.signal});controller.abort();await assert.rejects(task,{name:'AbortError'});
 // Keep one ordinary timer alive while the platform timeout signal fires.
 const keep=setTimeout(()=>{},100);try{await assert.rejects(createWebTranslator({fetcher:()=>new Promise(()=>{}),timeoutMs:5}).translate('google-free',text),e=>e.code==='TRANSLATION_UNAVAILABLE');}finally{clearTimeout(keep);}
});
test('unknown script managers can save and use public engines while retaining existing API profiles',async()=>{
 let value=normalizeEngineSettings({profiles:[{id:'saved-api',preset:'ollama',label:'Saved API',endpoint:'http://localhost:11434/v1/chat/completions',model:'fixture',apiKey:'EXAMPLE_RETAINED_API_KEY'}]});const calls=[];const api=createUserscriptEngines({getValue:async()=>value,setValue:async(k,v)=>value=structuredClone(v),info:{scriptHandler:'Other',version:'1'},request:d=>{calls.push(d);queueMicrotask(()=>d.onload({status:200,response:JSON.stringify([[[zh,text]]])}));return {abort(){}};}});
 const settings=await api.read();settings.body='google-free';settings.selection='microsoft-free';await api.save(settings,{authorize:()=>assert.fail('no API host confirmation')});assert.equal(await api.translate('body',text),zh);assert.equal(calls.length,1);assert.equal(calls[0].anonymous,true);assert.equal(value.profiles.length,1);assert.equal(value.profiles[0].apiKey,'EXAMPLE_RETAINED_API_KEY');
});
