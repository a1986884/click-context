export async function readPage(url,{signal,fetcher=fetch,timeoutMs=12000,useSession=false}={}){
 const controller=new AbortController(),abort=()=>controller.abort(signal.reason);signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
 const timer=setTimeout(()=>controller.abort(Error('Collins 查询超时，请重试或打开官网。')),timeoutMs);
 let rejectAbort;const aborted=new Promise((_,reject)=>{rejectAbort=()=>reject(controller.signal.reason||Error('已取消'));controller.signal.addEventListener('abort',rejectAbort,{once:true});});
 let reader;
 try{
  controller.signal.throwIfAborted();
  const response=await Promise.race([fetcher(url,{signal:controller.signal,credentials:useSession===true&&new URL(url).origin==='https://www.collinsdictionary.com'?'include':'omit',referrerPolicy:'no-referrer',headers:{Accept:'text/html','Accept-Language':'en'}}),aborted]);
  if(!response.ok){
   const denied=[401,403].includes(response.status);
   throw Object.assign(Error(response.status===404?'Collins 官网暂未找到这个词。':denied?(new URL(url).origin!=='https://www.collinsdictionary.com'?'Collins 公开词条来源拒绝了当前请求（HTTP '+response.status+'），请查看来源页面。':useSession===true?'Collins 官网仍拒绝查询（HTTP '+response.status+'）。浏览器验证状态可能未能用于插件请求，请在官网查看。':'Collins 官网拒绝了当前查询连接（HTTP '+response.status+'）。请先在官网完成验证，再通过插件工具栏启用“沿用 Collins 已验证会话”后重试。'):'Collins 官网响应异常（HTTP '+response.status+'），请稍后重试。'),{code:response.status===404?'NOT_FOUND':denied?'COLLINS_ACCESS_DENIED':'COLLINS_UNAVAILABLE',upstreamStatus:response.status});
  }
  if(response.url&&!['www.collinsdictionary.com','dict.youdao.com'].includes(new URL(response.url).hostname))throw Error('词条地址不可用。');
  const limit=1024*1024;if(Number(response.headers.get('content-length'))>limit)throw Error('官网响应过大，请打开官网查看。');
  reader=response.body.getReader();const decoder=new TextDecoder();let size=0,html='';
  for(;;){const chunk=await Promise.race([reader.read(),aborted]);if(chunk.done)break;size+=chunk.value.byteLength;if(size>limit)throw Error('官网响应过大，请打开官网查看。');html+=decoder.decode(chunk.value,{stream:true});}
  return html+decoder.decode();
 }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);controller.signal.removeEventListener('abort',rejectAbort);void reader?.cancel().catch(()=>{});}
}
