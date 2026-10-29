import {createEngineRepository} from '../src/engine-vault.js';
import {executeEngineTranslation,executeEngineContext} from '../src/engine-executor.js';
import {createContextClient,CONTEXT_CURRENT_REVISION} from '../src/context-meaning.js';
import {webTranslationEngine,publicEngineSettings,DEFAULT_ENGINE_SETTINGS,normalizeEngineSettings,engineSettingsForUI} from '../src/engine-profiles.js';
import {createWebTranslator} from '../src/web-translators.js';
import {createGMFetch} from './gm-adapter.js';
export function supportsSafeAPIRedirect(info){
 if(info?.scriptHandler!=='Tampermonkey'||typeof info.version!=='string')return false;
 const parts=info.version.split('.').map(Number);
 return parts[0]>5||parts[0]===5&&(parts[1]>=6||parts.at(-1)>=6180);
}
export function createUserscriptEngines({getValue,setValue,request,info,builtin,builtinContext,readTimeoutMs=3000}){
// Bound optional reads so a manager stall cannot block lookup startup.
 // Writes are not raced: a timed-out write might still modify stored keys later.
 const deadline=Number.isFinite(readTimeoutMs)&&readTimeoutMs>0?Math.min(3000,Math.max(1,Math.floor(readTimeoutMs))):3000;
 const readValue=()=>{let timer;return Promise.race([Promise.resolve().then(()=>getValue('click-context:v1:engines',null)),new Promise((_resolve,reject)=>timer=setTimeout(()=>reject(Error('引擎配置读取超时，未重置已有设置')),deadline))]).finally(()=>clearTimeout(timer));};
 const repository=createEngineRepository({get:readValue,set:state=>setValue('click-context:v1:engines',state)});
 let state=structuredClone(DEFAULT_ENGINE_SETTINGS),failure=null,serial=Promise.resolve(),reads=Promise.resolve(),selectedContextClient=null,refreshJob=null,refreshAgain=false;
 const cancelers=new Map();
 const safe=supportsSafeAPIRedirect(info),webTranslator=createWebTranslator({fetcher:createGMFetch(request)});
 function revision(value){return JSON.stringify([value.body,value.selection,value.context??'builtin',value.profiles.map(p=>[p.id,p.cacheRevision])]);}
 function publicView(value){const view={...engineSettingsForUI(value),revision:revision(value)},text=JSON.stringify(view);if(value.profiles.some(p=>p.apiKey&&text.includes(p.apiKey)))throw Error('配置名称、模型和地址不能包含密钥');return view;}
 function commit(next){const old=publicEngineSettings(state),value=publicEngineSettings(next);for(const [controller,scope]of cancelers)if(old[scope].cacheKey!==value[scope].cacheKey)controller.abort();if(old.context.cacheKey!==value.context.cacheKey)selectedContextClient=null;state=next;failure=null;}
 function read(){const job=reads.catch(()=>{}).then(async()=>{try{const next=await repository.read();publicView(next);commit(next);}catch(error){failure=error;for(const controller of cancelers.keys())controller.abort();selectedContextClient=null;throw error;}return publicView(state);});reads=job;return job;}
 // A remote event installs this barrier synchronously, before its first read.
 // Burst events share one job; events during a read request one fresh follow-up.
 function refresh(){
  refreshAgain=true;
  if(!refreshJob)refreshJob=Promise.resolve().then(async()=>{while(refreshAgain){refreshAgain=false;try{await read();}catch(error){if(!refreshAgain)throw error;}}}).finally(()=>{refreshJob=null;});
  return refreshJob;
 }
 async function current(signal){
  while(refreshJob){
   signal?.throwIfAborted();
   if(!signal){await refreshJob;continue;}
   let abort;
   try{await Promise.race([refreshJob,new Promise((_resolve,reject)=>{abort=()=>reject(signal.reason);signal.addEventListener('abort',abort,{once:true});})]);}
   finally{signal.removeEventListener('abort',abort);}
  }
  signal?.throwIfAborted();if(failure)throw failure;
 }
 async function finish(result,signal){if(refreshJob)await current(signal);signal.throwIfAborted();return result;}
 function publicSettings(){const value=publicEngineSettings(state);if(failure)for(const scope of ['body','selection','context'])value[scope]={id:'unreadable',label:'引擎配置无法读取',cacheKey:scope==='context'?'unreadable:context':'unreadable',minInterval:1200};return value;}
 function validateManagerSave(next,previous){
  if(safe||!next.profiles.length)return;
  if(['body','selection','context'].some(scope=>next[scope]!=='builtin'&&!webTranslationEngine(next[scope])))throw Error('当前管理器未确认支持安全 API 请求；请将点词语境、正文和选文都选为内置服务后保存。已有 API 配置可原样保留。');
  const unchanged=next.profiles.length===previous.profiles.length&&next.profiles.every((profile,index)=>{
   const old=previous.profiles[index];return Object.keys(profile).every(key=>profile[key]===old[key])&&Object.keys(old).every(key=>profile[key]===old[key]);
  });
  if(!unchanged)throw Error('当前管理器不能新增或修改 API 配置；请保留原配置，或在支持安全 API 请求的管理器中编辑。');
 }
 async function save(input,{authorize=()=>false,onCommit=()=>{}}={}){
  const task=serial.catch(()=>{}).then(async()=>{
   await read();
   if(input.revision!==undefined&&input.revision!==revision(state))throw Error('配置已在其他页面修改，请重新打开设置后再保存；未覆盖新配置');
   const preview=normalizeEngineSettings(input,state);publicView(preview);
   validateManagerSave(preview,state);
   const previousOrigins=new Set(state.profiles.map(p=>new URL(p.endpoint).origin));
   const origins=[...new Set(preview.profiles.map(p=>new URL(p.endpoint).origin))].filter(origin=>!previousOrigins.has(origin));
   if(origins.length&&!await authorize(origins))throw Error('未确认 API 服务地址，原配置保持');
   let notification;
   await repository.save(input,{beforeWrite:(next,previous)=>{
    try{publicView(previous);}catch(error){failure=error;throw error;}
    if(input.revision!==undefined&&input.revision!==revision(previous)){commit(previous);throw Error('配置已在其他页面修改，请重新打开设置后再保存；未覆盖新配置');}
    publicView(next);validateManagerSave(next,previous);
   },onCommit:(next)=>{commit(next);notification=onCommit(publicSettings());}});
   await notification;
   return publicView(state);
  });
  // Validation and host confirmation precede persistence; the repository validates again.
  serial=task;return task;
 }
 async function runProfile(profile,text,options={}){
  if(!safe)throw Error('当前管理器尚未确认支持安全 API 请求；未发送文本');
  return executeEngineTranslation(profile,text,{...options,fetcher:createGMFetch(request,{allowedOrigins:[new URL(profile.endpoint).origin]})});
 }
 async function runContextProfile(profile,input,options={}){
  if(!safe)throw Error('当前管理器尚未确认支持安全 API 请求；未发送原句');
  return executeEngineContext(profile,input,{...options,fetcher:createGMFetch(request,{allowedOrigins:[new URL(profile.endpoint).origin]})});
 }
 async function context(input,options={}){
  if(refreshJob)await current(options.signal);if(failure)throw failure;options.signal?.throwIfAborted();
  const descriptor=publicSettings().context;
  if(options.engineKey&&options.engineKey!==descriptor.cacheKey)throw Error('语境引擎已更改，请重新查词');
  const controller=new AbortController();cancelers.set(controller,'context');
  const signal=options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal;
  try{
   if(state.context==='builtin'){
    if(typeof builtinContext!=='function')throw Error('内置语境服务暂不可用');
    return await finish(await builtinContext(input,{...options,signal}),signal);
   }
   if(!selectedContextClient||selectedContextClient.key!==descriptor.cacheKey){
    const profile=state.profiles.find(p=>p.id===state.context);if(!profile)throw Error('所选语境配置已移除，请重新选择');
    const client=createContextClient({revision:CONTEXT_CURRENT_REVISION,fetcher:async(_url,requestOptions)=>{
     try{return Response.json({ok:true,data:await runContextProfile(profile,JSON.parse(requestOptions.body),{signal:requestOptions.signal})});}
     catch(error){
      if(error?.name==='AbortError')throw error;
      if(error?.code==='ENGINE_AUTH')return Response.json({ok:false,error:'所选语境 AI 的密钥或访问权限不可用'},{status:401});
      if(error?.code==='RATE_LIMITED')return Response.json({ok:false,error:'所选语境 AI 限流，请稍后重试'},{status:429});
      if(error?.code==='CONTEXT_INVALID_RESULT')return Response.json({ok:false,code:'CONTEXT_INVALID_RESULT',validationReason:error.validationReason},{status:503});
      return Response.json({ok:false,code:'CONTEXT_UNAVAILABLE'},{status:503});
     }
    }});
    selectedContextClient={key:descriptor.cacheKey,client,model:profile.model,provider:profile.preset};
   }
   const active=selectedContextClient,result=await active.client(input,{signal});
   return await finish({...result,model:active.model,provider:active.provider},signal);
  }finally{cancelers.delete(controller);}
 }
 async function translate(scope,text,options={}){
  if(refreshJob)await current(options.signal);if(failure)throw failure;options.signal?.throwIfAborted();
  const selected=state[scope],descriptor=publicSettings()[scope];
  if(options.engineKey&&options.engineKey!==descriptor.cacheKey)throw Error('翻译引擎已更改，请重新操作');
  const controller=new AbortController();cancelers.set(controller,scope);
  const signal=options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal;
  try{
   if(selected==='builtin')return await finish(await builtin.translate(text,{...options,signal}),signal);
   if(webTranslationEngine(selected))return await finish(await webTranslator.translate(selected,text,{signal}),signal);
   const profile=state.profiles.find(p=>p.id===selected);if(!profile)throw Error('所选配置已移除，请重新选择');
   return await finish(await runProfile(profile,text,{signal}),signal);
  }finally{cancelers.delete(controller);}
 }
 async function test(id,text,options={}){if(refreshJob)await current(options.signal);options.signal?.throwIfAborted();if(failure)throw failure;const profile=state.profiles.find(p=>p.id===id);if(!profile)throw Error('请先保存该配置');return runProfile(profile,text,options);}
 async function testContext(id,input,options={}){if(refreshJob)await current(options.signal);options.signal?.throwIfAborted();if(failure)throw failure;const profile=state.profiles.find(p=>p.id===id);if(!profile)throw Error('请先保存该配置');return runContextProfile(profile,input,options);}
 return {read,refresh,save,publicSettings,translate,context,test,testContext,get safe(){return safe;}};
}
