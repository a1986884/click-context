import {test} from 'node:test';import assert from 'node:assert/strict';import {createOffscreenParser} from '../extension/offscreen-client.js';
const tick=()=>new Promise(setImmediate);
function api(){const calls={creates:[],contexts:[],messages:[]};let exists=false;return {calls,runtime:{getURL:path=>'chrome-extension://test/'+path,getContexts:async query=>{calls.contexts.push(query);return exists?[{}]:[];},sendMessage:async message=>{calls.messages.push(message);return {ok:true,data:{head:'unit'}};}},offscreen:{createDocument:async options=>{calls.creates.push(options);exists=true;}},lose(){exists=false;}};}
test('offscreen creation is lazy, singleton under concurrency, and reuses an existing document across worker instances',async()=>{
 const chrome=api(),parse=createOffscreenParser(chrome);assert.equal(chrome.calls.creates.length,0);await Promise.all([parse('one','youdao-senses'),parse('two','youdao-senses')]);assert.equal(chrome.calls.creates.length,1);assert.deepEqual(chrome.calls.creates[0].reasons,['DOM_PARSER']);assert.deepEqual(chrome.calls.contexts[0],{contextTypes:['OFFSCREEN_DOCUMENT'],documentUrls:['chrome-extension://test/offscreen.html']});
 await createOffscreenParser(chrome)('three','youdao-first');assert.equal(chrome.calls.creates.length,1);chrome.lose();await parse('four','youdao-senses');assert.equal(chrome.calls.creates.length,2);
});
test('creation failure is explicit, never sends HTML or falls back, and can be retried',async()=>{
 const chrome=api(),create=chrome.offscreen.createDocument;chrome.offscreen.createDocument=async()=>{throw Error('policy denied');};const parse=createOffscreenParser(chrome);await assert.rejects(parse('one','youdao-senses'),e=>e.code==='OFFSCREEN_CREATE_FAILED'&&e.message.includes('policy denied'));assert.equal(chrome.calls.messages.length,0);chrome.offscreen.createDocument=create;await parse('two','youdao-senses');
 const unsupported=createOffscreenParser({runtime:{}});await assert.rejects(unsupported('','youdao-senses'),e=>e.code==='OFFSCREEN_CREATE_FAILED');
});
test('cancelled caller does not cancel shared creation; extraction errors keep their original codes',async()=>{
 const chrome=api(),create=chrome.offscreen.createDocument;let release;chrome.offscreen.createDocument=async options=>{await new Promise(resolve=>release=resolve);await create(options);};const parse=createOffscreenParser(chrome),controller=new AbortController();const one=parse('one','youdao-senses',{signal:controller.signal}),two=parse('two','youdao-senses');await tick();const rejected=assert.rejects(one,{name:'AbortError'});controller.abort();await rejected;release();await two;assert.equal(chrome.calls.messages.length,1);assert.equal(chrome.calls.messages[0].html,'two');
 chrome.runtime.sendMessage=async()=>({ok:false,error:'missing',code:'COLLINS_ENTRY_UNAVAILABLE'});await assert.rejects(parse('three','youdao-senses'),e=>e.code==='COLLINS_ENTRY_UNAVAILABLE');
});
test('a confirmed missing offscreen document is recreated once without refetching or changing the parser',async()=>{
 const chrome=api(),send=chrome.runtime.sendMessage;let attempts=0;chrome.runtime.sendMessage=async message=>{attempts++;if(attempts===1){chrome.lose();throw Error('Receiving end disappeared');}return send(message);};
 const result=await createOffscreenParser(chrome)('same source HTML','youdao-senses');assert.equal(result.head,'unit');assert.equal(attempts,2);assert.equal(chrome.calls.creates.length,2);assert.equal(chrome.calls.messages[0].html,'same source HTML');
});
test('transport recovery is bounded and never retries an existing page or a dictionary extraction error',async()=>{
 const chrome=api();let attempts=0;chrome.runtime.sendMessage=async()=>{attempts++;throw Error('channel closed');};await assert.rejects(createOffscreenParser(chrome)('html','youdao-senses'),e=>e.code==='OFFSCREEN_CONNECTION_FAILED');assert.equal(attempts,1);
 chrome.runtime.sendMessage=async()=>{attempts++;chrome.lose();throw Error('channel closed');};attempts=0;await assert.rejects(createOffscreenParser(chrome)('html','youdao-senses'),e=>e.code==='OFFSCREEN_CONNECTION_FAILED');assert.equal(attempts,2);
 chrome.runtime.sendMessage=async()=>{attempts++;return {ok:false,error:'bad source',code:'COLLINS_ENTRY_UNAVAILABLE'};};attempts=0;await assert.rejects(createOffscreenParser(chrome)('html','youdao-senses'),e=>e.code==='COLLINS_ENTRY_UNAVAILABLE');assert.equal(attempts,1);
});
test('cancel during a lost-page message never recreates a parser; malformed success is explicit',async()=>{
 const chrome=api(),controller=new AbortController();chrome.runtime.sendMessage=async()=>{chrome.lose();controller.abort();throw Error('gone');};await assert.rejects(createOffscreenParser(chrome)('html','youdao-senses',{signal:controller.signal}),{name:'AbortError'});assert.equal(chrome.calls.creates.length,1);
 chrome.runtime.sendMessage=async()=>({ok:true});await assert.rejects(createOffscreenParser(chrome)('html','youdao-senses'),e=>e.code==='OFFSCREEN_PARSE_FAILED');
});
