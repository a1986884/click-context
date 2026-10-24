import {sentenceRanges} from './sentences.js';
import {TRANSLATION_ENDPOINT,TRANSLATION_CACHE_VERSION} from './translation-service.js';
import {clientTranslationText,CLIENT_TRANSLATION_CACHE_VERSION} from './translation-client-validation.js';
/** Client-side services. Callers enforce website activation before sending text. */
export const TRANSLATION_PROVIDER={id:'cloudflare-ai',name:'Cloudflare AI',cacheVersion:CLIENT_TRANSLATION_CACHE_VERSION,minInterval:1200};
export function splitText(text,max=350){
 const out=[];let part='';for(const word of text.split(/\s+/)){if(word.length>max)throw Error('单个文本片段过长');if((part+' '+word).trim().length>max){out.push(part);part='';}part+=(part?' ':'')+word;}if(part)out.push(part);return out;
}
let queue=Promise.resolve(),lastRequest=0;
function pause(ms,signal){return new Promise((resolve,reject)=>{if(signal?.aborted){reject(signal.reason||Error('已取消'));return;}const abort=()=>{clearTimeout(timer);reject(signal.reason||Error('已取消'));};const timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve();},ms);signal?.addEventListener('abort',abort,{once:true});});}
async function paced(url,fetcher,options){
 if(fetcher!==globalThis.fetch||url!==TRANSLATION_ENDPOINT)return fetcher(url,options);
 const task=queue.then(async()=>{await pause(Math.max(0,TRANSLATION_PROVIDER.minInterval-(Date.now()-lastRequest)),options.signal);options.signal.throwIfAborted();lastRequest=Date.now();return fetcher(url,options);});queue=task.catch(()=>{});return task;
}
export async function jsonFetch(url,fetcher=fetch,{signal,timeoutMs=12000,acceptHttpErrors=false,method,headers,body}={}){
 const controller=new AbortController();const abort=()=>controller.abort(signal.reason);signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
 const timer=setTimeout(()=>controller.abort(Error('请求超时，请重试')),timeoutMs);
 let rejectAbort;const aborted=new Promise((_,reject)=>{rejectAbort=()=>reject(controller.signal.reason||Error('已取消'));controller.signal.addEventListener('abort',rejectAbort,{once:true});});
 try{controller.signal.throwIfAborted();const response=await Promise.race([paced(url,fetcher,{signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer',...(method?{method}:{}),...(headers?{headers}:{}),...(body!==undefined?{body}:{})}),aborted]);if(!response.ok&&!acceptHttpErrors){const e=Error(response.status===429?'服务限流，请稍后重试':`服务暂不可用（HTTP ${response.status}）`);e.retryable=response.status>=500;if(response.status===429)e.code='RATE_LIMITED';throw e;}
  // Keep timeout and cancellation active until the response body has been read.
  const data=await Promise.race([response.json(),aborted]);controller.signal.throwIfAborted();return data;
 }catch(e){if(e.retryable===undefined)e.retryable=!signal?.aborted;if(controller.signal.aborted&&!signal?.aborted){const timeout=Error('请求超时，请重试');timeout.retryable=true;throw timeout;}throw e;
 }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);controller.signal.removeEventListener('abort',rejectAbort);}
}
export function translationChunks(text,max=1200){
 const chunks=[];let pending='';
 for(const range of sentenceRanges(text)){const sentence=text.slice(range.start,range.end).trim();if(!sentence)continue;
  if(sentence.length>max){if(pending){chunks.push(pending);pending='';}chunks.push(...splitText(sentence,max));continue;}
  if(pending&&pending.length+sentence.length+1>max){chunks.push(pending);pending='';}pending+=(pending?' ':'')+sentence;
 }
 if(pending)chunks.push(pending);return chunks;
}
export function createTranslationProvider({fetcher=fetch,request=jsonFetch,endpoint=TRANSLATION_ENDPOINT}={}){
 return {...TRANSLATION_PROVIDER,async translate(text,{signal}={}){
  const result=[];for(const part of translationChunks(text)){
   signal?.throwIfAborted();let data;try{data=await request(endpoint,fetcher,{signal,timeoutMs:22000,acceptHttpErrors:true,method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:part,translationRevision:TRANSLATION_CACHE_VERSION})});}catch(error){if(signal?.aborted)throw error;error.code||='TRANSLATION_UNAVAILABLE';throw error;}signal?.throwIfAborted();
   if(!data?.ok||typeof data.data?.text!=='string'||!data.data.text.trim())throw Object.assign(Error(data?.error||'正文翻译暂不可用，请重试'),{code:data?.code||'TRANSLATION_UNAVAILABLE',retryable:data?.retryable===true});
   if(data.data.version!==TRANSLATION_CACHE_VERSION)throw Object.assign(Error('正文翻译暂不可用，请稍后重试'),{code:'TRANSLATION_UNAVAILABLE',retryable:false});
   try{result.push(clientTranslationText(data.data.text,{text:part,translationRevision:TRANSLATION_CACHE_VERSION},{serverValidated:true}));}
   catch(error){throw Object.assign(Error(error.validationReason==='unit-mismatch'?'译文未保留温度单位，请更换引擎或重试':error.validationReason==='number-mismatch'?'译文未通过数值符号校验，请更换引擎或重试':'内置翻译未返回有效译文，请重试'),{code:'TRANSLATION_UNAVAILABLE',retryable:false,validationReason:error.validationReason});}
  }
  return result.join(' ');
 }};
}
