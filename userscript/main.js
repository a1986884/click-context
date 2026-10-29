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
import {createSitePolicy,mountSiteControls} from './site-controls.js';

(async()=>{
 if(window.top!==window.self||document.querySelector('lextide-reader'))return;
 if(typeof AbortSignal.any!=='function'||typeof AbortSignal.timeout!=='function'){alert('语境精读：当前浏览器缺少取消请求接口，请升级至 iOS / Safari 17.4 或更新版本。');return;}
 const modern=typeof GM==='object'?GM:null;
 const request=typeof GM_xmlhttpRequest==='function'?details=>GM_xmlhttpRequest(details):modern?.xmlHttpRequest?.bind(modern);
 const getValue=typeof GM_getValue==='function'?async(...args)=>GM_getValue(...args):modern?.getValue?.bind(modern);
 const setValue=typeof GM_setValue==='function'?async(...args)=>GM_setValue(...args):modern?.setValue?.bind(modern);
 const register=typeof GM_registerMenuCommand==='function'?GM_registerMenuCommand:modern?.registerMenuCommand?.bind(modern);
 if(!request||!getValue||!setValue){alert('语境精读：此管理器未提供联网或脚本存储接口，请使用兼容 Tampermonkey 的管理器。');return;}
 const fetcher=createGMFetch(request),store=createStore(createGMAdapter({getValue,setValue,origin:location.origin}));
 const policy=createSitePolicy({getValue,setValue,url:location.href});
 try{await policy.read();}catch{}
 const readPrefs=store.prefs,savePrefs=store.savePrefs;
 let pageLeft=false,accessController=new AbortController(),accessBlocked=false,resumePrefs=null,policyApplied=false;
 store.prefs=async()=>policy.initialPrefs(await readPrefs());
 store.savePrefs=prefs=>pageLeft||policy.state.blocked?Promise.resolve():savePrefs(prefs);
 const lookup=cacheWordLookup(createUserscriptDictionary(fetcher));
 const context=createContextClient({fetcher,revision:CONTEXT_CURRENT_REVISION,endpoint:'https://lextide-context.aa1986884.workers.dev/userscript/meaning'}),translator=createTranslationProvider({fetcher,endpoint:'https://lextide-context.aa1986884.workers.dev/userscript/translate'});
 const info=typeof GM_info==='object'?GM_info:modern?.info;
 const engines=createUserscriptEngines({getValue,setValue,request,info,builtin:translator,builtinContext:context});
 let reader,enginePanel,diagnosticsPanel,currentEngines,introductionAllowed=true,settingsSequence=0;
 async function applyEngines(value){
  if(!reader)return;const sequence=++settingsSequence;
  const bodyChanged=currentEngines.body.cacheKey!==value.body.cacheKey;currentEngines=value;
  if(bodyChanged){if(resumePrefs)resumePrefs={...resumePrefs,enabled:false};await reader.setEnabled(false);}
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
 reader=mountReader({contextRevision:CONTEXT_CURRENT_REVISION,store,canActivate:()=>!policy.state.blocked,activationMessage:()=>policy.state.message,engines:engines.publicSettings(),onOpenEngines:()=>enginePanel.open(),onOpenContextEngines:()=>enginePanel.open(),isAuxiliaryUIEvent:event=>enginePanel?.ownsEvent(event)||diagnosticsPanel?.ownsEvent(event),transport:(type,text,online,options={})=>{
  if(policy.state.blocked)throw Error(policy.state.message);
  options={...options,signal:options.signal?AbortSignal.any([options.signal,accessController.signal]):accessController.signal};
  if(type==='lookup')return lookup(text,{...options,online});
  if(type==='context')return engines.context(options.context,options);
  return engines.translate(type==='selection'?'selection':'body',text,options);
 }});
 enginePanel=mountUserscriptEngineSettings({engines,fallbackFocus:()=>reader.shadow.querySelector('.bubble'),onOpen:()=>{dismissAutomaticIntroduction();diagnosticsPanel.close();},onChange:applyEngines});
 diagnosticsPanel=mountConnectionDiagnostics({diagnostics:createConnectionDiagnostics({fetcher,info}),fallbackFocus:()=>reader.shadow.querySelector('.bubble'),onOpen:()=>{dismissAutomaticIntroduction();enginePanel.close();}});
 await reader.ready;
 async function applyPolicy(state){
  const first=!policyApplied;policyApplied=true;
  if(state.blocked===accessBlocked)return;
  accessBlocked=state.blocked;
  if(state.blocked){accessController.abort();resumePrefs=first&&state.remember&&!state.sensitive?await readPrefs():reader.preferences;await reader.configure({...reader.preferences,words:false,enabled:false});}
  else{accessController=new AbortController();const prefs=resumePrefs||policy.initialPrefs(await readPrefs());resumePrefs=null;await reader.configure(prefs);}
 }
 await applyPolicy(policy.state);
 const siteControls=mountSiteControls({reader,policy,savePrefs:prefs=>savePrefs(resumePrefs||prefs),onPolicyChange:applyPolicy,addListener,removeListener});
 const diagnosticsButton=document.createElement('button');diagnosticsButton.id='connection-diagnostics';diagnosticsButton.type='button';diagnosticsButton.textContent='连接检查 / 诊断';diagnosticsButton.onclick=()=>diagnosticsPanel.open();reader.shadow.querySelector('.panel .row').append(diagnosticsButton);
 register?.('语境精读：阅读设置',()=>{dismissAutomaticIntroduction();enginePanel.close();diagnosticsPanel.close();reader.openSettings();});
 register?.('语境精读：生词本',()=>{dismissAutomaticIntroduction();enginePanel.close();diagnosticsPanel.close();return reader.openVocabulary();});
 register?.('语境精读：引擎 / 我的 API',()=>enginePanel.open());
 register?.('语境精读：连接检查',()=>diagnosticsPanel.open());
 // Register navigation cleanup before optional introduction storage can stall.
 window.addEventListener('pagehide',()=>{pageLeft=true;engineSync.stop();siteControls.stop();dismissAutomaticIntroduction();reader.restore();enginePanel.close({restoreFocus:false});diagnosticsPanel.close({restoreFocus:false});});
 window.addEventListener('pageshow',event=>{if(event.persisted){pageLeft=false;engineSync.start({refreshNow:true});siteControls.start();void siteControls.sync();}});
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
})().catch(()=>{alert('语境精读未能启动，请检查脚本管理器权限后刷新网页。');});
