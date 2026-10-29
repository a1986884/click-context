import {CONTEXT_PROTOCOLS,WEB_TRANSLATION_ENGINES,ENGINE_PRESETS} from './src/engine-profiles.js';
// A public UI preview: no credentials, persistence, runtime impersonation or
// provider requests. Real API configuration stays in the extension's origin.
const $=id=>document.getElementById(id),add=(select,value,label)=>{const o=document.createElement('option');o.value=value;o.textContent=label;select.append(o);};
$('controls').disabled=false;$('editor').hidden=false;
for(const id of ['context-engine','body-engine']){add($(id),'builtin','Cloudflare AI（默认）');if(id==='body-engine')for(const p of WEB_TRANSLATION_ENGINES)add($(id),p.id,p.label);for(const p of ENGINE_PRESETS)if(id==='body-engine'||CONTEXT_PROTOCOLS.includes(p.protocol))add($(id),p.id,p.name);}
for(const p of ENGINE_PRESETS)add($('preset'),p.id,p.name);
add($('profile'),'example','服务配置示意');$('profile').disabled=true;
for(const id of ['api-key','clear-key','add','remove','save','test'])$(id).disabled=true;
$('api-key').placeholder='请在已安装的插件中填写密钥';$('api-key').value='';$('endpoint').readOnly=true;
$('key-state').textContent='网页预览不接收或保存真实密钥。安装插件后，在工具栏 → 翻译引擎 / 我的 API 中配置。';
$('status').textContent='API 设置界面预览：可查看服务和切换两侧选择，不会应用到阅读页面，不保存或发送配置。';
$('settings').onsubmit=e=>e.preventDefault();
function show(){const p=ENGINE_PRESETS.find(p=>p.id===$('preset').value);$('name').value=p.name;$('endpoint').value=p.endpoint;$('model-label').hidden=!['openai','responses','anthropic','gemini'].includes(p.protocol);$('region-label').hidden=p.protocol!=='microsoft';$('token-label').hidden=p.protocol!=='openai';$('responses-note').hidden=p.protocol!=='responses';$('token-parameter').value=p.id==='openai'?'max_completion_tokens':'max_tokens';}
$('preset').onchange=show;show();
