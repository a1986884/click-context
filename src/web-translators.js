import {translationChunks} from './providers.js';
import {clientTranslationText} from './translation-client-validation.js';

const serviceError=(message='所选免填 Key 翻译暂不可用，请稍后重试',code='TRANSLATION_UNAVAILABLE')=>Object.assign(Error(message),{code,retryable:false});
// Public web endpoints; no user API key, cookies or persisted service tokens.
export function createWebTranslator({fetcher=fetch,timeoutMs=22000,now=Date.now}={}){
 let bingSession=null;
 async function request(url,{signal,...options}={}){
  const deadline=AbortSignal.timeout(timeoutMs),combined=signal?AbortSignal.any([signal,deadline]):deadline;
  let rejectAbort;
  const aborted=new Promise((_,reject)=>{rejectAbort=()=>reject(combined.reason);combined.addEventListener('abort',rejectAbort,{once:true});});
  try{
   combined.throwIfAborted();
   const response=await Promise.race([fetcher(url,{...options,signal:combined,credentials:'omit',referrerPolicy:'no-referrer',redirect:'error',cache:'no-store'}),aborted]);
   if(response.status===429)throw serviceError('所选免填 Key 翻译限流，请稍后重试','RATE_LIMITED');
   if(!response.ok)throw serviceError();
   if(Number(response.headers.get('content-length'))>1024*1024)throw serviceError();
   const reader=response.body?.getReader();if(!reader)throw serviceError();
   const chunks=[];let size=0;
   try{while(true){combined.throwIfAborted();const {value,done}=await Promise.race([reader.read(),aborted]);if(done)break;size+=value.byteLength;if(size>1024*1024)throw serviceError();chunks.push(value);}}
   finally{void reader.cancel().catch(()=>{});}
   combined.throwIfAborted();const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
   return new TextDecoder().decode(bytes);
  }finally{combined.removeEventListener('abort',rejectAbort);}
 }
 async function google(text,signal){
  const url=new URL('https://translate.googleapis.com/translate_a/single');
  url.search=new URLSearchParams({client:'gtx',sl:'en',tl:'zh-CN',dt:'t',q:text}).toString();
  const data=JSON.parse(await request(url.href,{signal}));
  if(!Array.isArray(data?.[0])||!data[0].length)throw serviceError();
  return data[0].map(part=>{if(!Array.isArray(part)||typeof part[0]!=='string'||!part[0].trim())throw serviceError();return part[0];}).join('');
 }
 async function microsoft(text,signal){
  if(!bingSession||bingSession.until<=now()){
   const html=await request('https://www.bing.com/translator',{signal});
   const ig=/\bIG\s*:\s*"([\w-]{1,128})"/.exec(html),params=/params_AbusePreventionHelper\s*=\s*\[\s*(\d{1,20})\s*,\s*"([\w+\/=.-]{1,4096})"\s*,\s*(\d{1,10})\s*\]/.exec(html);
   if(!ig||!params)throw serviceError('微软翻译页面暂不可用，请稍后重试');
   bingSession={ig:ig[1],iid:/data-iid="(translator\.[\w.]{1,64})"/.exec(html)?.[1]||'translator.5023',key:params[1],token:params[2],until:now()+Math.min(600000,Math.max(0,Number(params[3])-30000))};
  }
  const session=bingSession,url=new URL('https://www.bing.com/ttranslatev3');
  url.search=new URLSearchParams({isVertical:'1',IG:session.ig,IID:session.iid}).toString();
  try{
   const data=JSON.parse(await request(url.href,{signal,method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({fromLang:'en',to:'zh-Hans',text,token:session.token,key:session.key}).toString()}));
   const translations=data?.[0]?.translations,value=Array.isArray(translations)?translations.find(item=>item?.to==='zh-Hans')?.text:null;
   if(typeof value!=='string')throw serviceError();return value;
  }catch(error){if(bingSession===session)bingSession=null;throw error;}
 }
 return {async translate(id,text,{signal}={}){
  try{
   signal?.throwIfAborted();
   if(!['google-free','microsoft-free'].includes(id)||typeof text!=='string'||!text.trim()||text.length>20000)throw serviceError();
   const result=[];
   for(const part of translationChunks(text,600)){
    signal?.throwIfAborted();const value=await (id==='google-free'?google:microsoft)(part,signal);
    signal?.throwIfAborted();result.push(clientTranslationText(value,{text:part}));
   }
   return result.join(' ');
  }catch(error){if(signal?.aborted)throw signal.reason??new DOMException('翻译已取消','AbortError');if(error?.code==='RATE_LIMITED')throw error;throw serviceError();}
 }};
}
