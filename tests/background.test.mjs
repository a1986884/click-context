import {parseDictionaryHTML} from '../src/dom-parser-linkedom.js';
// Mocked Chrome contract tests: distinct from tests/browser's installed extension checks.
import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
const event=()=>({listeners:[],addListener(fn){this.listeners.push(fn);}});
function area(){const data={};return {data,get:async k=>k===null?structuredClone(data):({[k]:structuredClone(data[k])}),set:async value=>Object.assign(data,structuredClone(value)),remove:async keys=>{for(const key of Array.isArray(keys)?keys:[keys])delete data[key];}};}
const local=area(),session=area(),tabs=[{id:1,url:'https://one.test/article'},{id:2,url:'https://two.test/article'}];
const api={runtime:{id:'test-extension',getURL:p=>'chrome-extension://test-extension/'+p,onMessage:event(),onInstalled:event()},storage:{local,session},tabs:{get:async id=>tabs.find(t=>t.id===id),query:async()=>tabs,sendMessage:async(id,m)=>({running:m.state?.authorized===true}),create:async()=>{},onRemoved:event(),onUpdated:event()},scripting:{getRegisteredContentScripts:async()=>[],registerContentScripts:async()=>{},unregisterContentScripts:async()=>{},executeScript:async()=>[]},permissions:{contains:async()=>true,remove:async()=>true,onRemoved:event()}};
let offscreenExists=false;api.runtime.getContexts=async()=>offscreenExists?[{}]:[];api.offscreen={createDocument:async()=>{offscreenExists=true;}};api.runtime.sendMessage=async message=>({ok:true,data:parseDictionaryHTML(message.html,message.kind,{phrase:message.phrase})});
globalThis.chrome=api;
let engineFixture=null;api.engineFixture={get:async()=>engineFixture,set:async value=>{engineFixture=structuredClone(value);}};
const source="import {createEngineRepository} from "+JSON.stringify(new URL('../src/engine-vault.js',import.meta.url).href)+";\n"+(await readFile(new URL('../extension/background.js',import.meta.url),'utf8')).replace('const engines=createEngineVault();','const engines=createEngineRepository(chrome.engineFixture);').replace("'./dictionary-lookup.js'",JSON.stringify(new URL('../extension/dictionary-lookup.js',import.meta.url).href)).replaceAll("'./src/","'"+new URL('../src/',import.meta.url).href);
await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const listener=api.runtime.onMessage.listeners[0],ui={id:api.runtime.id,url:api.runtime.getURL('popup.html')},content=id=>({id:api.runtime.id,tab:tabs[id-1],frameId:0,url:tabs[id-1].url});
const send=(m,s=ui)=>new Promise(resolve=>listener(m,s,resolve));
test('background validates sender/frame/UI and independently enforces stored consent',async t=>{
 await t.test('external sender and subframe cannot bootstrap',async()=>{assert.equal((await send({type:'bootstrap'},{...content(1),id:'foreign'})).ok,false);assert.equal((await send({type:'bootstrap'},{...content(1),frameId:1})).ok,false);});
 await t.test('unapproved content cannot query or access shared words',async()=>{for(const m of [{type:'lookup',text:'ocean',online:true,requestId:'a'},{type:'store',op:'words',args:[]}])assert.equal((await send(m,content(1))).ok,false);});
 await t.test('temporary control only enables chosen tab',async()=>{assert.equal((await send({type:'control',action:'enable',tabId:1})).data.running,true);assert.equal((await send({type:'bootstrap'},content(2))).data.authorized,false);});
 await t.test('unapproved tabs cannot gain network or storage access using content flags',async()=>{assert.equal((await send({type:'translate',text:'Private text',online:true,requestId:'b'},content(2))).ok,false);assert.equal((await send({type:'store',op:'savePrefs',args:[{online:true}]},content(2))).ok,false);});
 await t.test('authorized site is online by default and malformed dictionary messages remain rejected',async()=>{const state=await send({type:'bootstrap'},content(1));assert.equal(state.data.prefs.online,true);assert.equal(state.data.prefs.enabled,false);const originalFetch=globalThis.fetch;globalThis.fetch=()=>{throw Error('Unexpected provider call while translation is off');};try{const blocked=await send({type:'translate',text:'Private paragraph',online:true,requestId:'translation-off'},content(1));assert.equal(blocked.ok,false);assert.match(blocked.error,/正文双语翻译已关闭/);}finally{globalThis.fetch=originalFetch;}assert.equal((await send({type:'lookup',text:'a'.repeat(101),requestId:'d'},content(1))).ok,false);});
 const fixture=head=>'<div id="authTrans"><h3>柯林斯英汉双解大词典</h3><div id="collinsResult"><h4><span class="title">'+head+'</span></h4><div class="collinsMajorTrans"><p><span class="additional">N-COUNT</span>A synthetic dictionary source fixture. 测试释义</p></div></div></div>';
 await t.test('plugin fetches only the chosen word from Youdao Collins; cached candidates never contain sentence context',async()=>{
  const originalFetch=globalThis.fetch,calls=[];globalThis.fetch=async(url,options)=>{calls.push({url,options});return new Response(fixture('ocean'));};
  try{
   const first=await send({type:'lookup',text:'ocean',online:true,requestId:'youdao-first',sentence:'Private sentence must not be forwarded.'},content(1));
   assert.equal(first.ok,true);assert.match(first.data.source,/Collins.*有道/);assert.equal(first.data.senses.length,1);assert.equal(calls.length,1);assert.equal(new URL(calls[0].url).hostname,'dict.youdao.com');assert.ok(!JSON.stringify(calls).includes('Private'));assert.equal(calls[0].options.credentials,'omit');
   const second=await send({type:'lookup',text:'ocean',online:true,requestId:'youdao-repeat'},content(1));assert.equal(second.ok,true);assert.equal(calls.length,1);
  }finally{globalThis.fetch=originalFetch;}
 });
 await t.test('a source denial stops without a retry or a silent switch to another dictionary',async()=>{
  const originalFetch=globalThis.fetch,calls=[];globalThis.fetch=async url=>{calls.push(url);return new Response('',{status:403});};
  try{const result=await send({type:'lookup',text:'unit',online:true,requestId:'youdao-denied'},content(1));assert.equal(result.ok,false);assert.equal(result.code,'COLLINS_ACCESS_DENIED');assert.equal(calls.length,1);assert.equal(new URL(calls[0]).hostname,'dict.youdao.com');}finally{globalThis.fetch=originalFetch;}
 });
 await t.test('legacy official-session settings and forged flags cannot send cookies to Youdao',async()=>{
  assert.equal((await send({type:'control',action:'collins-session',tabId:1,value:true},content(1))).ok,false);
  const originalFetch=globalThis.fetch,modes=[];globalThis.fetch=async(url,options)=>{modes.push(options.credentials);return new Response(fixture('unit'));};
  try{
   assert.equal((await send({type:'lookup',text:'unit',online:true,useSession:true,requestId:'forged-session'},content(1))).ok,true);assert.deepEqual(modes,['omit']);
   await send({type:'control',action:'collins-session',tabId:1,value:true});
   assert.equal((await send({type:'lookup',text:'unit',online:true,requestId:'old-session'},content(1))).ok,true);assert.deepEqual(modes,['omit']);
   await send({type:'control',action:'collins-session',tabId:1,value:false});
  }finally{globalThis.fetch=originalFetch;}
 });
 await t.test('only own UI may control tabs; preference validation and independent word switch apply',async()=>{assert.equal((await send({type:'control',action:'enable',tabId:2},content(1))).ok,false);await send({type:'control',action:'prefs',tabId:1,prefs:{mode:'original',words:false,online:false}});assert.equal((await send({type:'lookup',text:'ocean',requestId:'e'},content(1))).ok,false);});
 await t.test('vocabulary UI tab can read but cannot arbitrarily write raw entries',async()=>{const vocabulary={...ui,tab:{id:9},url:api.runtime.getURL('vocabulary.html')};assert.equal((await send({type:'store',op:'words',args:[]},vocabulary)).ok,true);assert.equal((await send({type:'store',op:'saveWord',args:[{lemma:'evil'}]},vocabulary)).ok,false);});
 await t.test('only trusted extension UI can import vocabulary and invalid imports preserve existing data',async()=>{const before=structuredClone(local.data['v2:words']);assert.equal((await send({type:'store',op:'importWords',args:[{version:2,words:[{word:'unit'}]}]},content(1))).ok,false);assert.equal((await send({type:'store',op:'importWords',args:[{version:2,words:[{word:'invalid <word>'}]}]})).ok,false);assert.deepEqual(local.data['v2:words'],before);});
 await t.test('trusted UI restores a valid backup above 2 MB while transport bytes remain bounded',async()=>{
  const before=structuredClone(local.data['v2:words']);const words=Array.from({length:1800},(_,i)=>({word:'study',zh:'学习',sentence:String(i)+':'+ 'A'.repeat(1200-6)}));
  const args=[{version:2,words}];assert.ok(new TextEncoder().encode(JSON.stringify(args)).byteLength>2*1024*1024);
  try{const result=await send({type:'store',op:'importWords',args});assert.equal(result.ok,true);assert.equal(result.data.added,1800);const snapshot=structuredClone(local.data['v2:words']);
   const tooLarge=await send({type:'store',op:'importWords',args:[{version:2,words:[],extra:'中'.repeat(6*1024*1024)}]});assert.equal(tooLarge.ok,false);assert.match(tooLarge.error,/无效存储请求/);assert.deepEqual(local.data['v2:words'],snapshot);
  }finally{if(before===undefined)delete local.data['v2:words'];else local.data['v2:words']=before;}
 });
 await t.test('unreadable stored vocabulary returns a coded error and every mutation preserves it',async()=>{
  const before=structuredClone(local.data['v2:words']);local.data['v2:words']={unexpected:'corrupted-shape'};
  try{for(const [op,args,sender]of [['words',[],ui],['removeWord',['bank'],ui],['importWords',[{version:2,words:[{word:'river'}]}],ui],['saveWord',[{word:'bank',lemma:'bank'}],content(1)]]){const result=await send({type:'store',op,args},sender);assert.equal(result.ok,false);assert.equal(result.code,'VOCABULARY_READ_FAILED');assert.deepEqual(local.data['v2:words'],{unexpected:'corrupted-shape'});}}
  finally{if(before===undefined)delete local.data['v2:words'];else local.data['v2:words']=before;}
 });
 await t.test('revoke immediately gates bootstrap and all later content operations',async()=>{await send({type:'control',action:'revoke',tabId:1});assert.equal((await send({type:'bootstrap'},content(1))).data.authorized,false);assert.equal((await send({type:'store',op:'cacheGet',args:['anything']},content(1))).ok,false);});
 const engineUI={...ui,url:api.runtime.getURL('engines.html')},key='synthetic-'+'k'.repeat(30);
 const configuration=()=>({body:'google-api',selection:'ai-api',profiles:[{id:'google-api',preset:'google',label:'Google fixture',endpoint:'https://translation.googleapis.com/language/translate/v2',apiKey:key},{id:'ai-api',preset:'custom',label:'AI fixture',endpoint:'https://api.example.test/v1/chat/completions',model:'fixture',apiKey:key}]});
 await t.test('only the dedicated extension settings page can manage engines',async()=>{
  for(const sender of [ui,content(1),{...engineUI,id:'foreign'}])assert.equal((await send({type:'engines:get'},sender)).ok,false);
  assert.equal((await send({type:'engines:save',settings:configuration()},engineUI)).ok,true);
  const result=await send({type:'engines:get'},engineUI);assert.equal(result.ok,true);assert.equal(result.data.profiles[0].hasKey,true);assert.ok(!JSON.stringify(result).includes(key));
 });
 await t.test('body and selection route independently without exposing credentials in bootstrap',async()=>{
  await send({type:'control',action:'enable',tabId:1,prefs:{words:true,enabled:true,mode:'bilingual'}});
  const state=(await send({type:'bootstrap'},content(1))).data;assert.ok(!JSON.stringify(state).includes(key));const original=globalThis.fetch,calls=[];
  globalThis.fetch=async(url,options)=>{calls.push({url,headers:options.headers});return url.includes('translation.googleapis')?Response.json({data:{translations:[{translatedText:'该值为12.5。'}]}}):Response.json({choices:[{finish_reason:'stop',message:{content:'该值是12.5。'}}]});};
  try{
   const body=await send({type:'translate',text:'The value is 12.5.',online:true,requestId:'engine-body',engineKey:state.engines.body.cacheKey},content(1));assert.equal(body.ok,true);assert.equal(body.data,'该值为12.5。');
   const selection=await send({type:'selection',text:'The value is 12.5.',online:true,requestId:'engine-selection',engineKey:state.engines.selection.cacheKey},content(1));assert.equal(selection.data,'该值是12.5。');assert.equal(calls.length,2);assert.match(calls[0].url,/translation.googleapis.com/);assert.match(calls[1].url,/api.example.test/);
   const repeat=await send({type:'selection',text:'The value is 12.5.',online:true,requestId:'engine-selection-repeat',engineKey:state.engines.selection.cacheKey},content(1));assert.equal(repeat.data,'该值是12.5。');assert.equal(calls.length,2,'selection cache avoids another API call');assert.ok(!JSON.stringify(local.data).includes(key));
  }finally{globalThis.fetch=original;}
 });
 await t.test('body off does not disable selection, but words off does',async()=>{
  await send({type:'control',action:'prefs',tabId:1,prefs:{enabled:false,words:true}});const state=(await send({type:'bootstrap'},content(1))).data;
  assert.equal((await send({type:'translate',text:'The value is 12.5.',online:true,requestId:'body-off-selection',engineKey:state.engines.body.cacheKey},content(1))).ok,false);
  assert.equal((await send({type:'selection',text:'The value is 12.5.',online:true,requestId:'selection-still-on',engineKey:state.engines.selection.cacheKey},content(1))).ok,true);
  await send({type:'control',action:'prefs',tabId:1,prefs:{words:false}});assert.equal((await send({type:'selection',text:'The value is 12.5.',online:true,requestId:'selection-off',engineKey:state.engines.selection.cacheKey},content(1))).ok,false);
  await send({type:'control',action:'prefs',tabId:1,prefs:{words:true,enabled:true,mode:'bilingual'}});
 });
 await t.test('stale cache namespaces cannot poison a newly selected body engine',async()=>{
  const old=(await send({type:'bootstrap'},content(1))).data.engines.body.cacheKey;const changed=configuration();changed.body='ai-api';await send({type:'engines:save',settings:changed},engineUI);
  assert.equal((await send({type:'store',op:'cacheSet',args:['The value is 12.5.','错误归属',old]},content(1))).data,null);
  const current=(await send({type:'bootstrap'},content(1))).data.engines.body.cacheKey;assert.equal((await send({type:'store',op:'cacheGet',args:['The value is 12.5.',current]},content(1))).data,'该值是12.5。');
  await send({type:'engines:save',settings:configuration()},engineUI);
 });
 await t.test('a host permission denial makes no provider request',async()=>{
  const contains=api.permissions.contains,original=globalThis.fetch;let calls=0;api.permissions.contains=async()=>false;globalThis.fetch=async()=>{calls++;throw Error('must not send');};
  try{const state=(await send({type:'bootstrap'},content(1))).data;const result=await send({type:'translate',text:'A new value.',online:true,requestId:'engine-host-denied',engineKey:state.engines.body.cacheKey},content(1));assert.equal(result.code,'ENGINE_CONFIG');assert.equal(calls,0);}finally{api.permissions.contains=contains;globalThis.fetch=original;}
 });
 await t.test('changing an engine while permission is pending prevents the old API call',async()=>{
  const contains=api.permissions.contains,original=globalThis.fetch;let entered,release,calls=0;const started=new Promise(r=>entered=r),gate=new Promise(r=>release=r);api.permissions.contains=async()=>{entered();return gate;};globalThis.fetch=async()=>{calls++;throw Error('must not send');};
  try{const state=(await send({type:'bootstrap'},content(1))).data;const pending=send({type:'translate',text:'A new value.',online:true,requestId:'engine-change-pending',engineKey:state.engines.body.cacheKey},content(1));await started;const next=configuration();next.body='ai-api';await send({type:'engines:save',settings:next},engineUI);release(true);assert.equal((await pending).code,'REQUEST_CANCELED');assert.equal(calls,0);}finally{release?.(true);api.permissions.contains=contains;globalThis.fetch=original;await send({type:'engines:save',settings:configuration()},engineUI);}
 });
 await t.test('turning body off during an engine permission check prevents the delayed request',async()=>{
  const contains=api.permissions.contains,original=globalThis.fetch;let entered,release,calls=0;const started=new Promise(r=>entered=r),gate=new Promise(r=>release=r);api.permissions.contains=async()=>{entered();return gate;};globalThis.fetch=async()=>{calls++;throw Error('must not send');};
  try{const state=(await send({type:'bootstrap'},content(1))).data;const pending=send({type:'translate',text:'A new value.',online:true,requestId:'body-off-pending',engineKey:state.engines.body.cacheKey},content(1));await started;await send({type:'control',action:'prefs',tabId:1,prefs:{enabled:false}});release(true);assert.equal((await pending).code,'REQUEST_CANCELED');assert.equal(calls,0);}finally{release?.(true);api.permissions.contains=contains;globalThis.fetch=original;}
 });
 await t.test('selection-only settings changes preserve an in-flight body request',async()=>{
  await send({type:'control',action:'prefs',tabId:1,prefs:{enabled:true,mode:'bilingual'}});const original=globalThis.fetch;let entered,release,requestSignal;const started=new Promise(r=>entered=r),gate=new Promise(r=>release=r);globalThis.fetch=async(_url,options)=>{requestSignal=options.signal;entered();return gate;};
  try{const state=(await send({type:'bootstrap'},content(1))).data;const pending=send({type:'translate',text:'Still 12.5.',online:true,requestId:'independent-body',engineKey:state.engines.body.cacheKey},content(1));await started;const next=configuration();next.selection='builtin';await send({type:'engines:save',settings:next},engineUI);assert.equal(requestSignal.aborted,false);release(Response.json({data:{translations:[{translatedText:'仍为12.5。'}]}}));assert.equal((await pending).data,'仍为12.5。');}finally{release?.(Response.json({}));globalThis.fetch=original;await send({type:'engines:save',settings:configuration()},engineUI);}
 });
 await t.test('body-only settings changes preserve an in-flight selection request',async()=>{
  const original=globalThis.fetch;let entered,release,requestSignal;const started=new Promise(r=>entered=r),gate=new Promise(r=>release=r);globalThis.fetch=async(_url,options)=>{requestSignal=options.signal;entered();return gate;};
  try{const state=(await send({type:'bootstrap'},content(1))).data;const pending=send({type:'selection',text:'Another value is 12.5.',online:true,requestId:'independent-selection',engineKey:state.engines.selection.cacheKey},content(1));await started;const next=configuration();next.body='builtin';await send({type:'engines:save',settings:next},engineUI);assert.equal(requestSignal.aborted,false);release(Response.json({choices:[{finish_reason:'stop',message:{content:'另一个值为12.5。'}}]}));assert.equal((await pending).data,'另一个值为12.5。');}finally{release?.(Response.json({}));globalThis.fetch=original;await send({type:'engines:save',settings:configuration()},engineUI);}
 });
 await t.test('explicit cancellation also stops a request still waiting for host permission',async()=>{
  const contains=api.permissions.contains,original=globalThis.fetch;let entered,release,calls=0;const started=new Promise(r=>entered=r),gate=new Promise(r=>release=r);api.permissions.contains=async()=>{entered();return gate;};globalThis.fetch=async()=>{calls++;throw Error('must not send');};
  try{const state=(await send({type:'bootstrap'},content(1))).data;const pending=send({type:'translate',text:'Cancel this 12.5 request.',online:true,requestId:'cancel-permission',engineKey:state.engines.body.cacheKey},content(1));await started;await send({type:'cancel',requestId:'cancel-permission'},content(1));release(true);assert.equal((await pending).code,'REQUEST_CANCELED');assert.equal(calls,0);}finally{release?.(true);api.permissions.contains=contains;globalThis.fetch=original;}
 });
 await t.test('explicit cancellation before the first storage read completes never reaches a provider',async()=>{
  const state=(await send({type:'bootstrap'},content(1))).data,read=local.get,original=globalThis.fetch;let entered,release,calls=0,held=false;const started=new Promise(r=>entered=r),gate=new Promise(r=>release=r);
  local.get=async key=>{if(key==='v3:policy'&&!held){held=true;entered();await gate;}return read(key);};globalThis.fetch=async()=>{calls++;throw Error('must not send');};
  try{const pending=send({type:'translate',text:'Cancel before storage 12.5.',online:true,requestId:'cancel-storage',engineKey:state.engines.body.cacheKey},content(1));await started;await send({type:'cancel',requestId:'cancel-storage'},content(1));release();assert.equal((await pending).code,'REQUEST_CANCELED');assert.equal(calls,0);}finally{release?.();local.get=read;globalThis.fetch=original;}
 });
 const removePermissions=change=>Promise.all(api.permissions.onRemoved.listeners.map(fn=>fn(change)));
 async function pair(label){
  await send({type:'control',action:'prefs',tabId:1,prefs:{enabled:true,words:true,mode:'bilingual'}});
  const state=(await send({type:'bootstrap'},content(1))).data,original=globalThis.fetch,calls=[];let entered;const started=new Promise(r=>entered=r);
  globalThis.fetch=(url,options)=>new Promise(release=>{calls.push({url,signal:options.signal,release});if(calls.length===2)entered();});
  const body=send({type:'translate',online:true,text:label+' body value is 12.5.',requestId:label+'-body',engineKey:state.engines.body.cacheKey},content(1));
  const selection=send({type:'selection',online:true,text:label+' selected value is 12.5.',requestId:label+'-selection',engineKey:state.engines.selection.cacheKey},content(1));
  await Promise.race([started,body.then(r=>{throw Error('Body ended before provider gate: '+r.error);}),selection.then(r=>{throw Error('Selection ended before provider gate: '+r.error);})]);return {body,selection,calls,finish(){for(const c of calls)c.release(c.url.includes('translation.googleapis')?Response.json({data:{translations:[{translatedText:'该值为12.5。'}]}}):Response.json({choices:[{finish_reason:'stop',message:{content:'该值为12.5。'}}]}));},restore(){globalThis.fetch=original;}};
 }
 await t.test('removing an unused API host preserves both in-flight translations',async()=>{
  const work=await pair('unused-host');try{await removePermissions({origins:['https://unused.example.test/*']});assert.ok(work.calls.every(c=>!c.signal.aborted));work.finish();assert.equal((await work.body).data,'该值为12.5。');assert.equal((await work.selection).data,'该值为12.5。');}finally{work.finish();await Promise.all([work.body,work.selection]);work.restore();}
 });
 await t.test('revoking only the body API cancels it, preserves selection, and permits a fresh retry after regrant',async()=>{
  const contains=api.permissions.contains;let denied=false;api.permissions.contains=async({origins})=>!(denied&&origins.includes('https://translation.googleapis.com/*'));
  const work=await pair('body-host');try{denied=true;await removePermissions({origins:['https://translation.googleapis.com/*']});assert.equal(work.calls.find(c=>c.url.includes('translation.googleapis')).signal.aborted,true);assert.equal(work.calls.find(c=>c.url.includes('api.example')).signal.aborted,false);work.finish();assert.equal((await work.body).code,'REQUEST_CANCELED');assert.equal((await work.selection).data,'该值为12.5。');
   const state=(await send({type:'bootstrap'},content(1))).data;const before=work.calls.length;const blocked=await send({type:'translate',online:true,text:'A denied value is 12.5.',requestId:'revoked-body-blocked',engineKey:state.engines.body.cacheKey},content(1));assert.equal(blocked.code,'ENGINE_CONFIG');assert.equal(work.calls.length,before);denied=false;globalThis.fetch=async()=>Response.json({data:{translations:[{translatedText:'恢复为12.5。'}]}});assert.equal((await send({type:'translate',online:true,text:'A restored value is 12.5.',requestId:'regranted-body',engineKey:state.engines.body.cacheKey},content(1))).data,'恢复为12.5。');
  }finally{work.finish();await Promise.all([work.body,work.selection]);work.restore();api.permissions.contains=contains;}
 });
 await t.test('revoking only the selected-text API leaves the body request running',async()=>{
  const work=await pair('selection-host');try{await removePermissions({origins:['https://api.example.test/*']});assert.equal(work.calls.find(c=>c.url.includes('translation.googleapis')).signal.aborted,false);assert.equal(work.calls.find(c=>c.url.includes('api.example')).signal.aborted,true);work.finish();assert.equal((await work.body).data,'该值为12.5。');assert.equal((await work.selection).code,'REQUEST_CANCELED');}finally{work.finish();await Promise.all([work.body,work.selection]);work.restore();}
 });
 await t.test('an unrelated revocation during the API permission check does not cancel the queued body request',async()=>{
  const state=(await send({type:'bootstrap'},content(1))).data,contains=api.permissions.contains,original=globalThis.fetch;let entered,release,calls=0;const started=new Promise(r=>entered=r),gate=new Promise(r=>release=r);api.permissions.contains=async()=>{entered();return gate;};globalThis.fetch=async()=>{calls++;return Response.json({data:{translations:[{translatedText:'该值为12.5。'}]}});};
  try{const pending=send({type:'translate',online:true,text:'Pending permission value is 12.5.',requestId:'unrelated-pending-permission',engineKey:state.engines.body.cacheKey},content(1));await started;await removePermissions({origins:['https://unused.example.test/*']});release(true);assert.equal((await pending).data,'该值为12.5。');assert.equal(calls,1);}finally{release?.(true);api.permissions.contains=contains;globalThis.fetch=original;}
 });
 for(const related of [true,false])await t.test((related?'related':'unrelated')+' API removal while vault read is pending is checked before fetch',async()=>{
  const state=(await send({type:'bootstrap'},content(1))).data,get=api.engineFixture.get,original=globalThis.fetch;let held=false,entered,release,calls=0;const started=new Promise(r=>entered=r),gate=new Promise(r=>release=r);
  api.engineFixture.get=async()=>{const value=await get();if(!held){held=true;entered();await gate;}return value;};globalThis.fetch=async()=>{calls++;return Response.json({data:{translations:[{translatedText:'该值为12.5。'}]}});};
  try{const pending=send({type:'translate',online:true,text:(related?'Related':'Unrelated')+' pending vault value is 12.5.',requestId:related?'related-vault':'unrelated-vault',engineKey:state.engines.body.cacheKey},content(1));await started;await removePermissions({origins:[related?'https://translation.googleapis.com/*':'https://unused.example.test/*']});release();const result=await pending;if(related){assert.equal(result.code,'REQUEST_CANCELED');assert.equal(calls,0);}else{assert.equal(result.data,'该值为12.5。');assert.equal(calls,1);}}finally{release?.();api.engineFixture.get=get;globalThis.fetch=original;}
 });
 await t.test('revoking the current website still cancels both requests and removes remembered access',async()=>{
  await send({type:'control',action:'enable',tabId:1,remember:true,prefs:{enabled:true,words:true,mode:'bilingual'}});const contains=api.permissions.contains;const work=await pair('website-host');
  try{api.permissions.contains=async({origins})=>!origins.includes('https://one.test/*');await removePermissions({origins:['https://one.test/*']});assert.ok(work.calls.every(c=>c.signal.aborted));work.finish();assert.equal((await work.body).code,'REQUEST_CANCELED');assert.equal((await work.selection).code,'REQUEST_CANCELED');assert.equal((await send({type:'bootstrap'},content(1))).data.authorized,false);}finally{work.finish();await Promise.all([work.body,work.selection]);work.restore();api.permissions.contains=contains;await send({type:'control',action:'enable',tabId:1,prefs:{enabled:true,words:true,mode:'bilingual'}});}
 });

});
