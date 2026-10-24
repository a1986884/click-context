import {createDialogFocus} from './dialog-focus.js';
import {dictionaryDocumentView} from '../src/dictionary-dom-view.js';
import {extractDictionary} from '../src/dictionary-extract.js';
import {USERSCRIPT_VERSION} from './version.js';
import {supportsSafeAPIRedirect} from './engines.js';
const checks=Object.freeze([
 {name:'context',url:'https://lextide-context.aa1986884.workers.dev/userscript/meaning',method:'POST'},
 {name:'translation',url:'https://lextide-context.aa1986884.workers.dev/userscript/translate',method:'POST'},
 {name:'dictionary-source',url:'https://dict.youdao.com/w/eng/class/',method:'GET'},
 {name:'dictionary',url:'https://v04-preview.lextide.pages.dev/api/dictionary?word=class',method:'GET'}
]);
export function diagnosticCapabilities(info){
 const manager=['Tampermonkey','Violentmonkey','Userscripts','ScriptCat'].includes(info?.scriptHandler)?info.scriptHandler:'unknown';
 const version=typeof info?.version==='string'&&/^\d+(?:\.\d+){0,4}(?:[ab.-][a-z0-9]+)?$/i.test(info.version)&&info.version.length<=64?info.version:'unknown';
 return {userscriptVersion:USERSCRIPT_VERSION,manager,managerVersion:version,customAPIRedirectSupported:supportsSafeAPIRedirect({scriptHandler:manager,version}),nativeKeyPromptAvailable:typeof globalThis.prompt==='function',nativeHostConfirmAvailable:typeof globalThis.confirm==='function',diagnosticScope:'builtin-connectivity-only',inferenceTested:false,includesKeys:false,includesPageText:false,includesPageURL:false,actualManagerInstallVerified:false};
}
export function createConnectionDiagnostics({fetcher,info,now=()=>new Date().toISOString()}){
 return {capabilities:()=>diagnosticCapabilities(info),async run({signal}={}){
  signal?.throwIfAborted();
  const results=await Promise.all(checks.map(async check=>{
   try{
    const response=await fetcher(check.url,{method:check.method,signal,...(check.method==='POST'?{headers:{'Content-Type':'application/json'},body:'{}'}:{})});
    signal?.throwIfAborted();
    let status=response.status===403||response.status===401?'denied':response.status===429?'rate-limited':'unexpected-response';
    let dictionarySenses;
    if(check.method==='POST'&&response.status===400)status='reachable';
    if(check.name==='dictionary-source'&&response.status===200){
     try{const entry=extractDictionary(dictionaryDocumentView(new DOMParser().parseFromString(await response.text(),'text/html'),{stripLabels:true}),'youdao-senses');dictionarySenses=entry.head?.toLowerCase()==='class'?Math.min(64,entry.senses.filter(s=>!s.reference).length):0;}catch{dictionarySenses=0;}
     status=dictionarySenses?'reachable':'dictionary-unavailable';
    }
    if(check.name==='dictionary'&&response.status===200){const data=await response.json();dictionarySenses=data?.ok&&Array.isArray(data.data?.senses)?Math.min(64,data.data.senses.length):0;status=dictionarySenses?'reachable':'dictionary-unavailable';}
    return {name:check.name,status,httpStatus:Number.isInteger(response.status)?response.status:null,...(dictionarySenses!==undefined?{dictionarySenses}:{})};
   }catch(error){signal?.throwIfAborted();return {name:check.name,status:error?.code==='REQUEST_TIMEOUT'?'timeout':'network-error',httpStatus:null};}
  }));
  signal?.throwIfAborted();return {...diagnosticCapabilities(info),checkedAt:now(),checks:results,allReachable:results.every(r=>r.status==='reachable')};
 }};
}
export function mountConnectionDiagnostics({diagnostics,onOpen=()=>{},fallbackFocus}){
 const host=document.createElement('click-context-diagnostics');document.body.append(host);host.hidden=true;
 const root=host.attachShadow({mode:'closed'});let controller=null,sequence=0,last=null;
 root.innerHTML=`<style>:host{position:fixed;inset:0;z-index:2147483647;background:#0005;font:15px/1.7 system-ui;color:#173e39}*{box-sizing:border-box}[hidden]{display:none!important}section{position:absolute;inset:12px;max-width:700px;margin:auto;background:#f7faf7;border-radius:16px;padding:20px;overflow:auto;overscroll-behavior:contain;scroll-padding-top:80px}header{position:sticky;top:-20px;z-index:2;background:#f7faf7;display:flex;justify-content:space-between;gap:12px}h2{font-size:22px;margin:0}button,textarea{font:inherit;color:inherit;border:1px solid #bad0c5;border-radius:8px;background:white;padding:10px}button{min-height:44px;cursor:pointer}button:disabled{opacity:.5}textarea{display:block;width:100%;height:240px;font:13px/1.6 monospace;resize:vertical}.row{display:flex;gap:10px;flex-wrap:wrap}li{margin:8px 0}small{color:#526e68}</style><section role="dialog" aria-modal="true" aria-label="连接检查"><header><h2>连接检查</h2><button id="close">关闭</button></header><p id="capabilities"></p><p>只在你点击检查后请求内置接口：两次空内容接口探测，以及公开单词 class 的直接来源和备用词条接口各一次查询。探测内容不含当前网页原文、完整网址或 API 密钥，也不会测试你的自带 API。</p><div class="row"><button id="run">检查内置连接</button><button id="copy">复制诊断</button></div><p id="status" role="status"></p><ul id="results"></ul><label for="report">诊断信息（不含密钥或原文）</label><textarea id="report" readonly spellcheck="false"></textarea><p><small>接口可达不代表翻译一定成功或准确，也不代表已通过 iPhone 真机验收。复制失败时可长按下方文本手动复制。</small></p></section>`;
 const $=s=>root.querySelector(s),labels={context:'语境释义接口',translation:'正文 / 选文接口','dictionary-source':'Collins 直接词条来源',dictionary:'Collins 备用词条接口'},statusLabels={reachable:'可达',denied:'访问被拒绝', 'rate-limited':'请求限流','unexpected-response':'响应异常','dictionary-unavailable':'连接成功，词典义项不可用',timeout:'请求超时，请重试','network-error':'连接失败，请检查管理器权限与网络'};
 const focus=createDialogFocus({host,root,initialFocus:()=>$('#close'),onEscape:()=>close(),fallbackFocus});
 function render(report){$('#report').value=JSON.stringify(report,null,2);$('#results').replaceChildren();for(const item of report.checks||[]){const li=document.createElement('li');li.textContent=labels[item.name]+'：'+statusLabels[item.status]+(item.httpStatus?'（HTTP '+item.httpStatus+'）':'');$('#results').append(li);}}
 function close({restoreFocus=true}={}){sequence++;controller?.abort();controller=null;host.hidden=true;$('#run').disabled=false;focus.close({restoreFocus});}
 $('#close').onclick=close;
 $('#run').onclick=async()=>{if(controller)return;const id=++sequence;controller=new AbortController();$('#run').disabled=true;$('#status').textContent='正在检查内置连接…';try{const report=await diagnostics.run({signal:controller.signal});if(id!==sequence)return;last=report;render(report);$('#status').textContent=report.allReachable?'内置接口可达；未验证 AI 释义或翻译。':'部分连接检查未通过；未验证 AI 释义或翻译。';}catch{if(id===sequence)$('#status').textContent='检查未完成，请重试。';}finally{if(id===sequence){controller=null;$('#run').disabled=false;}}};
 $('#copy').onclick=async()=>{try{await navigator.clipboard.writeText($('#report').value);$('#status').textContent='已复制诊断，不含密钥或阅读原文。';}catch{$('#report').focus();$('#report').select();$('#status').textContent='未能自动复制，请长按诊断文本手动复制。';}};
 return {ownsEvent:event=>event.composedPath?.().includes(host)||false,open(){onOpen();host.hidden=false;focus.open();const capabilities=diagnostics.capabilities();$('#capabilities').textContent='脚本 '+capabilities.userscriptVersion+' · 管理器 '+capabilities.manager+' '+capabilities.managerVersion+' · 自带 API：'+(capabilities.customAPIRedirectSupported?'已确认重定向接口支持':'当前管理器未确认支持；内置服务可用性尚未验证');render(last||capabilities);$('#status').textContent=last?'显示上次检查结果（仅连接）；不会自动重测。':'尚未检查；打开此界面不会联网。';},close,destroy(){close();focus.destroy();host.remove();}};
}
