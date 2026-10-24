import {mountReader} from '../src/reader.js';
import {remoteStore} from '../src/storage.js';
import {getExtensionAPI} from '../src/browser-api.js';
import {createRuntimeConnection,showReloadNotice} from '../src/extension-connection.js';
const chrome=getExtensionAPI();
// Bundled into one isolated-world IIFE; no web-accessible modules or page CSP dependency.
globalThis.__lextideBootstrap ||= (async()=>{
 let reader=null,serial=Promise.resolve(),watcher=null,listener=null;
 const connection=createRuntimeConnection(chrome,{onInvalidated:()=>{
  clearInterval(watcher);
  try{if(listener)chrome.runtime.onMessage.removeListener?.(listener);}catch{}
  try{reader?.destroy();}finally{reader=null;showReloadNotice();}
 }});
 async function send(message){const response=await connection.send(message);if(!response?.ok){const e=Error(response?.error||'扩展连接已断开，请刷新网页');e.retryable=response?.retryable;e.code=response?.code;e.sourceUrls=response?.sourceUrls;throw e;}return response.data;}
 async function apply(snapshot){
  if(!connection.check())return {running:false};
  if(!snapshot?.authorized){reader?.destroy();reader=null;return {running:false};}
  if(!reader){
   const store=remoteStore((op,args)=>send({type:'store',op,args}));
   reader=mountReader({store,engines:snapshot.engines,schedulerOptions:{quietOffline:true},onOpenVocabulary:()=>send({type:'open-vocabulary'}),onOpenEngines:()=>send({type:'open-engines'}),transport:async(type,text,online,{signal,context,engineKey}={})=>{const requestId=crypto.randomUUID();signal?.throwIfAborted();const cancel=()=>{void connection.send({type:'cancel',requestId}).catch(()=>{});};signal?.addEventListener('abort',cancel,{once:true});try{return await send({type,text,online,requestId,context,engineKey});}finally{signal?.removeEventListener('abort',cancel);}}});await reader.ready;
   if(!reader||!connection.check())return {running:false};
  }
  await reader.configureEngines(snapshot.engines);await reader.configure(snapshot.prefs);if(!reader||!connection.check())return {running:false};return {running:true,prefs:reader.preferences,status:reader.shadow.querySelector('#status').textContent};
 }
 listener=(m,sender,respond)=>{
  if(!connection.check()||sender.id!==chrome.runtime.id||sender.tab)return;
  if(m.type==='reader:settings'){reader?.openSettings();respond({running:!!reader});return;}
  if(m.type!=='reader:sync')return;
  const reply=data=>{if(!connection.check())return;try{respond(data);}catch(error){connection.error(error);}};
  serial=serial.catch(()=>{}).then(()=>apply(m.state));serial.then(reply,e=>reply({running:false,error:e.message}));return true;
 };
 try{
  chrome.runtime.onMessage.addListener(listener);
  // Probe runtime identity locally; this timer sends no network or extension messages.
  let url=location.href;watcher=setInterval(()=>{if(!connection.check())return;if(location.href!==url){url=location.href;serial=serial.catch(()=>{}).then(async()=>apply(await send({type:'bootstrap'}))).catch(()=>{reader?.destroy();reader=null;});}},750);
  serial=serial.then(async()=>apply(await send({type:'bootstrap'})));await serial;
 }catch(reason){clearInterval(watcher);const error=connection.error(reason);if(!connection.expired){try{chrome.runtime.onMessage.removeListener?.(listener);}catch{}reader?.destroy();reader=null;throw error;}}
})().catch(error=>{globalThis.__lextideBootstrap=null;throw error;});
