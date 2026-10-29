import {pageInfo} from '../src/protocol.js';

export const PAUSE_KEY='click-context:v1:paused';
export const sitePolicyKey=origin=>'click-context:v1:site-policy:'+origin;

// Explicit site opt-in restores saved reading preferences on later visits.
// Existing preference/vocabulary keys remain unchanged.
export function createSitePolicy({getValue,setValue,url,timeoutMs=3000}){
 const info=pageInfo(url),key=sitePolicyKey(info.origin);
 let state={remember:false,excluded:false,paused:false},failure=null,queue=Promise.resolve(),pendingBlocks=0;
 const view=()=>({...state,sensitive:info.sensitive===true,blocked:Boolean(failure||pendingBlocks||state.excluded||state.paused),message:failure?'网站设置无法读取，请重试':pendingBlocks?'正在暂停阅读':state.paused?'已暂停所有网站':state.excluded?'已排除此网站':''});
 async function read(){
  let timer;
  try{
   const [site,paused]=await Promise.race([Promise.all([getValue(key,null),getValue(PAUSE_KEY,false)]),new Promise((_resolve,reject)=>timer=setTimeout(()=>reject(Error('网站设置读取超时')),timeoutMs))]);
   state={remember:site?.remember===true,excluded:site?.excluded===true,paused:paused===true};failure=null;return view();
  }catch(error){failure=error;throw error;}finally{clearTimeout(timer);}
 }
 function change(name,value){
  if(!['remember','excluded','paused'].includes(name))return Promise.reject(Error('未知网站设置'));
  const restricting=name!=='remember'&&value===true;if(restricting)pendingBlocks++;
  const job=queue.catch(()=>{}).then(async()=>{
   await read();
   // Do not race writes against a timeout: a late write may still succeed.
   if(name==='paused')await setValue(PAUSE_KEY,value===true);
   else await setValue(key,{remember:state.remember,excluded:state.excluded,[name]:value===true});
   state={...state,[name]:value===true};
  }).catch(error=>{failure=error;throw error;}).finally(()=>{if(restricting)pendingBlocks--;});queue=job;return job.then(view);
 }
 function initialPrefs(prefs){return !view().blocked&&state.remember&&!info.sensitive?prefs:{...prefs,words:false,enabled:false,mode:'original'};}
 return {read,change,initialPrefs,get state(){return view();},keys:[PAUSE_KEY,key]};
}

export function mountSiteControls({reader,policy,savePrefs,onPolicyChange,addListener,removeListener}){
 const shadow=reader.shadow,section=document.createElement('details');
 section.className='site-controls';section.innerHTML='<summary>网站设置</summary><label><input id="remember-site" type="checkbox"> 记住此网站设置</label><label><input id="exclude-site" type="checkbox"> 排除此网站</label><label><input id="pause-sites" type="checkbox"> 暂停所有网站</label><p id="site-status" class="muted" role="status"></p>';
 shadow.querySelector('.panel .row').before(section);
 const inputs={remember:section.querySelector('#remember-site'),excluded:section.querySelector('#exclude-site'),paused:section.querySelector('#pause-sites')},status=section.querySelector('#site-status');
 const reading=[...shadow.querySelectorAll('#words,#bilingual-enabled,#mode,#translation-unit,#retry-all')];
 let stopped=false,sequence=0,serial=Promise.resolve(),listenerSession=null;const listenerIds=[];
 function render(){const state=policy.state;for(const [name,input]of Object.entries(inputs))input.checked=state[name];for(const input of reading)input.disabled=state.blocked;status.textContent=state.message||'按网站保存阅读模式、双语对照和查词设置。';}
 async function sync(){if(stopped)return;const id=++sequence;try{await policy.read();}catch{}if(stopped||id!==sequence)return;await onPolicyChange(policy.state);if(!stopped&&id===sequence)render();}
 for(const [name,input]of Object.entries(inputs))input.onchange=()=>{
  const checked=input.checked;for(const item of Object.values(inputs))item.disabled=true;
  serial=serial.catch(()=>{}).then(async()=>{
   if(stopped)return;
   try{if(name==='remember'&&checked)await savePrefs(reader.preferences);const pending=policy.change(name,checked);void pending.catch(()=>{});if(!stopped)await onPolicyChange(policy.state);await pending;if(!stopped)await onPolicyChange(policy.state);if(!stopped)render();}
   catch(error){if(!stopped){await onPolicyChange(policy.state);render();status.textContent=error.message;}}
   finally{if(!stopped)for(const item of Object.values(inputs))item.disabled=false;}
  });
 };
 const visibility=()=>{if(document.visibilityState==='visible')void sync();};
 window.addEventListener('focus',sync);document.addEventListener('visibilitychange',visibility);
 function start(){
  if(listenerSession)return;stopped=false;const token={};listenerSession=token;
  if(typeof addListener==='function'&&typeof removeListener==='function')for(const key of policy.keys)try{
   Promise.resolve(addListener(key,(changed,_old,_next,remote)=>{if(listenerSession===token&&changed===key&&remote===true)void sync();})).then(id=>{if(id==null)return;if(listenerSession!==token)void Promise.resolve(removeListener(id)).catch(()=>{});else listenerIds.push(id);},()=>{});
  }catch{}
 }
 function stop(){stopped=true;listenerSession=null;sequence++;for(const id of listenerIds.splice(0))try{void Promise.resolve(removeListener(id)).catch(()=>{});}catch{}}
 start();render();
 return {sync,start,stop,destroy(){stop();window.removeEventListener('focus',sync);document.removeEventListener('visibilitychange',visibility);section.remove();}};
}
