// Privileged APIs are passed from the userscript sandbox, never from unsafeWindow.
export const NETWORK_HOSTS=Object.freeze(['dict.youdao.com','lextide-context.aa1986884.workers.dev','v04-preview.lextide.pages.dev']);
export function createGMFetch(request,{allowedOrigins=[],timeoutMs=25000}={}){
 const deadlineMs=Number.isFinite(timeoutMs)&&timeoutMs>0?Math.min(25000,Math.max(1,Math.floor(timeoutMs))):25000;
 return async(url,options={})=>{
  const target=new URL(url);
  const explicit=allowedOrigins.includes(target.origin),local=target.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(target.hostname);
  if(target.username||target.password||!(explicit&&(target.protocol==='https:'||local)||target.protocol==='https:'&&!target.port&&NETWORK_HOSTS.includes(target.hostname)))throw Error('此试用版不允许连接该服务');
  if(explicit&&options.redirect!=='error')throw Error('自带 API 必须禁止重定向');
  options.signal?.throwIfAborted();
  return new Promise((resolve,reject)=>{
   let handle,done=false,timer,stopRequested=false;
   const finish=(fn,value)=>{if(done)return;done=true;clearTimeout(timer);options.signal?.removeEventListener('abort',abort);fn(value);};
   const cancelTransport=()=>{try{handle?.abort?.();}catch{}};
   const stop=error=>{if(done)return;stopRequested=true;finish(reject,error);cancelTransport();};
   const abort=()=>stop(options.signal?.reason||new DOMException('已取消','AbortError'));
   options.signal?.addEventListener('abort',abort,{once:true});
   timer=setTimeout(()=>stop(Object.assign(Error('服务请求超时，请重试'),{code:'REQUEST_TIMEOUT'})),deadlineMs);
   try{
    handle=request({url:target.href,method:options.method||'GET',headers:options.headers||{},data:options.body,
     anonymous:true,responseType:'arraybuffer',timeout:deadlineMs,...(options.redirect==='error'?{redirect:'error'}:{}),
     onprogress:event=>{if(event.loaded>1024*1024)stop(Error('服务响应过大'));},
     onload:result=>{
      if(done)return;
      try{
       const final=new URL(result.finalUrl||target.href);
       if(final.origin!==target.origin)throw Error('服务重定向至未允许的地址');
       // Managers may return a buffer from another JavaScript realm, a view or
       // plain text despite responseType. Never rely on instanceof alone.
       const raw=result.response;
       let body;
       if(Object.prototype.toString.call(raw)==='[object ArrayBuffer]')body=new Uint8Array(raw);
       else if(ArrayBuffer.isView(raw))body=new Uint8Array(raw.buffer,raw.byteOffset,raw.byteLength);
       else if(typeof raw==='string')body=new TextEncoder().encode(raw);
       else if(typeof result.responseText==='string')body=new TextEncoder().encode(result.responseText);
       else body=null;
       if(body===null||body.byteLength>1024*1024)throw Error('服务响应不可读取或过大');
       const response=new Response(body,{status:result.status});
       Object.defineProperty(response,'url',{value:final.href});finish(resolve,response);
      }catch(error){finish(reject,error);}
     },
     onerror:()=>finish(reject,Error('联网失败，请检查脚本管理器的服务访问权限')),
     ontimeout:()=>finish(reject,Object.assign(Error('服务请求超时，请重试'),{code:'REQUEST_TIMEOUT'})),
     onabort:()=>finish(reject,new DOMException('已取消','AbortError'))});
    if(stopRequested)cancelTransport();
    // Modern GM.xmlHttpRequest can return a promise as well as expose callbacks.
    handle?.catch?.(()=>finish(reject,Error('脚本管理器未能完成请求')));
    if(options.signal?.aborted)abort();
   }catch(error){finish(reject,error);}
  });
 };
}
export function createGMAdapter({getValue,setValue,origin}){
 return {get:key=>getValue('click-context:v1:'+ (key==='prefs'?'prefs:'+origin:key),null),
  set:(key,value)=>setValue('click-context:v1:'+(key==='prefs'?'prefs:'+origin:key),value)};
}
