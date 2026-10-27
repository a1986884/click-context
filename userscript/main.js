import {mountReader} from '../src/reader.js';
import {createStore} from '../src/storage.js';
import {createContextClient,CONTEXT_CURRENT_REVISION} from '../src/context-meaning.js';
import {createTranslationProvider} from '../src/providers.js';
import {cacheWordLookup} from '../src/dictionary-cache.js';
import {createGMAdapter,createGMFetch} from './gm-adapter.js';
import {createUserscriptDictionary} from './dictionary.js';
import {createUserscriptEngines} from './engines.js';
import {createEngineSettingsSync} from './engine-sync.js';
import {mountUserscriptEngineSettings} from './engine-settings.js';
import {createConnectionDiagnostics,mountConnectionDiagnostics} from './diagnostics.js';
import {USERSCRIPT_VERSION} from './version.js';

(async()=>{
 if(window.top!==window.self||document.querySelector('lextide-reader'))return;
 if(typeof AbortSignal.any!=='function'||typeof AbortSignal.timeout!=='function'){alert('点击语境查词：当前浏览器缺少取消请求接口，请升级至 iOS / Safari 17.4 或更新版本。');return;}
 const modern=typeof GM==='object'?GM:null;
 const request=typeof GM_xmlhttpRequest==='function'?details=>GM_xmlhttpRequest(details):modern?.xmlHttpRequest?.bind(modern);
 const getValue=typeof GM_getValue==='function'?async(...args)=>GM_getValue(...args):modern?.getValue?.bind(modern);
 const setValue=typeof GM_setValue==='function'?async(...args)=>GM_setValue(...args):modern?.setValue?.bind(modern);
 const register=typeof GM_registerMenuCommand==='function'?GM_registerMenuCommand:modern?.registerMenuCommand?.bind(modern);
 if(!request||!getValue||!setValue){alert('点击语境查词：此管理器未提供联网或脚本存储接口，请使用兼容 Tampermonkey 的管理器。');return;}
 const fetcher=createGMFetch(request),store=createStore(createGMAdapter({getValue,setValue,origin:location.origin}));
 const readPrefs=store.prefs;
 // Every page load starts offline in the product sense: no lookup or body work
 // until the user enables it. Saved layout preferences remain available.
 store.prefs=async()=>({...await readPrefs(),words:false,enabled:false,mode:'original'});
 const lookup=cacheWordLookup(createUserscriptDictionary(fetcher));
 const context=createContextClient({fetcher,revision:CONTEXT_CURRENT_REVISION,endpoint:'https://lextide-context.aa1986884.workers.dev/userscript/meaning'}),translator=createTranslationProvider({fetcher,endpoint:'https://lextide-context.aa1986884.workers.dev/userscript/translate'});
 const info=typeof GM_info==='object'?GM_info:modern?.info;
 const engines=createUserscriptEngines({getValue,setValue,request,info,builtin:translator,builtinContext:context});
 let reader,enginePanel,diagnosticsPanel,currentEngines,introductionAllowed=true,settingsSequence=0;
 async function applyEngines(value){
  if(!reader)return;const sequence=++settingsSequence;
  const bodyChanged=currentEngines.body.cacheKey!==value.body.cacheKey;currentEngines=value;
  if(bodyChanged)await reader.setEnabled(false);
  if(sequence!==settingsSequence)return;
  await reader.configureEngines(engines.publicSettings(),{restart:false});
 }
 const addListener=typeof GM_addValueChangeListener==='function'?GM_addValueChangeListener:modern?.addValueChangeListener?.bind(modern);
 const removeListener=typeof GM_removeValueChangeListener==='function'?GM_removeValueChangeListener:modern?.removeValueChangeListener?.bind(modern);
 const engineSync=createEngineSettingsSync({addListener,removeListener,engines,onChange:applyEngines});engineSync.start();
 try{await engines.read();}catch{/* Dictionary stays usable; text/context routing fail closed until settings recover. */}
 currentEngines=engines.publicSettings();
 function clearIntroductionListeners(){document.removeEventListener('pointerdown',dismissAutomaticIntroduction,true);document.removeEventListener('keydown',dismissAutomaticIntroduction,true);}
 function dismissAutomaticIntroduction(){introductionAllowed=false;clearIntroductionListeners();}
 reader=mountReader({contextRevision:CONTEXT_CURRENT_REVISION,store,engines:engines.publicSettings(),onOpenEngines:()=>enginePanel.open(),onOpenContextEngines:()=>enginePanel.open(),isAuxiliaryUIEvent:event=>enginePanel?.ownsEvent(event)||diagnosticsPanel?.ownsEvent(event),transport:(type,text,online,options={})=>{
  if(type==='lookup')return lookup(text,{...options,online});
  if(type==='context')return engines.context(options.context,options);
  return engines.translate(type==='selection'?'selection':'body',text,options);
 }});
 enginePanel=mountUserscriptEngineSettings({engines,fallbackFocus:()=>reader.shadow.querySelector('.bubble'),onOpen:()=>{dismissAutomaticIntroduction();diagnosticsPanel.close();},onChange:applyEngines});
 diagnosticsPanel=mountConnectionDiagnostics({diagnostics:createConnectionDiagnostics({fetcher,info}),fallbackFocus:()=>reader.shadow.querySelector('.bubble'),onOpen:()=>{dismissAutomaticIntroduction();enginePanel.close();}});
 await reader.ready;
 const note=document.createElement('p');note.className='muted';note.textContent='油猴试用版 '+USERSCRIPT_VERSION+' · 每次打开网页默认关闭。开启后，单词发给有道公开词条，原句和候选词义发给你选择的语境 AI（默认内置 Cloudflare AI）；词条栏目不可读时会查询预览词条 API。点词语境、选文和正文分别选择服务，发送各自需要的文本，不自动切换。生词与 API 配置保存在脚本管理器中。';
 reader.shadow.querySelector('.panel .top').after(note);
 const diagnosticsButton=document.createElement('button');diagnosticsButton.id='connection-diagnostics';diagnosticsButton.type='button';diagnosticsButton.textContent='连接检查 / 诊断';diagnosticsButton.onclick=()=>diagnosticsPanel.open();reader.shadow.querySelector('.panel .row').append(diagnosticsButton);
 register?.('点击语境查词：阅读设置',()=>{dismissAutomaticIntroduction();enginePanel.close();diagnosticsPanel.close();reader.openSettings();});
 register?.('点击语境查词：生词本',()=>{dismissAutomaticIntroduction();enginePanel.close();diagnosticsPanel.close();return reader.openVocabulary();});
 register?.('点击语境查词：引擎 / 我的 API',()=>enginePanel.open());
 register?.('点击语境查词：连接检查',()=>diagnosticsPanel.open());
 // Register navigation cleanup before optional introduction storage can stall.
 let pageLeft=false;
 window.addEventListener('pagehide',()=>{pageLeft=true;engineSync.stop();dismissAutomaticIntroduction();reader.restore();enginePanel.close({restoreFocus:false});diagnosticsPanel.close({restoreFocus:false});});
 window.addEventListener('pageshow',event=>{if(event.persisted){pageLeft=false;engineSync.start({refreshNow:true});}});
 // Explain network use once; subsequent pages keep only the disabled floating button.
 // This advisory flag must not turn a usable reader into a startup failure.
 let showIntroduction=false;
 // Observe only whether the user has acted; never inspect event data.
 document.addEventListener('pointerdown',dismissAutomaticIntroduction,{capture:true,once:true});
 document.addEventListener('keydown',dismissAutomaticIntroduction,{capture:true,once:true});
 try{showIntroduction=!await getValue('click-context:v1:introduced',false);}catch{/* Leave the unread flag untouched; settings always include the network notice. */}finally{clearIntroductionListeners();}
 if(showIntroduction&&!pageLeft&&introductionAllowed){
  reader.openSettings();
  try{await setValue('click-context:v1:introduced',true);}catch{/* Do not reset storage or retry a write which may have completed. */}
 }
})().catch(()=>{alert('点击语境查词未能启动，请检查脚本管理器权限后刷新网页。');});
