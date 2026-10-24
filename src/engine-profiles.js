import {CLIENT_TRANSLATION_CACHE_VERSION} from './translation-client-validation.js';
// Service presets are API configurations, not a claim about another product's membership.
export const ENGINE_PRESETS=Object.freeze([
 {id:'openai',name:'OpenAI',protocol:'openai',endpoint:'https://api.openai.com/v1/chat/completions'},
 {id:'openai-responses',name:'OpenAI Responses / 兼容接口',protocol:'responses',endpoint:'https://api.openai.com/v1/responses'},
 {id:'anthropic',name:'Anthropic / Claude',protocol:'anthropic',endpoint:'https://api.anthropic.com/v1/messages'},
 {id:'gemini',name:'Google Gemini',protocol:'gemini',endpoint:'https://generativelanguage.googleapis.com/v1beta'},
 {id:'deepseek',name:'DeepSeek',protocol:'openai',endpoint:'https://api.deepseek.com/chat/completions'},
 {id:'qwen',name:'通义千问 / 百炼',protocol:'openai',endpoint:'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'},
 {id:'moonshot',name:'Moonshot / Kimi',protocol:'openai',endpoint:'https://api.moonshot.cn/v1/chat/completions'},
 {id:'zhipu',name:'智谱 / GLM',protocol:'openai',endpoint:'https://open.bigmodel.cn/api/paas/v4/chat/completions'},
 {id:'doubao',name:'豆包 / 火山方舟',protocol:'openai',endpoint:'https://ark.cn-beijing.volces.com/api/v3/chat/completions'},
 {id:'grok',name:'xAI / Grok',protocol:'openai',endpoint:'https://api.x.ai/v1/chat/completions'},
 {id:'plamo',name:'PLaMo / Preferred Networks',protocol:'openai',endpoint:'https://api.platform.preferredai.jp/v1/chat/completions'},
 {id:'siliconflow',name:'硅基流动',protocol:'openai',endpoint:'https://api.siliconflow.cn/v1/chat/completions'},
 {id:'ollama',name:'Ollama（本机）',protocol:'openai',endpoint:'http://localhost:11434/v1/chat/completions'},
 {id:'google',name:'Google Cloud Translation',protocol:'google',endpoint:'https://translation.googleapis.com/language/translate/v2'},
 {id:'microsoft',name:'Microsoft Translator',protocol:'microsoft',endpoint:'https://api.cognitive.microsofttranslator.com/translate'},
 {id:'deepl',name:'DeepL API',protocol:'deepl',endpoint:'https://api-free.deepl.com/v2/translate'},
 {id:'custom',name:'自定义 OpenAI 兼容 API',protocol:'openai',endpoint:''}
]);
export const CONTEXT_PROTOCOLS=Object.freeze(['openai','responses','anthropic','gemini']);
export const DEFAULT_ENGINE_SETTINGS=Object.freeze({schema:1,body:'builtin',selection:'builtin',context:'builtin',profiles:[]});
const BUILTIN=Object.freeze({id:'builtin',label:'Cloudflare AI',cacheKey:CLIENT_TRANSLATION_CACHE_VERSION,minInterval:1200});
const BUILTIN_CONTEXT=Object.freeze({id:'builtin',label:'Cloudflare AI',cacheKey:'context:builtin:v1'});
const llm=new Set(CONTEXT_PROTOCOLS);
export function engineEndpoint(value){
 if(typeof value!=='string'||value.length>2048)throw Error('请输入有效的 API 地址');
 let url;try{url=new URL(value);}catch{throw Error('请输入完整的 API 地址');}
 const loopback=['localhost','127.0.0.1','[::1]'].includes(url.hostname);
 if(url.username||url.password||url.search||url.hash||url.protocol!=='https:'&&!(url.protocol==='http:'&&loopback))throw Error('API 地址需为 HTTPS（本机可用 HTTP），不能含密钥、查询参数或片段');
 return url.href;
}
export function normalizeEngineSettings(input={},previous=DEFAULT_ENGINE_SETTINGS){
 if(!input||typeof input!=='object'||!Array.isArray(input.profiles)||input.profiles.length>20)throw Error('无效引擎配置');
 const seen=new Set();const profiles=input.profiles.map(item=>{
  if(!item||typeof item.id!=='string'||!/^[\w-]{1,64}$/.test(item.id)||item.id==='builtin'||seen.has(item.id))throw Error('引擎配置 ID 无效或重复');seen.add(item.id);
  const preset=ENGINE_PRESETS.find(x=>x.id===item.preset);if(!preset||item.protocol&&item.protocol!==preset.protocol)throw Error('无效引擎协议');
  const old=previous.profiles.find(x=>x.id===item.id),endpoint=engineEndpoint(item.endpoint??preset.endpoint);
  const label=typeof item.label==='string'?item.label.trim():preset.name,model=typeof item.model==='string'?item.model.trim():'';
  if(!label||label.length>64||/[\u0000-\u001f]/u.test(label)||model.length>160||/[\u0000-\u001f]/u.test(model)||llm.has(preset.protocol)&&!model)throw Error('请填写引擎名称和正确的模型 ID');
  const suppliedKey=typeof item.apiKey==='string';
  if(old?.apiKey&&new URL(old.endpoint).origin!==new URL(endpoint).origin&&!suppliedKey&&!item.clearKey)throw Error('更换 API 地址后请重新填写密钥');
  const apiKey=item.clearKey?'':suppliedKey?item.apiKey:old?.apiKey||'';
  if(apiKey.length>8192||/[\u0000-\u001f\u007f]/u.test(apiKey)||apiKey.length>=8&&label.includes(apiKey))throw Error('无效密钥，密钥不能出现在引擎名称中');
  let decoded;try{decoded=decodeURIComponent(endpoint);}catch{throw Error('API 地址编码无效');}
  if(apiKey.length>=8&&decoded.includes(apiKey))throw Error('API 地址中不能包含密钥');
  const region=typeof item.region==='string'?item.region.trim():'';if(region&&!/^[A-Za-z0-9-]{1,64}$/.test(region))throw Error('无效 Microsoft 区域');
  const tokenParameter=item.tokenParameter??old?.tokenParameter??(preset.id==='openai'?'max_completion_tokens':'max_tokens');
  if(!['max_tokens','max_completion_tokens'].includes(tokenParameter))throw Error('无效输出令牌参数');
  const value={id:item.id,preset:preset.id,protocol:preset.protocol,label,endpoint,model,region,apiKey,tokenParameter};
  const same=old&&Object.keys(value).every(key=>value[key]===old[key]);return {...value,cacheRevision:same?old.cacheRevision:crypto.randomUUID()};
 });
 const body=input.body??previous.body,selection=input.selection??previous.selection,context=input.context??previous.context??'builtin';
 for(const id of [body,selection,context])if(id!=='builtin'&&!seen.has(id))throw Error('请选择仍存在的引擎配置');
 if(context!=='builtin'&&!llm.has(profiles.find(p=>p.id===context).protocol))throw Error('语境释义需要 AI 配置；Google、Microsoft 和 DeepL 仅用于正文或选文翻译');
 return {schema:1,body,selection,context,profiles};
}
function publicProfile(profile){return {id:profile.id,label:profile.label,cacheKey:'engine:'+profile.id+':'+profile.cacheRevision+':en-zh:v6',minInterval:llm.has(profile.protocol)?250:100};}
export function publicEngineSettings(state=DEFAULT_ENGINE_SETTINGS){
 const profiles=[BUILTIN,...state.profiles.map(publicProfile)],selected=state.profiles.find(p=>p.id===state.context);
 const context=selected?{...publicProfile(selected),cacheKey:'context:'+selected.id+':'+selected.cacheRevision+':v1'}:BUILTIN_CONTEXT;
 return {body:profiles.find(x=>x.id===state.body),selection:profiles.find(x=>x.id===state.selection),context,profiles};
}
export function engineSettingsForUI(state){return {schema:state.schema,body:state.body,selection:state.selection,context:state.context??'builtin',profiles:state.profiles.map(({apiKey,cacheRevision,...p})=>({...p,hasKey:Boolean(apiKey)}))};}
