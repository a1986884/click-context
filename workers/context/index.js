import {contextReviewPrompt,contextReviewOutputLimit,parseContextReview,CONTEXT_STAGE_OUTPUT_LIMIT} from '../../src/context-review.js';
import {cleanTranslation,translationPrompt,translationModel,translationOutputLimit,parseTranslationResult,TRANSLATION_MODEL,TRANSLATION_CURRENT_MODEL,TRANSLATION_CACHE_VERSION,TRANSLATION_LEGACY_CACHE_VERSION,TRANSLATION_ACCEPTED_CACHE_VERSIONS,TRANSLATION_VALIDATION_REASONS,TRANSLATION_INCOMPLETE_REASONS} from '../../src/translation-service.js';
import {cleanContext,contextPrompt,parseContextResult,CONTEXT_MODEL,CONTEXT_VALIDATION_REASONS,CONTEXT_CURRENT_REVISION,CONTEXT_ACCEPTED_REVISIONS} from '../../src/context-meaning.js';
const CONTEXT_INFERENCE_TIMEOUT_MS=16000;
const TRANSLATION_INFERENCE_TIMEOUT_MS=16000;
const TRANSLATION_FAILURE_REASONS=['cancelled','timeout','inference','invalid-result','capacity'];
function quotaError(error){return providerCode(error)===3036||error?.code===3036||error?.code==='3036'||Array.isArray(error?.errors)&&error.errors.some(item=>item?.code===3036||item?.code==='3036')||typeof error?.message==='string'&&/^3036: You have used up your daily free allocation/.test(error.message);}
// Only numeric provider metadata is exposed; never the SDK message or model text.
function providerCode(error){
 const candidates=[error?.code,error?.cause?.code,...(Array.isArray(error?.errors)?error.errors.map(e=>e?.code):[])];
 for(const code of candidates)if((typeof code==='number'||typeof code==='string'&&/^\d{4,5}$/.test(code))&&Number.isInteger(Number(code))&&Number(code)>=1000&&Number(code)<=99999)return Number(code);
 const match=typeof error?.message==='string'&&error.message.match(/(?:^|[\s:])([1-9]\d{3,4}):/);return match?Number(match[1]):null;
}
function capacityError(error){return providerCode(error)===3040;}
function inference(run,signal){
 return new Promise((resolve,reject)=>{
  const abort=()=>{signal.removeEventListener('abort',abort);reject(signal.reason||Error('已取消'));};
  if(signal.aborted){abort();return;}signal.addEventListener('abort',abort,{once:true});
  Promise.resolve().then(()=>{signal.throwIfAborted();return run();}).then(value=>{signal.removeEventListener('abort',abort);resolve(value);},error=>{signal.removeEventListener('abort',abort);reject(error);});
 });
}
function contextErrorBody(code,validationReason,incompleteReason,upstreamCode){
 const messages={CONTEXT_QUOTA_EXCEEDED:'内置 AI 当日额度已用完，请更换语境 AI 或等待额度重置',CONTEXT_BUSY:'语境服务繁忙，请稍后重试',RATE_LIMITED:'语境查询过于频繁，请稍后重试',CONTEXT_CANCELLED:'语境请求已取消',CONTEXT_TIMEOUT:'语境分析超时，请重试',CONTEXT_INVALID_RESULT:'语境结果未通过校验，请重试',CONTEXT_UNAVAILABLE:'语境服务暂不可用，请重试'};
 return {ok:false,error:messages[code],code,retryable:false,...(code==='CONTEXT_INVALID_RESULT'?{validationReason:CONTEXT_VALIDATION_REASONS.includes(validationReason)?validationReason:'unknown'}:{}),...(code==='CONTEXT_INVALID_RESULT'&&validationReason==='incomplete'?{incompleteReason:['max-output-tokens','content-filter'].includes(incompleteReason)?incompleteReason:'unknown',outputTokenLimit:900}:{}),...(Number.isInteger(upstreamCode)?{upstreamCode}:{})};
}
export default {async fetch(request,env){
 const path=new URL(request.url).pathname,userscript=path==='/userscript/meaning'||path==='/userscript/translate';
 // Dedicated anonymous public API for user-installed scripts on arbitrary sites.
 // Existing extension routes keep their origin policy; quotas/schema/timeouts are shared.
 const origin=request.headers.get('Origin')||'';
 const allowed=userscript||!origin||/^chrome-extension:\/\/[a-p]{32}$/.test(origin)||origin==='https://lextide.pages.dev'||origin==='https://v04-preview.lextide.pages.dev'||/^https:\/\/[a-f0-9]+\.lextide\.pages\.dev$/.test(origin);
 const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Origin',...(allowed&&(origin||userscript)?{'Access-Control-Allow-Origin':userscript?'*':origin,'Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'POST, OPTIONS'}:{})};
 const reply=(body,status=200)=>Response.json(body,{status,headers});
 if(!allowed)return reply({ok:false,error:'来源不受支持'},403);
 if(new URL(request.url).pathname==='/health')return reply({ok:true,model:CONTEXT_MODEL,version:'ai-context-v3',currentContextRevision:CONTEXT_CURRENT_REVISION,acceptedContextRevisions:CONTEXT_ACCEPTED_REVISIONS,contextInferenceTimeoutMs:CONTEXT_INFERENCE_TIMEOUT_MS,contextFailureCodes:true,contextValidationReasons:CONTEXT_VALIDATION_REASONS,translation:{model:TRANSLATION_MODEL,currentModel:TRANSLATION_CURRENT_MODEL,version:'ai-translation-v1',cacheVersion:TRANSLATION_CACHE_VERSION,defaultCacheVersion:TRANSLATION_LEGACY_CACHE_VERSION,acceptedCacheVersions:TRANSLATION_ACCEPTED_CACHE_VERSIONS,inferenceTimeoutMs:TRANSLATION_INFERENCE_TIMEOUT_MS,failureReasons:TRANSLATION_FAILURE_REASONS,validationReasons:TRANSLATION_VALIDATION_REASONS,incompleteReasons:TRANSLATION_INCOMPLETE_REASONS}});
 const translating=path==='/translate'||path==='/userscript/translate';
 if(!translating&&path!=='/meaning'&&path!=='/userscript/meaning')return reply({ok:false,error:'Not found'},404);
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(request.method!=='POST')return reply({ok:false,error:'只接受 POST'},405);
 if(!request.headers.get('Content-Type')?.includes('application/json'))return reply({ok:false,error:'需要 JSON'},415);
 if(Number(request.headers.get('Content-Length'))>65000)return reply({ok:false,error:'请求过长'},413);
 // Bound actual bytes even when Content-Length is absent or dishonest.
 const reader=request.body?.getReader();if(!reader)return reply({ok:false,error:'请求为空'},400);
 let text='',size=0;const decoder=new TextDecoder();try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>65000){await reader.cancel();return reply({ok:false,error:'请求过长'},413);}text+=decoder.decode(value,{stream:true});}text+=decoder.decode();}catch{return reply({ok:false,error:'请求读取失败'},400);}
 let input;try{input=translating?cleanTranslation(JSON.parse(text)):cleanContext(JSON.parse(text));}catch{return reply({ok:false,error:translating?'无效翻译请求':'无效语境请求'},400);}
 const ip=request.headers.get('CF-Connecting-IP')||'unknown';
 if(translating){
  if(!(await env.TRANSLATION_IP.limit({key:ip})).success||!(await env.TRANSLATION_TOTAL.limit({key:'all'})).success)return reply({ok:false,error:'正文翻译请求过于频繁，请稍后重试',code:'RATE_LIMITED',retryable:false},429);
  const signal=AbortSignal.any([request.signal,AbortSignal.timeout(TRANSLATION_INFERENCE_TIMEOUT_MS)]),started=Date.now();
  for(let attempt=0;attempt<2;attempt++){
   let validating=false;
   try{const raw=await inference(()=>env.AI.run(translationModel(input),translationPrompt(input),{signal,...(input.translationRevision===TRANSLATION_CACHE_VERSION?{rejectIfBusy:true}:{})}),signal);signal.throwIfAborted();validating=true;return reply({ok:true,data:parseTranslationResult(raw,input)});}
   catch(error){
    if(!validating&&!signal.aborted&&quotaError(error))return reply({ok:false,error:'内置 AI 当日额度已用完，请更换翻译引擎或等待额度重置',code:'TRANSLATION_QUOTA_EXCEEDED',retryable:false},503);
    if(!validating&&!signal.aborted&&capacityError(error))return reply({ok:false,error:'内置翻译服务繁忙，请稍后重试',code:'TRANSLATION_BUSY',failureReason:'capacity',translationRevision:input.translationRevision,outputTokenLimit:translationOutputLimit(input),retryable:false},503);
    if(attempt===1||signal.aborted||Date.now()-started>5000){
    const failureReason=request.signal.aborted?'cancelled':signal.aborted?'timeout':validating?'invalid-result':'inference';
    const validationReason=failureReason==='invalid-result'&&TRANSLATION_VALIDATION_REASONS.includes(error?.validationReason)?error.validationReason:'unknown';
    const incompleteReason=validationReason==='incomplete'&&TRANSLATION_INCOMPLETE_REASONS.includes(error?.incompleteReason)?error.incompleteReason:'unknown';
    return reply({ok:false,error:validationReason==='condition-mismatch'?'译文未通过条件方向校验，请更换引擎或重试':'正文翻译暂不可用，请稍后重试',code:'TRANSLATION_UNAVAILABLE',failureReason,translationRevision:input.translationRevision,outputTokenLimit:translationOutputLimit(input),...(failureReason==='invalid-result'?{validationReason}:{}),...(failureReason==='invalid-result'&&validationReason==='incomplete'?{incompleteReason}:{}),retryable:false},503);
   }}
  }
 }
 if(!(await env.PER_IP.limit({key:ip})).success||!(await env.TOTAL.limit({key:'all'})).success)return reply(contextErrorBody('RATE_LIMITED'),429);
 const signal=AbortSignal.any([request.signal,AbortSignal.timeout(CONTEXT_INFERENCE_TIMEOUT_MS)]),started=Date.now();
 for(let attempt=0;attempt<2;attempt++){
  let validating=false;
  try{
   const reviewing=input.contextRevision==='ai-context-v5',prompt=contextPrompt(input);if(reviewing)prompt.max_output_tokens=CONTEXT_STAGE_OUTPUT_LIMIT;
   const raw=await inference(()=>env.AI.run(CONTEXT_MODEL,prompt,{signal,...(['ai-context-v4','ai-context-v5',CONTEXT_CURRENT_REVISION].includes(input.contextRevision)?{rejectIfBusy:true}:{})}),signal);signal.throwIfAborted();validating=true;let meaning=parseContextResult(raw,input);
   if(reviewing){validating=false;const checked=await inference(()=>env.AI.run(CONTEXT_MODEL,contextReviewPrompt(input,meaning,{outputLimit:contextReviewOutputLimit(raw)}),{signal,rejectIfBusy:true}),signal);signal.throwIfAborted();validating=true;meaning=parseContextReview(checked,input,meaning);}
   return reply({ok:true,data:meaning});
  }
  catch(error){
   if(!validating&&!signal.aborted&&quotaError(error))return reply(contextErrorBody('CONTEXT_QUOTA_EXCEEDED'),503);
   if(!validating&&!signal.aborted&&capacityError(error))return reply(contextErrorBody('CONTEXT_BUSY'),503);
   if(attempt===1||signal.aborted||Date.now()-started>7000){
   const code=request.signal.aborted?'CONTEXT_CANCELLED':signal.aborted?'CONTEXT_TIMEOUT':validating?'CONTEXT_INVALID_RESULT':'CONTEXT_UNAVAILABLE';
   return reply(contextErrorBody(code,error?.validationReason,error?.incompleteReason,validating?null:providerCode(error)),503);
  }}
 }
}};
