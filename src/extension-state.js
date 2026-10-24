import {DEFAULT_PREFS} from './storage.js';
import {cleanPrefs,pageInfo} from './protocol.js';
/** Persistent origin policy is separate from session-only tab grants. No v2 data is deleted. */
export function extensionState(local,session){
 let queue=Promise.resolve();
 const serial=fn=>{const task=queue.then(fn);queue=task.catch(()=>{});return task;};
 const read=async()=>({policy:(await local.get('v3:policy'))['v3:policy']||{schema:3,paused:false,sites:{}},tabs:(await session.get('v3:tabs'))['v3:tabs']||{}});
 async function base(){const old=(await local.get('v2:prefs'))['v2:prefs']||{};return {...DEFAULT_PREFS,...cleanPrefs(old),online:false,enabled:false};}
 async function get(tab){const info=pageInfo(tab.url),{policy,tabs}=await read();if(!info.supported)return {...info,tabId:tab.id,paused:policy.paused,collinsSession:policy.collinsSession===true};const site=policy.sites[info.origin]||{},temporary=tabs[tab.id]?.origin===info.origin?tabs[tab.id]:null;
 const sensitive=info.sensitive&&temporary?.path!==info.path;
 const authorized=!policy.paused&&!site.excluded&&!sensitive&&(temporary?temporary.allowed===true:site.allowed===true);
 return {...info,tabId:tab.id,paused:policy.paused,collinsSession:policy.collinsSession===true,excluded:site.excluded===true,remembered:site.allowed===true,authorized,sensitive,prefs:{...await base(),...cleanPrefs(site.prefs),...cleanPrefs(temporary?.prefs),online:authorized}};
 }
 async function change(tab,action,{prefs={},remember=false,value=false}={}){return serial(async()=>{
  const info=pageInfo(tab.url);if(!info.supported&&!['pause','collins-session'].includes(action))throw Error(info.reason);
  const {policy,tabs}=await read(),site=policy.sites[info.origin]||{};
  if(action==='collins-session')policy.collinsSession=value===true;
  else if(action==='pause')policy.paused=value===true;
  else if(action==='enable'){
   if(policy.paused)throw Error('请先取消全局暂停');if(site.excluded)throw Error('请先移出排除列表');
   if(remember){site.allowed=true;site.prefs={...await base(),...site.prefs,...cleanPrefs(prefs)};policy.sites[info.origin]=site;}
   const previous=tabs[tab.id]?.origin===info.origin?tabs[tab.id].prefs:{};
   tabs[tab.id]={origin:info.origin,path:info.sensitive?info.path:null,allowed:true,prefs:{...await base(),...site.prefs,...previous,...cleanPrefs(prefs)}};
  }else if(action==='disable'){tabs[tab.id]={...tabs[tab.id],origin:info.origin,allowed:false};}
  else if(action==='prefs'){
   const current=await get(tab);if(!current.authorized)throw Error('请先启用当前网站');
   if(site.allowed){site.prefs={...current.prefs,...cleanPrefs(prefs)};policy.sites[info.origin]=site;}
   tabs[tab.id]={...tabs[tab.id],origin:info.origin,allowed:true,prefs:{...current.prefs,...cleanPrefs(prefs)}};
  }else if(action==='forget'){
   const current=await get(tab);site.allowed=false;site.prefs={...site.prefs,online:false};policy.sites[info.origin]=site;
   if(current.authorized)tabs[tab.id]={origin:info.origin,path:info.sensitive?info.path:null,allowed:true,prefs:current.prefs};
  }else if(action==='revoke'||action==='exclude'){
   site.allowed=false;if(action==='exclude')site.excluded=value===true;site.prefs={...site.prefs,online:false};policy.sites[info.origin]=site;
   for(const [id,t] of Object.entries(tabs))if(t.origin===info.origin)delete tabs[id];
  }else throw Error('未知控制操作');
  await local.set({'v3:policy':policy});await session.set({'v3:tabs':tabs});return get(tab);
 });}
 return {get,change,read,removeTab:id=>serial(async()=>{const {tabs}=await read();delete tabs[id];await session.set({'v3:tabs':tabs});})};
}
