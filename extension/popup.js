import {getExtensionAPI} from './src/browser-api.js';
const chrome=getExtensionAPI();
document.querySelector('.version').textContent=chrome.runtime.getManifest().version;
const $=id=>document.getElementById(id);let tab=null,snapshot=null,busy=false,sequence=0,refreshPending=false,controlSequence=0,permissionSequence=0,refreshTabId=null,targetPending=true;
$('paused').disabled=true;
async function send(message){const r=await chrome.runtime.sendMessage(message);if(!r?.ok)throw Error(r?.error||'扩展后台未响应，请重新打开');return r.data;}
function render(s){snapshot=s;$('site').textContent=s.hostname||'当前页面';$('controls').disabled=!s.supported||busy||targetPending;$('paused').checked=s.paused===true;$('paused').disabled=busy||targetPending;$('enabled').checked=s.running===true;$('remember').checked=s.remembered===true;$('excluded').checked=s.excluded===true;
 $('engine-summary').textContent='Collins 原义与 Cloudflare AI 语境释义保留；正文：'+(s.engines?.body?.label||'Cloudflare AI')+'；选文：'+(s.engines?.selection?.label||'Cloudflare AI')+'。';
 for(const key of ['mode','words']){const e=$(key);if(key==='mode')e.value=s.prefs?.enabled?s.prefs.mode:'original';else e.checked=s.prefs?.[key]===true;e.disabled=!s.running||busy||targetPending;}
 $('settings').disabled=!s.running||busy||targetPending;$('authorization').textContent=s.remembered?'已记住此网站；取消授权将同时移除浏览器网站权限。':'仅在当前标签页临时工作。';
 $('status').textContent=s.reason||(s.paused?'已全局暂停':s.excluded?'此网站在排除列表中':s.sensitive?'敏感页面：需主动逐页启用':s.running?(s.prefs.enabled?s.status||'网页已连接':'网页已连接 · 正文翻译关闭 · '+(s.prefs.words?'查词开启，链接不跳转':'查词关闭，链接正常')):s.authorized?'已授权，但网页未连接':'尚未启用 · 不发送网页正文');if(s.error)throw Error(s.error);
}
async function refresh(){if(busy){refreshPending=true;return;}refreshPending=false;const seq=++sequence;try{
 const [active]=await chrome.tabs.query({active:true,currentWindow:true});if(seq!==sequence)return;if(!active)throw Error('没有当前标签页');
 refreshTabId=active.id;const s=await send({type:'control',action:'get',tabId:active.id});if(seq!==sequence)return;
 tab=active;targetPending=false;render(s);$('error').hidden=true;$('error').textContent='';
 }catch(e){if(seq!==sequence)return;$('error').hidden=false;$('error').textContent=e.message;}}
function targetKey(){return JSON.stringify([tab?.id,tab?.url,snapshot?.pattern,snapshot?.path]);}
async function control(action,extra={}){if(busy||targetPending||!tab)return false;const owner=++controlSequence,scope=targetKey();let completed=false;busy=true;sequence++;$('error').hidden=true;$('controls').disabled=true;$('paused').disabled=true;$('status').textContent='正在同步网页…';
 try{const s=await send({type:'control',action,tabId:tab.id,...extra});busy=false;if(!targetPending){render(s);completed=true;}}catch(e){busy=false;const recoverySequence=sequence+1;await refresh();if(sequence===recoverySequence&&scope===targetKey()){$('error').hidden=false;$('error').textContent=e.message;}}finally{
 // Recovery can outlive a newer control; only its owner may unlock the toolbar.
 if(owner===controlSequence){busy=false;$('controls').disabled=!snapshot?.supported||targetPending;$('paused').disabled=targetPending;if(refreshPending)void refresh();}}return completed&&!targetPending&&scope===targetKey();}
async function requestSitePermission(input){
 if(busy||targetPending||!tab||!snapshot)return false;const seq=sequence,intent=permissionSequence;
 try{
  // Call directly in the user gesture, before any await; bind its result to this view.
  const allowed=await chrome.permissions.request({origins:[snapshot.pattern]});
  if(seq!==sequence||intent!==permissionSequence)return false;if(!allowed)throw Error('网站授权未获允许');return true;
 }catch(error){if(seq===sequence&&intent===permissionSequence){input.checked=false;$('error').hidden=false;$('error').textContent=error.message;}return false;}
}
$('enabled').onchange=async e=>{
 permissionSequence++;const enabled=e.target.checked,remember=$('remember').checked;
 if(enabled&&remember&&!await requestSitePermission(e.target))return;
 await control(enabled?'enable':'disable',{remember:enabled&&remember});
};
$('remember').onchange=async e=>{
 permissionSequence++;if(!e.target.checked&&snapshot)$('enabled').checked=snapshot.running===true;
 if(!snapshot?.running)return;
 if(e.target.checked){if(!await requestSitePermission(e.target))return;await control('enable',{remember:true,prefs:snapshot.prefs});}
 else if(snapshot.remembered)await control('forget');
};
$('mode').onchange=e=>void control('prefs',{prefs:{mode:e.target.value,enabled:true}});
for(const key of ['words'])$(key).onchange=e=>void control('prefs',{prefs:{[key]:e.target.checked}});
$('settings').onclick=async()=>{if(await control('settings'))window.close();};
$('paused').onchange=e=>void control('pause',{value:e.target.checked});$('excluded').onchange=e=>void control('exclude',{value:e.target.checked});$('revoke').onclick=()=>void control('revoke');
$('vocabulary').onclick=()=>chrome.tabs.create({url:chrome.runtime.getURL('vocabulary.html')});
 $('engines').onclick=()=>chrome.tabs.create({url:chrome.runtime.getURL('engines.html')});
function refreshTarget(){targetPending=true;$('controls').disabled=true;$('paused').disabled=true;$('site').textContent='正在读取网站…';$('status').textContent='正在读取当前网页…';$('error').hidden=true;$('error').textContent='';void refresh();}
chrome.tabs.onActivated.addListener(refreshTarget);
// Include navigation of the queried active tab, even before its first state arrives.
chrome.tabs.onUpdated.addListener((id,change)=>{if(id===refreshTabId&&(typeof change.url==='string'||change.status==='loading'||change.status==='complete'))refreshTarget();});
function currentTabGrantChanged(change){
 // Keep refreshing while the target or a failed read is unresolved. Missing or
 // malformed change maps cannot prove that the current grant stayed the same.
 if(targetPending||!snapshot||!Number.isInteger(tab?.id)||!$('error').hidden)return true;
 const before=change?.oldValue,after=change?.newValue;
 if(!before||!after||typeof before!=='object'||typeof after!=='object'||Array.isArray(before)||Array.isArray(after))return true;
 // Unknown schema fields are not a confirmed tab-ID map.
 if([before,after].some(map=>Object.keys(map).some(key=>!/^(?:0|[1-9]\d*)$/.test(key))))return true;
 return JSON.stringify(before[tab.id])!==JSON.stringify(after[tab.id]);
}
function currentPolicyChanged(change){
 if(targetPending||!snapshot||!Number.isInteger(tab?.id)||!$('error').hidden)return true;
 let origin;try{const url=new URL(tab.url);if(!['http:','https:'].includes(url.protocol))return true;origin=url.origin;}catch{return true;}
 const before=change?.oldValue,after=change?.newValue,record=value=>value&&typeof value==='object'&&!Array.isArray(value);
 if(!record(before)||!record(after)||before.schema!==3||after.schema!==3||!record(before.sites)||!record(after.sites))return true;
 // Unknown root fields may affect every site. Keep their events conservative.
 const known=['schema','paused','collinsSession','sites'];if([before,after].some(policy=>Object.keys(policy).some(key=>!known.includes(key))))return true;
 if(before.paused!==after.paused||before.collinsSession!==after.collinsSession)return true;
 try{return JSON.stringify(before.sites[origin])!==JSON.stringify(after.sites[origin]);}catch{return true;}
}
// Match the same storage areas read by extensionState: persistent policy/prefs
// are local, while temporary tab grants are session-only.
chrome.storage.onChanged.addListener((changes,area)=>{const keys=area==='local'?['v3:policy','v2:prefs']:area==='session'?['v3:tabs']:[];if(keys.some(key=>Object.hasOwn(changes,key)&&(key==='v3:tabs'?currentTabGrantChanged(changes[key]):key==='v3:policy'?currentPolicyChanged(changes[key]):true)))void refresh();});
await refresh();

