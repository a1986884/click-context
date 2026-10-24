function cancelled(promise,signal){
 if(!signal)return promise;
 return new Promise((resolve,reject)=>{
  const abort=()=>{signal.removeEventListener('abort',abort);reject(signal.reason||new DOMException('已取消','AbortError'));};
  if(signal.aborted){promise.catch(()=>{});abort();return;}signal.addEventListener('abort',abort,{once:true});
  promise.then(value=>{signal.removeEventListener('abort',abort);resolve(value);},error=>{signal.removeEventListener('abort',abort);reject(error);});
 });
}
export function createOffscreenParser(api){
 let creating=null;
 const contextQuery=()=>({contextTypes:['OFFSCREEN_DOCUMENT'],documentUrls:[api.runtime.getURL('offscreen.html')]});
 async function ensure(){
  if(!creating)creating=(async()=>{
   try{
    if(!api.runtime.getContexts||!api.offscreen?.createDocument)throw Error('当前浏览器不支持 offscreen DOM_PARSER');
    const contexts=await api.runtime.getContexts(contextQuery());
    if(!contexts.length)await api.offscreen.createDocument({url:'offscreen.html',reasons:['DOM_PARSER'],justification:'Parse requested dictionary HTML with native DOMParser; no network or visible UI.'});
   }catch(error){throw Object.assign(Error('无法创建词典解析页面：'+error.message),{code:'OFFSCREEN_CREATE_FAILED'});}
  })().finally(()=>{creating=null;});
  return creating;
 }
 return async(html,kind,{phrase=null,signal}={})=>{
  signal?.throwIfAborted();
  const bounded=signal?AbortSignal.any([signal,AbortSignal.timeout(12000)]):AbortSignal.timeout(12000);
  for(let attempt=0;attempt<2;attempt++){
   await cancelled(ensure(),bounded);bounded.throwIfAborted();let response;
   try{
    response=await cancelled(api.runtime.sendMessage({type:'lextide:parse-html',html,kind,phrase}),bounded);bounded.throwIfAborted();
    if(!response)throw Error('解析页面未返回响应');
   }catch(error){
    bounded.throwIfAborted();
    const failure=Object.assign(Error('词典解析页面连接中断，请重试：'+error.message),{code:'OFFSCREEN_CONNECTION_FAILED'});
    if(attempt===1)throw failure;
    let contexts;try{contexts=await cancelled(api.runtime.getContexts(contextQuery()),bounded);}catch{bounded.throwIfAborted();throw failure;}
    // Retry only the same native parser, once, after confirming its document died.
    if(contexts.length)throw failure;continue;
   }
   if(!response.ok)throw Object.assign(Error(response.error||'词典解析页面未响应'),{code:response.code||'OFFSCREEN_PARSE_FAILED'});
   if(!response.data||typeof response.data!=='object')throw Object.assign(Error('词典解析页面返回格式异常，请重试'),{code:'OFFSCREEN_PARSE_FAILED'});
   return response.data;
  }
 };
}
