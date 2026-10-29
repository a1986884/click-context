import {CONTEXT_PROTOCOLS,WEB_TRANSLATION_ENGINES,webTranslationEngine,ENGINE_PRESETS,engineEndpoint} from './src/engine-profiles.js';
import {getExtensionAPI} from './src/browser-api.js';
const chrome=getExtensionAPI(),$=s=>document.querySelector(s);
let settings=null,current=null,savedIDs=new Set(),busy=false;
async function send(type,extra={}){const response=await chrome.runtime.sendMessage({type,...extra});if(!response?.ok)throw Error(response?.error||'扩展连接不可用，请重新打开设置');return response.data;}
function fail(error){$('#error').textContent=error.message;$('#error').hidden=false;}
function option(select,value,text){const item=document.createElement('option');item.value=value;item.textContent=text;select.append(item);}
function active(){return settings.profiles.find(p=>p.id===current);}
function stash(){const p=active();if(!p)return;Object.assign(p,{preset:$('#preset').value,label:$('#name').value,endpoint:$('#endpoint').value,model:$('#model').value,region:$('#region').value,tokenParameter:$('#token-parameter').value,clearKey:$('#clear-key').checked});delete p.protocol;if($('#api-key').value||!p.hasKey)p.apiKey=$('#api-key').value;else delete p.apiKey;}
function protocolFields(){const preset=ENGINE_PRESETS.find(p=>p.id===$('#preset').value),llm=['openai','responses','anthropic','gemini'].includes(preset?.protocol);$('#model-label').hidden=!llm;$('#region-label').hidden=preset?.protocol!=='microsoft';$('#token-label').hidden=preset?.protocol!=='openai';$('#responses-note').hidden=preset?.protocol!=='responses';}
function editor(){const p=active();$('#editor').hidden=!p;$('#remove').disabled=!p;if(!p)return;for(const [id,key] of [['preset','preset'],['name','label'],['endpoint','endpoint'],['model','model'],['region','region']])$('#'+id).value=p[key]||'';$('#token-parameter').value=p.tokenParameter||(p.preset==='openai'?'max_completion_tokens':'max_tokens');$('#api-key').value=p.apiKey||'';$('#api-key').placeholder=p.hasKey?'已保存；留空保留，填写则替换':'填写服务提供的 API 密钥（本机模型可留空）';$('#clear-key').checked=p.clearKey===true;$('#key-state').textContent=p.hasKey?'此配置已有密钥，扩展不会回显。':'此配置尚未保存密钥。';$('#test').disabled=!savedIDs.has(p.id);$('#test-result').textContent='';protocolFields();}
function render(){
 for(const [id,scope] of [['body-engine','body'],['context-engine','context']]){const select=$('#'+id);select.replaceChildren();option(select,'builtin','Cloudflare AI（默认）');if(scope==='body')for(const engine of WEB_TRANSLATION_ENGINES)option(select,engine.id,engine.label);for(const p of settings.profiles)if(scope==='body'||CONTEXT_PROTOCOLS.includes(p.protocol||ENGINE_PRESETS.find(x=>x.id===p.preset)?.protocol))option(select,p.id,p.label||'未命名配置');select.value=settings[scope];}
 const select=$('#profile');select.replaceChildren();for(const p of settings.profiles)option(select,p.id,p.label||'未命名配置');if(!settings.profiles.some(p=>p.id===current))current=settings.profiles[0]?.id||null;select.value=current||'';editor();
}
for(const p of ENGINE_PRESETS)option($('#preset'),p.id,p.name);
$('#profile').onchange=()=>{stash();current=$('#profile').value;editor();};
$('#body-engine').onchange=()=>{settings.body=$('#body-engine').value;settings.selection=settings.body;};$('#context-engine').onchange=()=>{settings.context=$('#context-engine').value;};
$('#preset').onchange=()=>{const p=ENGINE_PRESETS.find(p=>p.id===$('#preset').value);$('#endpoint').value=p.endpoint;$('#name').value=p.name;$('#api-key').value='';$('#token-parameter').value=p.id==='openai'?'max_completion_tokens':'max_tokens';protocolFields();};
$('#add').onclick=()=>{stash();if(settings.profiles.length>=20){fail(Error('最多保存20个配置'));return;}const p={id:crypto.randomUUID(),preset:'custom',label:'新的 API 配置',endpoint:'',model:'',region:'',hasKey:false};settings.profiles.push(p);current=p.id;render();$('#name').focus();};
$('#remove').onclick=()=>{settings.profiles=settings.profiles.filter(p=>p.id!==current);if(settings.body===current)settings.body='builtin';if(settings.selection===current)settings.selection=settings.body;if(settings.context===current)settings.context='builtin';current=null;render();};
$('#settings').onsubmit=async event=>{
 event.preventDefault();if(busy)return;busy=true;$('#error').hidden=true;stash();$('#controls').disabled=true;$('#status').textContent='正在保存…';
 try{
  // Request from this trusted page's user gesture, before any asynchronous work.
  settings.selection=settings.body;
  const webProfiles=[settings.body].map(webTranslationEngine).filter(Boolean);
  const origins=[...new Set([...settings.profiles,...webProfiles].map(p=>{const u=new URL(engineEndpoint(p.endpoint));return u.protocol+'//'+u.hostname+'/*';}))];
  const granted=origins.length?await chrome.permissions.request({origins}):true;if(!granted)throw Error('服务主机未授权，配置未保存');
  $('#controls').disabled=true;settings=await send('engines:save',{settings});savedIDs=new Set(settings.profiles.map(p=>p.id));render();$('#status').textContent='已保存。查词 AI 与翻译引擎分别生效。';
 }catch(error){fail(error);$('#status').textContent='未保存，原有配置保持。';}finally{busy=false;$('#controls').disabled=false;}
};
$('#test').onclick=async()=>{if(busy||!active())return;busy=true;$('#controls').disabled=true;$('#test').disabled=true;$('#error').hidden=true;$('#test-result').textContent='正在用公共示例测试已保存配置…';try{const r=await send('engines:test',{id:current});$('#test-result').textContent=r.label+' · '+r.elapsedMs+' ms\n'+r.text;$('#status').textContent='本次公共示例请求完成；不是通用准确率保证。';}catch(error){$('#test-result').textContent='测试未通过';fail(error);}finally{busy=false;$('#controls').disabled=false;$('#test').disabled=!savedIDs.has(current);}};
try{settings=await send('engines:get');savedIDs=new Set(settings.profiles.map(p=>p.id));render();$('#controls').disabled=false;$('#status').textContent='设置仅在扩展中管理，API 密钥不进入网页。';}catch(error){fail(error);$('#status').textContent='无法读取设置，未重置已有配置。';}
