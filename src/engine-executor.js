import {translationChunks} from './providers.js';
import {translationPrompt} from './translation-service.js';
import {clientTranslationText} from './translation-client-validation.js';
import {engineEndpoint,CONTEXT_PROTOCOLS} from './engine-profiles.js';
import {cleanContext,contextPrompt,parseContextResult,CONTEXT_CURRENT_REVISION,CONTEXT_VALIDATION_REASONS} from './context-meaning.js';

const unavailable=()=>Object.assign(Error('所选翻译引擎暂不可用，未切换到其他服务'),{code:'TRANSLATION_UNAVAILABLE',retryable:false});
const canceled=()=>new DOMException('翻译已取消','AbortError');
function requestFor(profile,text,prompt=translationPrompt({text})){
 const headers={'Content-Type':'application/json'};let url=engineEndpoint(profile.endpoint),body;
 switch(profile.protocol){
  case 'responses':
   if(profile.apiKey)headers.Authorization='Bearer '+profile.apiKey;
   body={model:profile.model,instructions:prompt.instructions,input:prompt.input,max_output_tokens:prompt.max_output_tokens,store:false,stream:false,background:false};break;
  case 'openai':
   if(profile.apiKey)headers.Authorization='Bearer '+profile.apiKey;
   body={model:profile.model,messages:[{role:'system',content:prompt.instructions},{role:'user',content:prompt.input}],stream:false,[profile.tokenParameter??(profile.preset==='openai'?'max_completion_tokens':'max_tokens')]:prompt.max_output_tokens};break;
  case 'anthropic':
   headers['x-api-key']=profile.apiKey;headers['anthropic-version']='2023-06-01';
   body={model:profile.model,system:prompt.instructions,messages:[{role:'user',content:prompt.input}],max_tokens:prompt.max_output_tokens};break;
  case 'gemini':
   headers['x-goog-api-key']=profile.apiKey;url=url.replace(/\/$/,'')+'/models/'+encodeURIComponent(profile.model.replace(/^models\//,''))+':generateContent';
   body={systemInstruction:{parts:[{text:prompt.instructions}]},contents:[{role:'user',parts:[{text:prompt.input}]}],generationConfig:{maxOutputTokens:prompt.max_output_tokens}};break;
  case 'google':
   headers['x-goog-api-key']=profile.apiKey;body={q:text,source:'en',target:'zh-CN',format:'text'};break;
  case 'microsoft':{
   headers['Ocp-Apim-Subscription-Key']=profile.apiKey;if(profile.region)headers['Ocp-Apim-Subscription-Region']=profile.region;
   const endpoint=new URL(url);endpoint.searchParams.set('api-version','3.0');endpoint.searchParams.set('from','en');endpoint.searchParams.set('to','zh-Hans');url=endpoint.href;body=[{Text:text}];break;
  }
  case 'deepl':headers.Authorization='DeepL-Auth-Key '+profile.apiKey;body={text:[text],source_lang:'EN',target_lang:'ZH'};break;
  default:throw Object.assign(Error('不支持此翻译协议'),{code:'ENGINE_CONFIG',retryable:false});
 }
 return {url,options:{method:'POST',headers,body:JSON.stringify(body),credentials:'omit',referrerPolicy:'no-referrer',redirect:'error',cache:'no-store'}};
}
function decodeGoogleText(text){
 return text.replace(/&(?:amp|lt|gt|quot|apos|#39|#\d+|#x[\da-f]+);/gi,entity=>{
  const named={'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&#39;':"'"};if(named[entity.toLowerCase()])return named[entity.toLowerCase()];
  const hex=/^&#x/i.test(entity),n=Number.parseInt(entity.slice(hex?3:2,-1),hex?16:10);return n>0&&n<=0x10ffff&&!(n>=0xd800&&n<=0xdfff)?String.fromCodePoint(n):entity;
 });
}
function translatedText(profile,data){
 switch(profile.protocol){
  case 'responses':{
   if(data?.status!=='completed'||data.error||data.incomplete_details||!Array.isArray(data.output))throw unavailable();
   const parts=[];
   for(const item of data.output){
    // Reasoning summaries are never translation text; tools/refusals are not
    // part of this text-only protocol and must not yield a partial translation.
    if(item?.type==='reasoning')continue;
    if(item?.type!=='message'||item.role!=='assistant'||item.status!=='completed'||!Array.isArray(item.content)||!item.content.length)throw unavailable();
    for(const part of item.content){if(part?.type!=='output_text'||typeof part.text!=='string')throw unavailable();parts.push(part.text);}
   }
   if(!parts.length)throw unavailable();return parts.join('');
  }
  case 'openai':{
   const choices=data?.choices,message=choices?.[0]?.message;
   if(data?.error||!Array.isArray(choices)||choices.length!==1||choices[0]?.finish_reason!=='stop'||!message||message.role!==undefined&&message.role!=='assistant'||message.refusal||message.function_call!=null||message.tool_calls!=null&&(!Array.isArray(message.tool_calls)||message.tool_calls.length)||typeof message.content!=='string')throw unavailable();
   return message.content;
  }
  case 'anthropic':{
   if(data?.error||data?.role!==undefined&&data.role!=='assistant'||!['end_turn','stop_sequence'].includes(data?.stop_reason)||!Array.isArray(data?.content)||!data.content.length)throw unavailable();
   const parts=[];for(const block of data.content){
    if(block?.type==='text'&&typeof block.text==='string')parts.push(block.text);
    else if(block?.type==='thinking'&&typeof block.thinking==='string'||block?.type==='redacted_thinking'&&typeof block.data==='string')continue;
    else throw unavailable();
   }
   if(!parts.length)throw unavailable();return parts.join('');
  }
  case 'gemini':{
   const candidates=data?.candidates,content=candidates?.[0]?.content,blocked=data?.promptFeedback?.blockReason;
   if(data?.error||blocked&&blocked!=='BLOCK_REASON_UNSPECIFIED'||!Array.isArray(candidates)||candidates.length!==1||candidates[0]?.finishReason!=='STOP'||!content||content.role!==undefined&&content.role!=='model'||!Array.isArray(content.parts)||!content.parts.length)throw unavailable();
   const parts=[];for(const part of content.parts){
    // Thought signatures are metadata on text parts. A tool/media payload may
    // never be silently filtered out of an otherwise plausible translation.
    if(typeof part?.text!=='string'||Object.keys(part).some(key=>!['text','thought','thoughtSignature'].includes(key))||part.thought!==undefined&&typeof part.thought!=='boolean')throw unavailable();
    if(!part.thought)parts.push(part.text);
   }
   if(!parts.length)throw unavailable();return parts.join('');
  }
  case 'google':{const text=data?.data?.translations?.[0]?.translatedText;return typeof text==='string'?decodeGoogleText(text):null;}
  case 'microsoft':return data?.[0]?.translations?.find(x=>x.to==='zh-Hans'||x.to==='zh')?.text;
  case 'deepl':return data?.translations?.[0]?.text;
  default:throw unavailable();
 }
}
async function fetchJSON(url,options,{fetcher,signal,timeoutMs}){
 const controller=new AbortController();const abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
 let rejectAbort;const aborted=new Promise((_,reject)=>{rejectAbort=()=>reject(signal?.aborted?canceled():unavailable());controller.signal.addEventListener('abort',rejectAbort,{once:true});});
 const timer=setTimeout(abort,timeoutMs);
 try{
  if(controller.signal.aborted)throw canceled();
  const response=await Promise.race([fetcher(url,{...options,signal:controller.signal}),aborted]);
  if(!response.ok){
   if(response.status===401||response.status===403)throw Object.assign(Error('所选引擎的 API 密钥或访问权限不可用'),{code:'ENGINE_AUTH',retryable:false});
   if(response.status===429)throw Object.assign(Error('所选翻译引擎限流，请稍后重试'),{code:'RATE_LIMITED',retryable:false});
   throw unavailable();
  }
  if(Number(response.headers.get('content-length'))>256*1024)throw unavailable();
  const reader=response.body?.getReader();if(!reader)throw unavailable();let size=0;const chunks=[];
  try{while(true){const {done,value}=await Promise.race([reader.read(),aborted]);if(done)break;size+=value.byteLength;if(size>256*1024)throw unavailable();chunks.push(value);}}
  finally{void reader.cancel().catch(()=>{});}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  return JSON.parse(new TextDecoder().decode(bytes));
 }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);controller.signal.removeEventListener('abort',rejectAbort);}
}
export async function executeEngineTranslation(profile,text,{fetcher=fetch,signal,timeoutMs=22000}={}){
 try{
  if(signal?.aborted)throw canceled();
  if(typeof text!=='string'||!text.trim()||text.length>20000)throw unavailable();
  const result=[];
  // Native MT APIs accept larger text requests than our bounded AI output budget.
  // 4000 UTF-16 units stay below Google's 5K-code-point recommendation; keep
  // sentence splitting, serial execution and all response/cancellation guards.
  const chunkLimit=['google','microsoft','deepl'].includes(profile.protocol)?4000:1200;
  for(const part of translationChunks(text,chunkLimit)){
   if(signal?.aborted)throw canceled();const {url,options}=requestFor(profile,part);
   const data=await fetchJSON(url,options,{fetcher,signal,timeoutMs});if(signal?.aborted)throw canceled();
   const value=translatedText(profile,data);
   if(typeof value!=='string'||profile.apiKey&&value.includes(profile.apiKey))throw unavailable();
   result.push(clientTranslationText(value,{text:part}));
  }
  return result.join(' ');
 }catch(error){
  if(signal?.aborted||error?.name==='AbortError')throw canceled();
  if(['ENGINE_CONFIG','ENGINE_AUTH','RATE_LIMITED'].includes(error?.code))throw error;
  if(error?.validationReason==='unit-mismatch')throw Object.assign(unavailable(),{message:'译文未保留温度单位，请更换引擎或重试'});
  if(error?.validationReason==='condition-mismatch')throw Object.assign(unavailable(),{message:'译文未通过条件方向校验，请更换引擎或重试'});
  throw unavailable();
 }
}
export async function executeEngineContext(profile,input,{fetcher=fetch,signal,timeoutMs=18000}={}){
 try{
  if(signal?.aborted)throw canceled();
  if(!CONTEXT_PROTOCOLS.includes(profile?.protocol))throw Object.assign(Error('所选配置不支持 AI 语境释义'),{code:'ENGINE_CONFIG',retryable:false});
  let data;try{data=cleanContext({...input,contextRevision:CONTEXT_CURRENT_REVISION});}catch{throw Object.assign(Error('语境请求未通过校验，请重新查词'),{code:'CONTEXT_INVALID_REQUEST',retryable:false});}
  const {url,options}=requestFor(profile,data.sentence,contextPrompt(data)),raw=await fetchJSON(url,options,{fetcher,signal,timeoutMs});
  if(signal?.aborted)throw canceled();
  try{
   if(raw?.status==='incomplete'||raw?.incomplete_details||raw?.choices?.[0]?.finish_reason==='length'||raw?.stop_reason==='max_tokens'||raw?.candidates?.[0]?.finishReason==='MAX_TOKENS')throw Object.assign(Error('Incomplete context'),{validationReason:'incomplete'});
   const text=translatedText(profile,raw);
   if(typeof text!=='string'||profile.apiKey&&text.includes(profile.apiKey)||/^<think(?:\s|>)/iu.test(text.trim()))throw Object.assign(Error('Invalid context text'),{validationReason:'invalid-text'});
   const value=JSON.parse(text.trim().replace(/^```(?:json)?\s*|\s*```$/gu,''));
   const echoesKey=object=>profile.apiKey&&Object.values(object??{}).some(part=>typeof part==='string'&&part.includes(profile.apiKey));
   if(echoesKey(value))throw Object.assign(Error('Invalid context text'),{validationReason:'invalid-text'});
   const result={...parseContextResult(value,data),model:profile.model,provider:profile.preset};
   if(echoesKey(result))throw Object.assign(Error('Invalid context text'),{validationReason:'invalid-text'});
   return result;
  }catch(error){throw Object.assign(Error('所选语境 AI 未返回有效释义，请重试'),{code:'CONTEXT_INVALID_RESULT',retryable:false,validationReason:CONTEXT_VALIDATION_REASONS.includes(error?.validationReason)?error.validationReason:error?.name==='SyntaxError'?'invalid-json':'invalid-shape'});}
 }catch(error){
  if(signal?.aborted||error?.name==='AbortError')throw canceled();
  if(['ENGINE_CONFIG','ENGINE_AUTH','RATE_LIMITED','CONTEXT_INVALID_REQUEST','CONTEXT_INVALID_RESULT'].includes(error?.code))throw error;
  if(error?.name==='SyntaxError')throw Object.assign(Error('所选语境 AI 未返回有效释义，请重试'),{code:'CONTEXT_INVALID_RESULT',retryable:false,validationReason:'invalid-json'});
  throw Object.assign(Error('所选语境 AI 暂不可用，未切换到其他服务'),{code:'CONTEXT_UNAVAILABLE',retryable:false});
 }
}
