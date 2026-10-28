import {resolveContext} from './src/context-meaning.js';
import {translate} from './src/core.js';
import {createDictionaryLookup} from './dictionary-lookup.js';
import {cacheWordLookup} from './src/dictionary-cache.js';
import {createStore} from './src/storage.js';
import {BACKUP_FILE_LIMIT} from './src/vocabulary-data.js';
import {extensionState} from './src/extension-state.js';
import {pageInfo,validRequest} from './src/protocol.js';
import {getExtensionAPI} from './src/browser-api.js';
import {createEngineVault} from './src/engine-vault.js';
import {publicEngineSettings,engineSettingsForUI} from './src/engine-profiles.js';
import {executeEngineTranslation} from './src/engine-executor.js';
import {TRANSLATION_ENDPOINT} from './src/translation-service.js';
import {CLIENT_TRANSLATION_CACHE_VERSION} from './src/translation-client-validation.js';
import {createPermissionRevocations} from './src/permission-revocations.js';
const chrome=getExtensionAPI();
if(!chrome.storage.session)throw Error('当前浏览器不支持会话存储，请升级浏览器');
const lookupCollins=cacheWordLookup(createDictionaryLookup(chrome),{storage:chrome.storage.session});
const state=extensionState(chrome.storage.local,chrome.storage.session);
const engines=createEngineVault();const permissionRevocations=createPermissionRevocations();const engineEpoch={body:0,selection:0};
async function snapshot(tab){return {...await state.get(tab),engines:publicEngineSettings(await engines.read())};}
function cancelEngineJobs(scope){for(const item of jobs.values())if(scope?item.type===(scope==='body'?'translate':'selection'):['translate','selection'].includes(item.type))item.controller.abort();}
function changedEngine(){return Object.assign(Error('翻译引擎已变化，请重新翻译'),{code:'ENGINE_CHANGED',retryable:false});}
async function engineFor(scope,expected,job){
 const epoch=engineEpoch[scope],settings=await engines.read(),selected=publicEngineSettings(settings)[scope];
 if((expected??CLIENT_TRANSLATION_CACHE_VERSION)!==selected.cacheKey)throw changedEngine();
 const profile=settings.profiles.find(p=>p.id===selected.id);
 job.engineURL=profile?.endpoint||TRANSLATION_ENDPOINT;if(permissionRevocations.affectsSince(job.permissionRevision,job.engineURL)){job.controller.abort();throw changedEngine();}
 if(profile){const url=new URL(profile.endpoint),pattern=url.protocol+'//'+url.hostname+'/*';let allowed=false;try{allowed=await chrome.permissions.contains({origins:[pattern]});}catch{/* Do not expose host/API details through browser errors. */}if(!allowed)throw Object.assign(Error('请在引擎设置中授权此 API 主机'),{code:'ENGINE_CONFIG',retryable:false});}
 if(epoch!==engineEpoch[scope])throw changedEngine();return {scope,profile,epoch,cacheKey:selected.cacheKey};
}
const store=createStore({get:async key=>(await chrome.storage.local.get('v2:'+key))['v2:'+key],set:(key,value)=>chrome.storage.local.set({['v2:'+key]:value})});
const jobs=new Map(),buckets=new Map();
function cancelTab(id,type){for(const [key,item] of jobs)if(item.tabId===id&&(!type||item.type===type)){item.controller.abort();jobs.delete(key);}}
function cancelChanged(id,before,after){if(before.online!==after.online){cancelTab(id);return;}if(before.mode!==after.mode||before.enabled!==after.enabled)cancelTab(id,'translate');if(before.words&&!after.words){cancelTab(id,'lookup');cancelTab(id,'context');cancelTab(id,'selection');}}
async function tabFor(sender){return {id:sender.tab.id,url:sender.url||sender.tab.url};}
async function registered(){
 const {policy}=await state.read();const scripts=await chrome.scripting.getRegisteredContentScripts();
 const wanted=[];for(const [origin,site] of Object.entries(policy.sites))if(site.allowed&&!site.excluded&&await chrome.permissions.contains({origins:[origin+'/*']}))wanted.push(origin+'/*');
 // One registration owned by Closeread. Serial reconciliation prevents duplicate IDs.
 if(scripts.some(s=>s.id==='lextide-sites'))await chrome.scripting.unregisterContentScripts({ids:['lextide-sites']});
 if(wanted.length)await chrome.scripting.registerContentScripts([{id:'lextide-sites',matches:wanted,js:['content.js'],runAt:'document_idle',persistAcrossSessions:true}]);
}
let registration=Promise.resolve();function reconcile(){registration=registration.catch(()=>{}).then(registered);return registration;}
async function sync(tab,inject=false){
 const current=await snapshot(tab);if(!current.authorized)cancelTab(tab.id);
 try{return {...current,...await chrome.tabs.sendMessage(tab.id,{type:'reader:sync',state:current},{frameId:0})};}
 catch(e){if(!current.authorized)return {...current,running:false};if(!inject)return {...current,running:false,error:'网页尚未连接，请重新启用或刷新'};
  await chrome.scripting.executeScript({target:{tabId:tab.id},files:['content.js']});
  // content.js returns its bootstrap promise; executeScript resolves after imports and mount.
  const ack=await chrome.tabs.sendMessage(tab.id,{type:'reader:sync',state:current},{frameId:0});return {...current,...ack};
 }
}
async function broadcast(){const tabs=await chrome.tabs.query({});for(const tab of tabs){if(tab.url)await sync(tab).catch(()=>{});}}
async function handle(m,sender){
 const query=sender.id===chrome.runtime.id&&sender.tab&&sender.frameId===0&&pageInfo(sender.url).supported&&['lookup','translate','context','selection'].includes(m?.type)&&validRequest(m);
 if(!query)return handleMessage(m,sender);
 const id=sender.tab.id,key=id+':'+m.requestId;if(jobs.has(key))throw Error('重复请求');
 const now=Date.now(),bucket=buckets.get(id)||{at:now,count:0};if(now-bucket.at>60000){bucket.at=now;bucket.count=0;}buckets.set(id,bucket);
 if(++bucket.count>90||jobs.size>=12||[...jobs.values()].filter(j=>j.tabId===id).length>=3)throw Error('请求过多，请稍后重试');
 // Register before storage/permission awaits so cancel/off/navigation also stop
 // queued requests which have not contacted a provider yet.
 const controller=new AbortController(),job={tabId:id,type:m.type,controller,pageURL:sender.url,permissionRevision:permissionRevocations.revision};jobs.set(key,job);
 try{return await handleMessage(m,sender,controller,job);}
 catch(error){if(controller.signal.aborted)throw Object.assign(Error('请求已取消'),{code:'REQUEST_CANCELED',retryable:false});throw error;}
 finally{if(jobs.get(key)?.controller===controller)jobs.delete(key);}
}
async function handleMessage(m,sender,controller,job){
 if(sender.id!==chrome.runtime.id||!m||typeof m!=='object')throw Error('无效消息来源');
 const ui=['popup.html','vocabulary.html'].some(p=>sender.url===chrome.runtime.getURL(p));
 const engineUI=sender.url===chrome.runtime.getURL('engines.html');
 const content=!ui&&sender.tab&&sender.frameId===0&&pageInfo(sender.url).supported;
 if(!ui&&!content&&!engineUI)throw Error('不支持此消息来源');
 if(m.type?.startsWith('engines:')){
  if(!engineUI)throw Error('请通过扩展引擎设置管理 API');
  if(m.type==='engines:get')return engineSettingsForUI(await engines.read());
  if(m.type==='engines:save'){
   const saved=await engines.save(m.settings,{onCommit:(after,before)=>{const old=publicEngineSettings(before),next=publicEngineSettings(after);for(const scope of ['body','selection'])if(old[scope].cacheKey!==next[scope].cacheKey){engineEpoch[scope]++;cancelEngineJobs(scope);}}});await broadcast();return engineSettingsForUI(saved);
  }
  if(m.type==='engines:test'){
   const settings=await engines.read(),profile=settings.profiles.find(p=>p.id===m.id);
   if(m.id!=='builtin'&&!profile)throw Error('请先保存此引擎配置');
   if(profile){const u=new URL(profile.endpoint);if(!await chrome.permissions.contains({origins:[u.protocol+'//'+u.hostname+'/*']}))throw Error('请先授权此 API 主机');}
   const started=Date.now(),text='The value is 12.5.';
   const translated=profile?await executeEngineTranslation(profile,text):await translate(text);
   return {text:translated,elapsedMs:Date.now()-started,label:profile?.label||'Cloudflare AI'};
  }
  throw Error('未知引擎操作');
 }
 if(engineUI)throw Error('此设置页面不支持此操作');
 if(m.type==='open-engines'&&ui){await chrome.tabs.create({url:chrome.runtime.getURL('engines.html')});return null;}
 if(m.type==='control'){
  if(!ui||!Number.isInteger(m.tabId))throw Error('无效标签页');const tab=await chrome.tabs.get(m.tabId);
  if(m.action==='collins-session'&&(sender.url!==chrome.runtime.getURL('popup.html')||typeof m.value!=='boolean'))throw Error('请通过工具栏设置 Collins 会话');
  if(m.action==='get')return sync(tab);
  if(m.action==='settings'){const s=await sync(tab,true);if(!s.running)throw Error('请先启用网站');await chrome.tabs.sendMessage(tab.id,{type:'reader:settings'},{frameId:0});return s;}
  if(!['enable','disable','prefs','exclude','revoke','forget','pause','collins-session'].includes(m.action))throw Error('未知操作');
  if(m.remember&&!await chrome.permissions.contains({origins:[pageInfo(tab.url).pattern]}))throw Error('尚未授权此网站');
  const before=await state.get(tab),after=await state.change(tab,m.action,m);if(m.action==='collins-session')for(const item of jobs.values())if(item.type==='lookup')item.controller.abort();if(m.action==='prefs')cancelChanged(tab.id,before.prefs,after.prefs);else if(['disable','revoke','exclude','pause'].includes(m.action))cancelTab(tab.id);if(m.action==='pause'&&m.value)for(const item of jobs.values())item.controller.abort();
  if(['enable','revoke','exclude','forget'].includes(m.action))await reconcile();
  if(['revoke','exclude','forget'].includes(m.action))await chrome.permissions.remove({origins:[pageInfo(tab.url).pattern]});
  await broadcast();return sync(tab,m.action==='enable'||m.action==='prefs');
 }
 let current,tab;if(content){tab=await tabFor(sender);current=await state.get(tab);}
 if(m.type==='bootstrap')return {...current,engines:publicEngineSettings(await engines.read())};
 if(m.type==='cancel'){jobs.get(sender.tab.id+':'+m.requestId)?.controller.abort();return null;}
 if(content&&!current.authorized)throw Error('此网站未授权或扩展已暂停');
 if(m.type==='open-engines'&&content){await chrome.tabs.create({url:chrome.runtime.getURL('engines.html')});return null;}
 if(m.type==='open-controls'&&content){if(!chrome.action?.openPopup)throw Error('请点击浏览器工具栏中的语境精读图标，开启此网站联网查询。');await chrome.action.openPopup({windowId:sender.tab.windowId});return null;}
 if(m.type==='open-vocabulary'&&content){await chrome.tabs.create({url:chrome.runtime.getURL('vocabulary.html')});return null;}
 if(m.type==='store'){
  const allowed=ui?['words','removeWord','updateWord','vocabularyDrafts','saveVocabularyDraft','removeVocabularyDraft','importWords']:['prefs','savePrefs','words','saveWord','removeWord','cacheGet','cacheSet','clearCache'];
  if(!allowed.includes(m.op)||!Array.isArray(m.args))throw Error('无效存储请求');
  const payload=JSON.stringify(m.args),importing=ui&&m.op==='importWords',limit=importing?BACKUP_FILE_LIMIT+2:50000;
  if(payload.length>limit||importing&&new TextEncoder().encode(payload).byteLength>limit)throw Error('无效存储请求');
  if(m.op==='prefs')return current.prefs;
  if(['cacheGet','cacheSet'].includes(m.op)){
   const selected=publicEngineSettings(await engines.read()).body;
   const namespace=(m.op==='cacheGet'?m.args[1]:m.args[2])??CLIENT_TRANSLATION_CACHE_VERSION;
   if(namespace!==selected.cacheKey)return null;
   return m.op==='cacheGet'?store.cacheGet(m.args[0],namespace):store.cacheSet(m.args[0],m.args[1],namespace);
  }
  if(m.op==='savePrefs'){const after=await state.change(tab,'prefs',{prefs:m.args[0]});cancelChanged(tab.id,current.prefs,after.prefs);return null;}
  if(m.op==='saveWord'){const e=m.args[0];if(!e||typeof e.word!=='string'||typeof e.lemma!=='string'||!/^[a-z]+(?:['-][a-z]+)*(?: [a-z]+(?:['-][a-z]+)*){0,3}$/.test(e.lemma)||e.lemma.length>80)throw Error('无效单词');e.source=pageInfo(sender.url).origin;}
  return store[m.op](...m.args);
 }
 if(!content||!['lookup','translate','context','selection'].includes(m.type)||!validRequest(m))throw Error('无效查询');
 const online=current.prefs.online===true&&m.online===true;
 if(m.type==='translate'&&(!current.prefs.enabled||current.prefs.mode==='original'))throw Error('正文双语翻译已关闭');
 if(m.type==='translate'&&!online)throw Error('此网站未允许联网翻译');
 if(['lookup','context','selection'].includes(m.type)&&!current.prefs.words)throw Error('点词查义已关闭');
 if(m.type==='selection'&&!online)throw Error('此网站未允许联网翻译');
 if(!controller)throw Error('无效查询');controller.signal.throwIfAborted();
 const engine=['translate','selection'].includes(m.type)?await engineFor(m.type==='selection'?'selection':'body',m.engineKey,job):null;
 controller.signal.throwIfAborted();
  if(engine&&engine.epoch!==engineEpoch[engine.scope])throw changedEngine();
  if(m.type==='selection'){
   let cached;try{cached=await store.cacheGet(m.text,engine.cacheKey);}catch{/* Optional cache failure must not hide a usable service. */}
   controller.signal.throwIfAborted();if(engine.epoch!==engineEpoch[engine.scope])throw changedEngine();if(typeof cached==='string')return cached;
  }
  const value=m.type==='lookup'?await lookupCollins(m.text,{online,signal:controller.signal}):m.type==='context'?await resolveContext(m.context,{signal:controller.signal}):engine?.profile?await executeEngineTranslation(engine.profile,m.text,{signal:controller.signal}):await translate(m.text,fetch,{signal:controller.signal});
  controller.signal.throwIfAborted();
  if(m.type==='selection'&&engine.epoch===engineEpoch[engine.scope])try{await store.cacheSet(m.text,value,engine.cacheKey);}catch{/* Translation remains usable without persistence. */}
  return value;
}
chrome.runtime.onMessage.addListener((m,sender,respond)=>{if(m?.type==='lextide:parse-html'||m?.type?.startsWith('reader:'))return;handle(m,sender).then(data=>respond({ok:true,data}),e=>respond({ok:false,error:e.message,code:e.code,sourceUrls:e.sourceUrls,retryable:e.retryable===true}));return true;});
chrome.tabs.onRemoved.addListener(id=>{cancelTab(id);buckets.delete(id);void state.removeTab(id);});
chrome.tabs.onUpdated.addListener((id,change,tab)=>{if(change.status==='loading'){cancelTab(id);void state.read().then(({tabs})=>{if(tabs[id]&&pageInfo(tab.url).origin!==tabs[id].origin)return state.removeTab(id);}).catch(()=>{});}if(change.status==='complete')void state.get(tab).then(s=>{if(s.authorized)return sync(tab,true);return sync(tab);}).catch(()=>{});});
chrome.permissions.onRemoved.addListener(change=>{const removal=permissionRevocations.record(change);for(const job of jobs.values())if(removal.affects(job.pageURL)||job.engineURL&&removal.affects(job.engineURL))job.controller.abort();return (async()=>{const {policy}=await state.read();for(const origin of Object.keys(policy.sites))if(policy.sites[origin].allowed&&!await chrome.permissions.contains({origins:[origin+'/*']})){const tab={id:-1,url:origin};await state.change(tab,'revoke');}await reconcile();await broadcast();})().catch(console.error);});
chrome.runtime.onInstalled.addListener(()=>{void reconcile().catch(console.error);});

