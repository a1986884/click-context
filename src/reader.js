import {phraseAt,phraseLemma} from './phrases.js';
import {matchesDictionaryGloss} from './context-gloss.js';
import {vocabularyKey} from './vocabulary-data.js';
import {mountVocabulary} from './vocabulary-view.js';
import {lookup,translate,wordAt} from './core.js';
import {demoStore,DEFAULT_PREFS} from './storage.js';
import {ParagraphTranslator} from './translation.js';
import {readerCSS} from './reader-style.js';
import {visibleViewport,dictionaryBounds,movableBounds} from './viewport.js';
import {parseContextResult,resolveContext} from './context-meaning.js';
import {proseBlock,proseSnapshot,selectedContext,sentenceContext,snapshotContext} from './selection-context.js';
import {readableSelection} from './selection-translation.js';
import {publicEngineSettings} from './engine-profiles.js';
export function sentenceAt(text,word,offset=text.toLowerCase().indexOf(word.toLowerCase())){return sentenceContext(text,offset,word.length).sentence;}
function readablePOS(pos=''){return /^N(?:-|$)/.test(pos)?'名词':/^V(?:-|$)/.test(pos)?'动词':/^ADJ/.test(pos)?'形容词':/^ADV/.test(pos)?'副词':pos==='PHRASE'?'短语':pos;}
export function mountReader({root=document.body,transport=async(type,text,online,options)=>type==='lookup'?lookup(text,{online,...options}):type==='context'?resolveContext(options.context,options):translate(text,fetch,options),demo=false,store=demoStore(),schedulerOptions={},onOpenVocabulary,onOpenEngines,onOpenContextEngines,isAuxiliaryUIEvent=()=>false,engines=publicEngineSettings(),dictionaryNotice='Collins 英汉双解（有道公开词条）'}={}){
 const host=document.createElement('lextide-reader');document.body.append(host);const shadow=host.attachShadow({mode:'open'});
 shadow.innerHTML=`<style>${readerCSS}</style>
 <section class="panel" hidden role="dialog" aria-label="点击语境查词阅读设置"><div class="top"><b>点击语境查词 · 阅读设置</b><button class="close" aria-label="关闭设置">×</button></div>
 <p class="muted" id="engine-summary"></p><button id="engine-settings" type="button" hidden>选择翻译引擎 / 配置 API ↗</button>
 <label>翻译显示 <select id="mode" aria-label="翻译显示方式"><option value="original">原文模式</option><option value="bilingual">双语模式</option><option value="translated">译文模式</option></select></label>
 <label><input id="words" type="checkbox"> 查词（开启时链接不跳转）</label><label><input id="bilingual-enabled" type="checkbox"> 正文双语翻译</label>
 <label>双语对照 <select id="translation-unit" aria-label="双语对照单位"><option value="paragraph">逐段对照</option><option value="sentence">逐句对照（适合长段落）</option></select></label><p class="muted">逐句时每个英文句子后显示中文；仅适用于双语模式。</p>
 <p class="muted">单词来自 <span class="dictionary-notice"></span>；点词原句交由 Cloudflare AI 分析；正文与选文使用上方所列引擎。</p>
 <label>小球默认位置 <select id="side" aria-label="小球位置"><option value="right">右侧</option><option value="left">左侧</option></select></label>
 <div class="row"><button id="reset-bubble">重置图标位置</button><button id="retry-all">重试失败翻译</button><button id="clear-cache">清除翻译缓存</button><button id="vocabulary">我的生词本</button></div><p id="status" role="status" class="muted"></p></section>
 <section class="dict" role="dialog" aria-label="单词释义" hidden>
 <div class="dict-handle" tabindex="0" role="group" aria-label="移动查词卡片，可拖动或用方向键移动"><span class="card-brand"><span aria-hidden="true">⠿</span> 点击语境查词 <span class="drag-hint">拖动小窗</span></span><div class="card-controls"><button id="collapse-dict" aria-label="收起释义" aria-expanded="true" title="收起，继续阅读">−</button><button class="close" aria-label="关闭释义" title="关闭（Esc）">×</button></div></div>
 <div class="mini-result" hidden><strong class="mini-word"></strong><span class="mini-meaning"></span></div>
 <div class="dict-title"><div class="word-heading"><h2 class="word"></h2><button id="speak" title="朗读单词" aria-label="朗读单词">朗读</button></div><div class="word-meta"><span class="phonetic muted"></span><span class="dictionary-label"></span></div></div><div class="dict-body">
 <div class="context-focus"><p class="sentence"></p><p class="zh" role="status"></p><p class="sense-status muted" role="status"></p></div><label class="sense-picker" hidden><span class="sr-only">查看其他义项</span><select id="sense-choice" aria-label="Collins 义项"></select></label><div class="defs"></div>
 <details class="entry-details"><summary>来源与词条详情</summary><small class="zh-source"></small><p class="morphology muted"></p><p class="related muted"></p><p class="source muted"></p></details></div>
 <div class="dict-actions"><button id="save">收藏</button><button id="retry" hidden>重试</button><button id="context-engine-settings" hidden>语境 AI 设置</button><button id="reset-dict" hidden title="恢复自动摆放">自动位置</button></div></section>
 <section class="vocab" role="dialog" aria-label="我的生词本" hidden><div class="top"><b>我的生词本</b><button class="close" aria-label="关闭生词本">×</button></div></section>
 <section class="selection-card" hidden role="dialog" aria-label="选文翻译"><div class="top"><b>选文翻译</b><button id="close-selection" aria-label="关闭选文翻译">×</button></div><p id="selection-provider" class="muted"></p><p id="selection-original"></p><p id="selection-result" role="status" aria-live="polite"></p><button id="retry-selection" hidden>重试选文翻译</button></section>
 <button id="lookup-selection" class="selection-action" hidden>查词 / 短语</button><button id="translate-selection" class="selection-action" hidden>翻译选文</button><div class="tool-dock"><button class="bubble" aria-label="切换点击查词" aria-expanded="false" aria-pressed="false" title="点击开关查词；长按设置">查词</button></div>`;
 shadow.querySelector('.dictionary-notice').textContent=dictionaryNotice;
 const $=s=>shadow.querySelector(s),bubble=$('.bubble');let prefs={...DEFAULT_PREFS,online:true},destroyed=false,requestId=0,active='',lastFocus=null,lookupController=null,lastEntry=null,context='',cardPoint=null,contextOffset=null,pendingSelection=null,manualPosition=null,drag=null,selectionFrame=null;
 let lookupInFlight=null,pausedFeatures=null,toggleQueue=Promise.resolve();
 let saveFailure=null,favoriteResumeQueued=false,saveReady=false,savedRevision=0,savedKeys=new Set();const savingKeys=new Set();
 function renderSave(){const key=lastEntry?vocabularyKey(lastEntry):null,pending=key&&savingKeys.has(key);$('#save').disabled=!saveReady||!lastEntry?.zh||Boolean(pending);$('#save').textContent=pending?'保存中…':key&&savedKeys.has(key)?'已收藏':'收藏';}
 async function refreshSaved(id){const revision=savedRevision;try{const words=await store.words();if(destroyed||id!==requestId||revision!==savedRevision)return;savedKeys=new Set(words.map(vocabularyKey));renderSave();}catch{/* Favorite status is optional; a read failure must not hide dictionary results. */}}
 function resumeFavorites(){
  if(destroyed||($('.dict').hidden||!lastEntry)&&$('.vocab').hidden)return;
  savedRevision++;if(favoriteResumeQueued)return;favoriteResumeQueued=true;
  queueMicrotask(()=>{favoriteResumeQueued=false;if(destroyed)return;if(!$('.dict').hidden&&lastEntry)void refreshSaved(requestId);if(!$('.vocab').hidden)void vocabulary.refresh();});
 }
 function visibilityResumed(){if(document.visibilityState==='visible')resumeFavorites();}
 const report=text=>{$('#status').textContent=text;};
 const translator=new ParagraphTranslator({root,demo,store,translate:(text,options)=>transport('translate',text,true,options),report,...schedulerOptions});
 let engineState=engines,selectionController=null,selectionSequence=0,selectionSource='';
 function engineLabels(){$('#engine-summary').textContent=(engineState.context?'点词语境：'+engineState.context.label+'；':'')+'正文：'+engineState.body.label+'；选文：'+engineState.selection.label;}
 const contextProviderName=()=>engineState.context&&engineState.context.id!=='builtin'?engineState.context.label:'Cloudflare Workers AI';
 translator.cacheNamespace=engineState.body.cacheKey;translator.sourceName=engineState.body.label;
 if(!('interval' in schedulerOptions))translator.interval=engineState.body.minInterval;
 engineLabels();$('#engine-settings').hidden=!onOpenEngines;$('#engine-settings').onclick=()=>{closeSettings();void onOpenEngines?.();};
 function closeSelection(){selectionSequence++;selectionController?.abort();selectionController=null;$('.selection-card').hidden=true;}
 async function configureEngines(next,{restart=true}={}){
  if(!next?.body?.cacheKey||!next?.selection?.cacheKey||destroyed)return;
  if(!next.context&&engineState.context)next={...next,context:engineState.context};
  const changed=next.body.cacheKey!==engineState.body.cacheKey,selectionChanged=next.selection.cacheKey!==engineState.selection.cacheKey,contextChanged=next.context?.cacheKey!==engineState.context?.cacheKey;
  // Context changes invalidate only the dictionary card, preserving independent
  // body and selected-text work. Calling close() here would cancel both cards.
  if(contextChanged){lookupInFlight=null;requestId++;lookupController?.abort();stopDrag();$('.dict').hidden=true;}
  if(changed)translator.stop();if(selectionChanged)closeSelection();engineState=next;
  translator.cacheNamespace=next.body.cacheKey;translator.sourceName=next.body.label;if(!('interval' in schedulerOptions))translator.interval=next.body.minInterval;engineLabels();
  if(changed&&restart)void apply();
 }
 const persist=()=>store.savePrefs(prefs).catch(()=>report('偏好无法保存，本页仍可使用。'));
 function bubbleSpace(){const v=visibleViewport(window);return {left:v.left+12,top:v.top+12,width:Math.max(0,v.width-76),height:Math.max(0,v.height-76)};}
 function position(){
  if(prefs.bubblePosition){const v=bubbleSpace(),p=prefs.bubblePosition;host.style.cssText=`position:fixed;z-index:2147483647;left:${v.left+p.x*v.width}px;top:${v.top+p.y*v.height}px`;}
  else host.style.cssText=`position:fixed;z-index:2147483647;${prefs.side}:max(12px,env(safe-area-inset-${prefs.side},0px));bottom:calc(20px + env(safe-area-inset-bottom,0px))`;
 }
 function moveBubble(left,top){const v=bubbleSpace();prefs.bubblePosition={x:v.width?Math.max(0,Math.min(1,(left-v.left)/v.width)):0,y:v.height?Math.max(0,Math.min(1,(top-v.top)/v.height)):0};position();}

 function update(){position();const translating=prefs.enabled&&prefs.mode!=='original';$('#words').checked=pausedFeatures?.words??prefs.words;$('#bilingual-enabled').checked=pausedFeatures?.enabled??translating;for(const [id,value] of [['mode',prefs.mode],['side',prefs.side],['translation-unit',prefs.translationUnit]])for(const option of $('#'+id).querySelectorAll('option'))option.selected=option.value===value;$('#translation-unit').disabled=prefs.mode==='translated';const active=prefs.words||translating;bubble.setAttribute('aria-pressed',String(active));bubble.setAttribute('aria-label',active?'关闭点击查词（停止查词和正文翻译，长按设置）':'开启点击查词（长按设置正文双语）');bubble.setAttribute('aria-description','可拖动，或聚焦后用方向键移动；长按或 Shift+F10 打开设置');bubble.title=active?'点击关闭查词和正文翻译，恢复原文；长按设置':pausedFeatures?'已暂停：点击恢复关闭前的功能设置；长按修改设置':'已关闭：点击开启查词；正文双语在长按设置中开启';host.dispatchEvent(new window.Event('readerstatechange'));}
 function closeSettings(){$('.panel').hidden=true;bubble.setAttribute('aria-expanded','false');}
 function openSettings(){if(destroyed)return;closeSelection();if(!saveReady)close();$('.panel').hidden=false;$('.vocab').hidden=true;bubble.setAttribute('aria-expanded','true');$('#mode').focus({preventScroll:true});if(pausedFeatures)report('总开关已暂停，设置已保留；点击小球恢复。');}
 function close({restoreFocus=false}={}){lookupInFlight=null;requestId++;lookupController?.abort();closeSelection();stopDrag();$('.dict').hidden=true;$('#lookup-selection').hidden=true;$('#translate-selection').hidden=true;pendingSelection=null;cancelSelectionFrame();if(restoreFocus){if(lastFocus?.isConnected)lastFocus.focus?.({preventScroll:true});if(!lastFocus?.isConnected||document.activeElement!==lastFocus)bubble.focus({preventScroll:true});}}
 async function apply(){translator.stop();update();if(prefs.enabled&&prefs.mode!=='original')await translator.start(prefs.mode,prefs.online,prefs.translationUnit);else report('原文模式 · '+(prefs.words?'查词开启，链接不跳转':'查词关闭，链接正常'));}
 const ready=store.prefs().then(p=>{if(destroyed)return;prefs={...p,online:true};void apply();}).catch(()=>{report('无法读取偏好，使用默认设置');update();});
 async function setEnabled(value){await ready;if(destroyed)return;if(pausedFeatures){pausedFeatures.enabled=Boolean(value)&&prefs.mode!=='original';update();return;}prefs.enabled=Boolean(value);if(!prefs.enabled)await Promise.all([apply(),persist()]);else{update();await persist();await apply();}}
 async function setMode(mode){if(!['original','bilingual','translated'].includes(mode))return;await ready;if(destroyed)return;prefs.mode=mode;if(pausedFeatures){pausedFeatures.enabled=mode!=='original';update();await persist();return;}prefs.enabled=true;translator.stop();update();await persist();await apply();}
 async function setTranslationUnit(value){if(!['paragraph','sentence'].includes(value))return;await ready;if(destroyed)return;prefs.translationUnit=value;await Promise.all([apply(),persist()]);}
 async function setWords(value){await ready;if(destroyed)return;if(pausedFeatures){pausedFeatures.words=Boolean(value);update();return;}prefs.words=Boolean(value);if(!value)close();update();if(!prefs.enabled||prefs.mode==='original')report('原文模式 · '+(prefs.words?'查词开启，链接不跳转':'查词关闭，链接正常'));await persist();}
 // Main-switch pause is distinct from the chosen feature configuration.
 // Keep it only in this reader session; page reload retains its existing policy.
 function toggleReader(){
  const job=toggleQueue.then(async()=>{
   await ready;if(destroyed)return;
   if(prefs.words||prefs.enabled&&prefs.mode!=='original'){
    pausedFeatures={words:prefs.words,enabled:prefs.enabled&&prefs.mode!=='original'};
    prefs.words=false;prefs.enabled=false;translator.stop();close();closeSettings();window.speechSynthesis?.cancel();update();report('已暂停 · 原文阅读，功能设置已保留');await persist();
   }else if(pausedFeatures){
    const resume=pausedFeatures;pausedFeatures=null;prefs.words=resume.words;prefs.enabled=resume.enabled;
    closeSettings();update();await persist();void apply().catch(()=>report('正文翻译暂不可用，可在设置中重试'));
   }else await setWords(true);
  });
  toggleQueue=job.catch(()=>{});return job;
 }

 function restore(){translator.stop();if(pausedFeatures)pausedFeatures.enabled=false;prefs.enabled=false;close();closeSettings();window.speechSynthesis?.cancel();update();report('已恢复原文；点词查询'+(prefs.words?'仍开启':'已关闭'));void persist();}
 async function bilingual(){await ready;if(prefs.enabled&&prefs.mode!=='original')return setEnabled(false);return setMode('bilingual');}
 async function setBilingual(value){return value?setMode('bilingual'):setEnabled(false);}
 function show(word,target,sentence='',offset=null){
  if(destroyed)return Promise.resolve();
  const phrase=phraseAt(sentence,offset,word);if(phrase){word=phrase.word;offset=phrase.offset;}
  const key=JSON.stringify([word,sentence,offset]);
  if(lookupInFlight?.key===key&&lookupInFlight.target===target&&lookupInFlight.id===requestId&&!lookupController?.signal.aborted&&!$('.dict').hidden&&$('#retry').hidden)return lookupInFlight.promise;
  const promise=showEntry(word,target,sentence,offset),job={key,target,id:requestId,promise};lookupInFlight=job;
  const release=()=>{if(lookupInFlight===job)lookupInFlight=null;};void promise.then(release,release);
  return promise;
 }
 async function showEntry(word,target,sentence,offset){
  closeSelection();
  const id=++requestId;lookupController?.abort();lookupController=new AbortController();active=word.toLowerCase();lastFocus=target;context=sentence;contextOffset=offset;lastEntry=null;saveFailure=null;saveReady=false;setCollapsed(false);$('.dict-body').scrollTop=0;$('.entry-details').open=false;$('#retry').hidden=true;$('#context-engine-settings').hidden=true;$('#lookup-selection').hidden=true;$('.sense-picker').hidden=true;$('#sense-choice').replaceChildren();closeSettings();$('.dict').hidden=false;$('.vocab').hidden=true;$('.word').textContent=word;$('.mini-word').textContent=word;$('.mini-meaning').textContent='查询中…';$('.zh').textContent='正在查词…';$('.defs').replaceChildren();for(const s of ['.source','.phonetic','.dictionary-label','.morphology','.zh-source','.sense-status','.related'])$(s).textContent='';$('.sentence').textContent=sentence?'当前句子：'+sentence:'当前没有句子上下文';$('#save').textContent='收藏';$('#save').disabled=true;
  try{await ready;if(destroyed||id!==requestId)return;let result;try{result=await transport('lookup',word,prefs.online,{signal:lookupController.signal});}catch(error){if(destroyed||id!==requestId||lookupController.signal.aborted||!prefs.online||!sentence||['ONLINE_REQUIRED','INVALID_WORD'].includes(error?.code)||word.length>80||!/^[A-Za-z]+(?:['’-][A-Za-z]+)*(?: [A-Za-z]+(?:['’-][A-Za-z]+)*){0,3}$/.test(word))throw error;result={word,lemma:word.toLowerCase(),kind:'unavailable',senses:[],source:'Collins 词条未读取成功',dictionaryError:error.message,sourceUrls:error.sourceUrls||[]};}if(destroyed||id!==requestId)return;
   let shownSense=null,aiOnly=false;
   const renderSource=sense=>{
    $('.source').textContent=aiOnly?(result.senses?.length?'AI 语境释义（未匹配 Collins）；下方词条仅供查阅':'AI 语境释义；Collins 词条未读取成功'):result.source||'';
    const urls=sense?.sourceUrl?[sense.sourceUrl]:result.sourceUrls||[];
    for(const url of urls.slice(0,1)){try{const parsed=new URL(url);if(parsed.protocol!=='https:'||!['dict.youdao.com','www.collinsdictionary.com'].includes(parsed.hostname))continue;const a=document.createElement('a');a.href=url;a.textContent=' 打开原词条 ↗';a.target='_blank';a.rel='noopener noreferrer';$('.source').append(a);}catch{}}
   };
   lastEntry={word,lemma:result.lemma||result.word||active,zh:result.zh,sentence,source:globalThis.location?.href||'',dictionarySource:result.source};active=lastEntry.lemma;$('.word').textContent=word.includes(' ')?word:result.word||word;$('.mini-word').textContent=word.includes(' ')?word:result.word||word;$('.zh').textContent=result.zh;$('.mini-meaning').textContent=result.zh||'';$('.zh-source').textContent=result.zhSource||(result.kind==='unavailable'?'Collins 词条未读取成功':'示例释义');$('.dictionary-label').textContent=result.kind==='collins'?'Collins · 英汉双解':result.kind==='online'?'在线词义':result.kind==='unavailable'?'Collins 暂缺':'演示词义';$('.phonetic').textContent=result.phonetic||'';$('.morphology').textContent=result.morphology||'';
   for(const def of result.definitions||[]){const p=document.createElement('p');p.textContent=def;$('.defs').append(p);}if(result.example){const example=document.createElement('p');example.textContent='例句：'+result.example;$('.defs').append(example);}
   if(!$('.defs').children.length){const p=document.createElement('p');p.textContent=result.englishError?.message?'英文解释未返回：'+result.englishError.message:result.kind==='unavailable'?'Collins 词条读取失败：'+(result.dictionaryError||'暂未获得英文释义和词性，请查看词条来源。'):['online','collins'].includes(result.kind)?'暂未读取到英文解释，完整义项请查看词条来源。':'此演示条目暂无英文释义和词性。';$('.defs').append(p);}
   if(Array.isArray(result.senses)&&(result.senses.length||sentence)){
    const ranked={ordered:result.senses};let manuallySelected=false;
    const displaySense=sense=>{
     shownSense=sense;aiOnly=false;Array.from($('#sense-choice').options).find(option=>option.value===sense.id).selected=true;$('.dictionary-label').textContent=result.phraseSource?'Collins · 短语义项':'Collins · 英汉双解';active=sense.lemma||result.lemma||result.word||word.toLowerCase();renderSource(sense);
     $('.zh').textContent=sense.zh;$('.mini-meaning').textContent=sense.zh;lastEntry={...lastEntry,lemma:active,zh:sense.zh,dictionarySource:result.source};renderSave();$('.zh-source').textContent=result.zhSource||result.source||'';$('.defs').replaceChildren();
     const definition=document.createElement('p');definition.textContent=[readablePOS(sense.pos),sense.definition].filter(Boolean).join(' · ');$('.defs').append(definition);
     if(sense.examples?.length){const examples=document.createElement('details'),summary=document.createElement('summary');examples.className='sense-examples';summary.textContent='双语例句';examples.append(summary);for(const example of sense.examples){const p=document.createElement('p');p.textContent=example.en+'\n'+example.zh;p.className='sense-example';examples.append(p);}examples.ontoggle=()=>{if(!examples.open)$('.dict-body').scrollTop=0;if(cardPoint&&!$('.dict').hidden)placeDictionary(...cardPoint);};$('.defs').append(examples);}
    };
    const contextOption=sentence&&ranked.ordered.length?document.createElement('option'):null;if(contextOption){contextOption.value='';contextOption.disabled=true;contextOption.textContent='查看词典原义';$('#sense-choice').append(contextOption);}
    for(const [i,sense] of ranked.ordered.entries()){const option=document.createElement('option');option.value=sense.id;option.textContent=(i+1)+'. '+(sense.lemma&&sense.lemma!==word.toLowerCase()?sense.lemma+' · ':'')+sense.zh+' · '+readablePOS(sense.pos);$('#sense-choice').append(option);}
    $('.sense-picker').hidden=ranked.ordered.length<2&&!contextOption;
    $('.sense-status').textContent=sentence?'正在结合原句释义…':'Collins 词典义项（未提供原句）';
    $('#sense-choice').onchange=()=>{if(id!==requestId)return;const sense=ranked.ordered.find(s=>s.id===$('#sense-choice').value);if(!sense)return;manuallySelected=true;displaySense(sense);lookupController.abort();saveReady=true;renderSave();void refreshSaved(id);$('#retry').hidden=true;$('#context-engine-settings').hidden=true;$('.sense-status').textContent='已选择该义项';if(cardPoint)placeDictionary(...cardPoint);};
    if(ranked.ordered.length)displaySense(ranked.ordered[0]);
    if(sentence){
     if(contextOption)contextOption.selected=true;
     $('.zh').textContent='正在分析当前语境…';$('.mini-meaning').textContent='语境分析中…';
     try{
      const contextInput={word,sentence,offset,senses:result.senses};const meaning=parseContextResult(await transport('context',word,true,{signal:lookupController.signal,context:contextInput,engineKey:engineState.context?.cacheKey}),contextInput);
      if(destroyed||id!==requestId)return;
      if(!manuallySelected){
       const selected=result.senses.find(s=>s.id===meaning.senseId);
       if(selected)displaySense(selected);
       else{shownSense=null;aiOnly=true;$('.dictionary-label').textContent='AI · 语境释义';active=phraseLemma(word);lastEntry={...lastEntry,lemma:active};if(result.kind!=='unavailable')$('.defs').replaceChildren();$('#sense-choice').selectedIndex=-1;}
       if(selected&&matchesDictionaryGloss(meaning.zh,selected.zh)){
        // The rendered text is the dictionary's own gloss; AI only chose the
        // candidate. Keep its real option/source instead of a synthetic state.
        contextOption?.remove();$('.sense-picker').hidden=ranked.ordered.length<2;
        $('.sense-status').textContent='按原句匹配的词典义项';
        $('.zh-source').textContent=engineState.context&&engineState.context.id!=='builtin'?'Collins 词典原义；AI（'+contextProviderName()+'）根据原句匹配该义项':'Collins 词典原义；AI 根据原句匹配该义项';
       }else{
        $('.zh').textContent=meaning.zh;$('.mini-meaning').textContent=meaning.zh;lastEntry={...lastEntry,zh:meaning.zh,dictionarySource:'AI 语境释义 · '+contextProviderName()+'；原词典：'+(result.source||'Collins')};
        if(contextOption){contextOption.textContent='查看词典原义';contextOption.selected=true;}
        $('.sense-status').textContent=selected?'此处含义 · AI 结合原句分析':'此处含义 · AI 释义（无对应 Collins 义项）';
        const provider=engineState.context&&engineState.context.id!=='builtin'?'（'+contextProviderName()+'）':'';
        $('.zh-source').textContent=selected?'AI 语境释义'+provider+'；对应 Collins '+(selected.lemma||result.word)+' 原义：'+selected.zh:result.senses.length?'AI'+provider+' 根据原句生成；下拉可查看 Collins 原始义项':'Collins 暂无可用义项；此处由 AI'+provider+' 根据原句释义。';if(!result.senses.length)$('.dictionary-label').textContent='AI · 语境释义';
       }
      }
     }catch(error){
      if(destroyed||id!==requestId)return;
      if(!manuallySelected){if(ranked.ordered.length)displaySense(ranked.ordered[0]);else{$('.zh').textContent='暂未获得此处含义，请重试';$('.mini-meaning').textContent='暂未查到';}const reason=error?.code==='CONTEXT_INVALID_RESULT'&&error.validationReason==='incomplete'?'语境模型输出不完整，请更换语境 AI 或稍后手动重试':{CONTEXT_QUOTA_EXCEEDED:'内置 AI 当日额度已用完，请更换语境 AI 或等待额度重置',CONTEXT_BUSY:'语境服务繁忙，请稍后重试',RATE_LIMITED:'语境查询过于频繁，请稍后重试',CONTEXT_TIMEOUT:'语境分析超时，请重试',CONTEXT_NETWORK:'语境服务连接失败，请检查网络后重试',CONTEXT_INVALID_RESULT:'语境结果未通过校验，请重试',CONTEXT_UNAVAILABLE:'语境服务暂不可用，请重试',CONTEXT_ACCESS_DENIED:engineState.context&&engineState.context.id!=='builtin'?'所选语境 AI 的密钥或访问权限不可用，请检查已保存配置':'语境服务拒绝了请求，请稍后重试',ENGINE_STORAGE:'语境引擎配置无法读取，未发送原句；请打开引擎设置后重试',CONTEXT_INVALID_REQUEST:'语境请求未通过校验，请重新查词'}[error?.code]||'语境分析失败，请重试';$('.sense-status').textContent=reason+(ranked.ordered.length?' · 当前显示词典原义':'');$('#retry').hidden=false;$('#context-engine-settings').hidden=!onOpenContextEngines;}
     }
    }
    $('.related').textContent=(result.relatedForms||[]).length?'派生词：'+result.relatedForms.map(s=>s.word+'（'+s.zh+'）').join('；'):'';
   }
   renderSource(shownSense);if(result.kind==='unavailable'&&!sentence){$('.zh').textContent=result.dictionaryError||'Collins 暂无可用词条';$('#retry').hidden=false;}
   if(cardPoint)placeDictionary(...cardPoint);saveReady=true;renderSave();await refreshSaved(id);
  }catch(e){if(id===requestId){$('.zh').textContent=e.message;$('.mini-meaning').textContent='暂未查到';$('#retry').hidden=false;saveReady=Boolean(lastEntry?.zh);renderSave();for(const url of (e.sourceUrls||[]).slice(0,1)){try{if(!['www.collinsdictionary.com','dict.youdao.com'].includes(new URL(url).hostname)||new URL(url).protocol!=='https:')continue;const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.textContent=new URL(url).hostname==='dict.youdao.com'?' 查看 Collins 英汉双解来源':' 在 Collins 官网查看';$('.source').append(a);}catch{}}if(cardPoint)placeDictionary(...cardPoint);}}
 }
 let touch=null,suppressTouchUntil=0;
 function cancelSelectionFrame(){if(selectionFrame!==null)window.cancelAnimationFrame?.(selectionFrame);selectionFrame=null;}
 function queueSelectionPosition(){if(destroyed||!pendingSelection||selectionFrame!==null)return;if(!window.requestAnimationFrame){positionSelection();return;}selectionFrame=window.requestAnimationFrame(()=>{selectionFrame=null;positionSelection();});}
 function hideSelectionAction(){const actions=[$('#lookup-selection'),$('#translate-selection')],focused=actions.includes(shadow.activeElement);for(const action of actions)action.hidden=true;if(focused)bubble.focus({preventScroll:true});}
 function positionSelection(){
  const action=pendingSelection?.lookup?$('#lookup-selection'):$('#translate-selection'),range=pendingSelection?.range;
  if(destroyed||!prefs.words||!range||!root.contains(range.startContainer)||!root.contains(range.endContainer)){hideSelectionAction();return;}
  const rect=range.getBoundingClientRect(),view=visibleViewport(window);let left=Math.max(rect.left,view.left),right=Math.min(rect.right,view.left+view.width),top=Math.max(rect.top,view.top),bottom=Math.min(rect.bottom,view.top+view.height);
  if(right<=left||bottom<=top){hideSelectionAction();return;}
  // Nested scroll containers can clip a word even while its layout coordinates
  // remain inside the window. Use only ancestors shared by the selected range.
  let parent=range.commonAncestorContainer;parent=parent.nodeType===1?parent:parent.parentElement;
  for(let depth=0;parent&&depth<5000;parent=parent.parentElement,depth++){const css=window.getComputedStyle?.(parent)||parent.style,clipX=/^(auto|scroll|hidden|clip)$/.test(css?.overflowX),clipY=/^(auto|scroll|hidden|clip)$/.test(css?.overflowY);if(!clipX&&!clipY)continue;const box=parent.getBoundingClientRect();if(clipX){left=Math.max(left,box.left);right=Math.min(right,box.right);}if(clipY){top=Math.max(top,box.top);bottom=Math.min(bottom,box.bottom);}}
  if(parent||right<=left||bottom<=top){hideSelectionAction();return;}
  const margin=Math.min(8,view.width/4,view.height/4);action.style.maxWidth=Math.max(1,view.width-2*margin)+'px';action.style.maxHeight=Math.max(1,view.height-2*margin)+'px';action.hidden=false;
  const size=action.getBoundingClientRect(),below=bottom+6,preferred=below+size.height<=view.top+view.height-margin?below:top-size.height-6;
  action.style.left=Math.max(view.left+margin,Math.min(left,view.left+view.width-margin-size.width))+'px';action.style.top=Math.max(view.top+margin,Math.min(preferred,view.top+view.height-margin-size.height))+'px';
  if(pendingSelection.lookup){
   const secondary=$('#translate-selection');secondary.style.maxWidth=Math.max(1,view.width-2*margin)+'px';secondary.hidden=false;const primary=action.getBoundingClientRect(),second=secondary.getBoundingClientRect();
   const beside=primary.right+6,stacked=primary.bottom+4;
   secondary.style.left=Math.max(view.left+margin,Math.min(beside+second.width<=view.left+view.width-margin?beside:primary.left,view.left+view.width-margin-second.width))+'px';
   secondary.style.top=Math.max(view.top+margin,Math.min(beside+second.width<=view.left+view.width-margin?primary.top:stacked+second.height<=view.top+view.height-margin?stacked:primary.top-second.height-4,view.top+view.height-margin-second.height))+'px';
  }
 }
 function selectionChanged(){
  $('#lookup-selection').hidden=true;$('#translate-selection').hidden=true;pendingSelection=null;
  if(destroyed||!prefs.words)return;
  const selection=window.getSelection?.();if(!selection||selection.isCollapsed||!selection.rangeCount){$('#lookup-selection').hidden=true;pendingSelection=null;return;}
  const range=selection.getRangeAt(0),parent=range.startContainer.nodeType===3?range.startContainer.parentElement:range.startContainer;
  if(!root.contains(parent)||!root.contains(range.endContainer)||parent.closest('button,input,textarea,select,form,code,pre,nav,header:not(article header),[role="banner"],footer,aside,[role="navigation"],[contenteditable],lextide-reader,.lextide-translation'))return;
  const word=readableSelection(range,root,{demo});if(!word)return;
  const lookup=word.length<=80&&/^[A-Za-z]+(?:['’-][A-Za-z]+)*(?: [A-Za-z]+(?:['’-][A-Za-z]+)*){0,3}$/.test(word)&&Boolean(selectedContext(range,word,{demo}));
  if(selectionSource&&selectionSource!==word)closeSelection();
  pendingSelection={word,lookup,range:range.cloneRange()};positionSelection();
 }
 $('#lookup-selection').onpointerdown=e=>e.preventDefault();
 $('#lookup-selection').onclick=()=>{
  const chosen=pendingSelection;pendingSelection=null;$('#lookup-selection').hidden=true;$('#translate-selection').hidden=true;
  if(!chosen||destroyed||!prefs.words)return;const range=chosen.range;
  if(!root.contains(range.startContainer)||!root.contains(range.endContainer)||range.toString().replace(/\s+/g,' ').trim()!==chosen.word)return;
  const data=selectedContext(range,chosen.word,{demo});if(!data)return;
  const target=range.startContainer.nodeType===3?range.startContainer.parentElement:range.startContainer,rect=range.getBoundingClientRect();
  window.getSelection()?.removeAllRanges?.();void show(chosen.word,target,data.sentence,data.offset);placeDictionary(rect.x,rect.bottom);
 };
 async function translateSelection(text){
  close();closeSettings();selectionSource=text;selectionController=new AbortController();const controller=selectionController,id=++selectionSequence,engine=engineState.selection;
  $('.selection-card').hidden=false;$('#selection-provider').textContent=engine.label+' · 机器翻译';$('#selection-original').textContent=text;$('#selection-result').textContent='正在翻译…';$('#retry-selection').hidden=true;
  try{const result=await transport('selection',text,true,{signal:controller.signal,engineKey:engine.cacheKey});if(destroyed||controller.signal.aborted||id!==selectionSequence)return;if(typeof result!=='string'||!result.trim())throw Error('服务未返回有效译文');$('#selection-result').textContent=result;}
  catch(error){if(destroyed||controller.signal.aborted||id!==selectionSequence)return;$('#selection-result').textContent='选文翻译失败：'+error.message;$('#retry-selection').hidden=false;}
 }
 $('#translate-selection').onpointerdown=e=>e.preventDefault();
 $('#translate-selection').onclick=event=>{const chosen=pendingSelection;if(!event.isTrusted||!chosen||destroyed||!prefs.words||readableSelection(chosen.range,root,{demo})!==chosen.word)return;window.getSelection()?.removeAllRanges?.();void translateSelection(chosen.word);};
 $('#close-selection').onclick=()=>{closeSelection();bubble.focus({preventScroll:true});};
 $('#retry-selection').onclick=()=>{if(prefs.words&&selectionSource)void translateSelection(selectionSource);};
 document.addEventListener('selectionchange',selectionChanged);
 function touchStart(e){if(e.pointerType!=='touch')return;touch={id:e.pointerId,x:e.clientX,y:e.clientY,at:Date.now()};}
 function touchMove(e){if(touch?.id===e.pointerId&&Math.hypot(e.clientX-touch.x,e.clientY-touch.y)>10){suppressTouchUntil=Date.now()+700;touch=null;}}
 function touchEnd(e){if(e.pointerType!=='touch')return;if(e.type==='pointercancel'||touch&&Date.now()-touch.at>=500)suppressTouchUntil=Date.now()+700;touch=null;}
 function clicked(e,fromLink=false){if(isAuxiliaryUIEvent(e)||e.composedPath?.().includes(host)||!prefs.words)return;if(e.detail!==0&&Date.now()<suppressTouchUntil)return;if(e.defaultPrevented&&!fromLink||!fromLink&&e.target.closest('summary')||(!demo||!e.target.closest('[data-word]'))&&e.target.closest('[role="button"]')||e.target.closest('input,textarea,button,select,[role="toolbar"],[role="navigation"],[role="textbox"],form,[contenteditable]:not([contenteditable="false"]),pre,code,nav,header:not(article header),[role="banner"],footer,aside,lextide-reader,.lextide-translation')){close();return;}
  const selection=window.getSelection?.();if(selection&&!selection.isCollapsed)return;const anchor=e.target.closest('[data-word]')||e.target;let word=anchor.dataset?.word,snapshot=word?proseSnapshot(proseBlock(anchor),anchor,0,{demo}):null;
  if(!word){const p=document.caretPositionFromPoint?.(e.clientX,e.clientY),r=!p&&document.caretRangeFromPoint?.(e.clientX,e.clientY),node=p?.offsetNode||r?.startContainer,offset=p?.offset??r?.startOffset;if(node?.nodeType===3&&root.contains(node)&&e.target.contains(node)){snapshot=proseSnapshot(proseBlock(node),node,offset);if(snapshot)word=wordAt(snapshot.text,snapshot.offset);}}
  if(word&&snapshot){const data=snapshotContext(snapshot);void show(word,e.target,data.sentence,data.offset);placeDictionary(e.clientX,e.clientY);}else close();
 }
 function interceptLink(e){
  if(destroyed||!prefs.words||e.composedPath?.().includes(host)||!root.contains(e.target))return;
  const link=e.target.closest?.('a,[role="link"],area[href]');if(!link)return;
  if(e.type==='keydown'&&e.key!=='Enter'||e.type==='auxclick'&&e.button!==1)return;
  e.preventDefault();e.stopImmediatePropagation();
  if(e.type==='auxclick')return;
  if(e.type==='keydown'||e.detail===0){
   const snapshot=proseSnapshot(proseBlock(link),link,0,{demo});if(!snapshot)return;
   const visible=proseSnapshot(link,link,0,{demo});const match=visible?.text.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/);if(!match)return;
   const at=snapshot.text.indexOf(match[0],snapshot.offset);if(at<0)return;
   const data=snapshotContext(snapshot,at,match[0].length),rect=link.getBoundingClientRect?.();void show(match[0],link,data.sentence,data.offset);if(rect)placeDictionary(rect.x,rect.bottom);return;
  }
  clicked(e,true);
 }
 for(const type of ['click','auxclick','keydown'])window.addEventListener(type,interceptLink,true);
 function placeDictionary(x,y){cardPoint=[x,y];const card=$('.dict');if(!card.getBoundingClientRect||!window.innerWidth)return;const view=visibleViewport(window);card.style.right='auto';card.style.bottom='auto';const first=dictionaryBounds(view,x,y);card.style.width=first.width+'px';card.style.maxWidth=first.width+'px';card.style.maxHeight=(manualPosition?Math.min(440,view.height-24):first.maxHeight)+'px';const rect=card.getBoundingClientRect(),bounds=manualPosition?movableBounds(view,manualPosition.left,manualPosition.top,rect.width,rect.height):dictionaryBounds(view,x,y,rect.height);if(!manualPosition)card.style.maxHeight=bounds.maxHeight+'px';else manualPosition=bounds;card.style.left=bounds.left+'px';card.style.top=bounds.top+'px';}
 function setCollapsed(value){$('.dict').classList.toggle('is-collapsed',value);$('.dict-body').hidden=value;$('.dict-title').hidden=value;$('.dict-actions').hidden=value;$('.mini-result').hidden=!value;$('#collapse-dict').textContent=value?'+':'−';$('#collapse-dict').setAttribute('aria-expanded',String(!value));$('#collapse-dict').setAttribute('aria-label',value?'展开释义':'收起释义');$('#collapse-dict').title=value?'展开释义':'收起，继续阅读';}
 $('#collapse-dict').onclick=()=>{setCollapsed(!$('.dict').classList.contains('is-collapsed'));if(cardPoint)placeDictionary(...cardPoint);};
 $('#reset-dict').onclick=()=>{manualPosition=null;$('#reset-dict').hidden=true;if(cardPoint)placeDictionary(...cardPoint);};
 const handle=$('.dict-handle');
 function moveCard(left,top){const card=$('.dict'),view=visibleViewport(window),rect=card.getBoundingClientRect();manualPosition=movableBounds(view,left,top,rect.width,rect.height);card.style.left=manualPosition.left+'px';card.style.top=manualPosition.top+'px';$('#reset-dict').hidden=false;}
 handle.onpointerdown=e=>{if(e.button!==0||e.target.closest('button'))return;const rect=$('.dict').getBoundingClientRect();drag={id:e.pointerId,x:e.clientX,y:e.clientY,left:rect.x,top:rect.y};handle.setPointerCapture?.(e.pointerId);$('.dict').classList.add('is-dragging');e.preventDefault();};
 handle.onpointermove=e=>{if(drag?.id!==e.pointerId)return;moveCard(drag.left+e.clientX-drag.x,drag.top+e.clientY-drag.y);};
 function stopDrag(){drag=null;$('.dict').classList.remove('is-dragging');}
 handle.onpointerup=stopDrag;handle.onpointercancel=stopDrag;handle.onlostpointercapture=stopDrag;
 handle.onkeydown=e=>{if(e.target!==handle||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const r=$('.dict').getBoundingClientRect(),step=e.shiftKey?40:10;moveCard(r.x+(e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0),r.y+(e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0));};
 $('.entry-details').ontoggle=()=>{if(!$('.entry-details').open)$('.dict-body').scrollTop=0;if(cardPoint&&!$('.dict').hidden)placeDictionary(...cardPoint);};
 function viewportChanged(){position();queueSelectionPosition();if(!$('.dict').hidden&&cardPoint)placeDictionary(...cardPoint);}
 function outside(e){if(isAuxiliaryUIEvent(e)||e.composedPath?.().includes(host)||root.contains(e.target))return;close();}
 function keydown(e){if(e.key==='Escape'){
  const settingsOpen=!$('.panel').hidden,vocabularyOpen=!$('.vocab').hidden,cardOpen=!$('.dict').hidden,inside=Boolean(shadow.activeElement);
  if(settingsOpen||vocabularyOpen||cardOpen||!$('.selection-card').hidden||!$('#lookup-selection').hidden||!$('#translate-selection').hidden){closeSettings();close({restoreFocus:inside&&cardOpen&&!settingsOpen&&!vocabularyOpen});$('.vocab').hidden=true;if(inside&&(settingsOpen||vocabularyOpen))bubble.focus({preventScroll:true});}
 }if(e.key==='Enter'&&prefs.words&&root.contains(e.target)&&e.target.dataset?.word){const word=e.target.dataset.word,snapshot=proseSnapshot(proseBlock(e.target),e.target,0,{demo});if(snapshot){const data=snapshotContext(snapshot,snapshot.offset,word.length);void show(word,e.target,data.sentence,data.offset);}}}
 root.addEventListener('click',clicked);document.addEventListener('keydown',keydown);document.addEventListener('click',outside);
 for(const [type,fn] of [['pointerdown',touchStart],['pointermove',touchMove],['pointerup',touchEnd],['pointercancel',touchEnd]])root.addEventListener(type,fn,{passive:true});
 window.visualViewport?.addEventListener('resize',viewportChanged);window.visualViewport?.addEventListener('scroll',viewportChanged);window.addEventListener('resize',viewportChanged);window.addEventListener('scroll',queueSelectionPosition,true);
 $('#mode').onchange=e=>void setMode(e.target.value);$('#words').onchange=e=>void setWords(e.target.checked);
 $('#translation-unit').onchange=e=>void setTranslationUnit(e.target.value);
 $('#bilingual-enabled').onchange=e=>void setBilingual(e.target.checked);
 $('#reset-bubble').onclick=()=>{prefs.bubblePosition=null;position();void persist();};
 $('#side').onchange=e=>{prefs.side=e.target.value;prefs.bubblePosition=null;position();void persist();};
 $('#retry-all').onclick=()=>void translator.retry();$('#clear-cache').onclick=()=>store.clearCache().then(()=>report('已清除翻译缓存')).catch(()=>report('无法清除缓存'));
 $('.panel .close').onclick=()=>{closeSettings();bubble.focus({preventScroll:true});};$('.dict .close').onclick=()=>close({restoreFocus:true});
 $('#context-engine-settings').onclick=()=>void onOpenContextEngines?.();
 $('#retry').onclick=()=>void show(lastEntry?.word||active,lastFocus,context,contextOffset);$('#speak').onclick=()=>{if(!window.speechSynthesis){$('.sense-status').textContent='此浏览器不支持朗读';return;}window.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(active);u.lang='en-US';window.speechSynthesis.speak(u);};
 $('#save').onclick=async()=>{
  if(!saveReady||!lastEntry?.zh)return;const entry={...lastEntry},key=vocabularyKey(entry);if(savingKeys.has(key))return;savingKeys.add(key);renderSave();
  try{await store.saveWord(entry);savedKeys.add(key);savedRevision++;if(!destroyed&&lastEntry&&vocabularyKey(lastEntry)===key&&saveFailure?.key===key){if($('.sense-status').textContent===saveFailure.message)$('.sense-status').textContent=saveFailure.previous;saveFailure=null;}}
  catch(error){if(!destroyed&&lastEntry&&vocabularyKey(lastEntry)===key){const field=$('.sense-status'),previous=saveFailure?.key===key&&field.textContent===saveFailure.message?saveFailure.previous:field.textContent,message=['STORAGE_FULL','VOCABULARY_FULL','VOCABULARY_READ_FAILED'].includes(error?.code)?error.message:'保存失败，请重试';saveFailure={key,previous,message};field.textContent=message;}}
  finally{savingKeys.delete(key);if(!destroyed)renderSave();}
 };
 const vocabulary=mountVocabulary({root:$('.vocab'),store});
 async function openVocabulary(){if(destroyed)return;close();closeSettings();if(onOpenVocabulary)return onOpenVocabulary();$('.vocab').hidden=false;await vocabulary.refresh();if(!destroyed&&!$('.vocab').hidden)$('#vocab-search').focus({preventScroll:true});}
 function exportWords(){return vocabulary.exportWords();}
 $('#vocabulary').onclick=openVocabulary;$('.vocab .close').onclick=()=>{$('.vocab').hidden=true;bubble.focus();};
 let pressTimer=null,pressOrigin=null,suppressClick=false;
 function clearPress(){clearTimeout(pressTimer);pressTimer=null;pressOrigin=null;bubble.classList.remove('is-dragging');}
 bubble.onpointerdown=e=>{
  if(e.button!==undefined&&e.button!==0)return;
  clearPress();suppressClick=false;const r=bubble.getBoundingClientRect();
  pressOrigin={id:e.pointerId,x:e.clientX,y:e.clientY,left:r.left,top:r.top,moved:false,held:false};
  bubble.setPointerCapture?.(e.pointerId);
  pressTimer=setTimeout(()=>{if(pressOrigin)pressOrigin.held=true;suppressClick=true;openSettings();},550);
 };
 bubble.onpointermove=e=>{
  const p=pressOrigin;if(!p||p.id!==e.pointerId||p.held)return;
  if(!p.moved&&Math.hypot(e.clientX-p.x,e.clientY-p.y)<=10)return;
  clearTimeout(pressTimer);pressTimer=null;p.moved=true;suppressClick=true;bubble.classList.add('is-dragging');
  moveBubble(p.left+e.clientX-p.x,p.top+e.clientY-p.y);
 };
 function finishBubble(){const moved=pressOrigin?.moved;clearPress();if(moved)void persist();}
 bubble.onpointerup=finishBubble;
 bubble.onpointercancel=()=>{suppressClick=true;finishBubble();};
 bubble.onlostpointercapture=finishBubble;
 bubble.oncontextmenu=e=>{e.preventDefault();if(pressOrigin?.moved)return;clearPress();suppressClick=true;openSettings();};
 bubble.onkeydown=e=>{
  if(e.key==='Enter'||e.key===' ')suppressClick=false;
  if(e.key==='F10'&&e.shiftKey){e.preventDefault();openSettings();}
  if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){
   e.preventDefault();const r=bubble.getBoundingClientRect(),step=e.shiftKey?40:10;
   moveBubble(r.left+(e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0),r.top+(e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0));void persist();
  }
 };
 bubble.onclick=()=>{if(suppressClick){suppressClick=false;return;}void toggleReader();};update();
 async function configure(next){await ready;if(destroyed)return;if(JSON.stringify(prefs)===JSON.stringify(next))return;const restart=['mode','enabled','online','translationUnit'].some(k=>prefs[k]!==next[k]);pausedFeatures=null;prefs={...DEFAULT_PREFS,...next,online:true};if(!prefs.words)close();update();if(restart){translator.stop();void apply();}}
 window.addEventListener('focus',resumeFavorites);document.addEventListener('visibilitychange',visibilityResumed);
 return {ready,configure,configureEngines,show,bilingual,setBilingual,restore,setEnabled,setMode,setWords,setTranslationUnit,openSettings,openVocabulary,exportWords,shadow,get enabled(){return prefs.enabled;},get mode(){return prefs.enabled?prefs.mode:'original';},get preferences(){return {...prefs};},destroy(){destroyed=true;lookupInFlight=null;closeSelection();window.removeEventListener('focus',resumeFavorites);document.removeEventListener('visibilitychange',visibilityResumed);for(const type of ['click','auxclick','keydown'])window.removeEventListener(type,interceptLink,true);document.removeEventListener('selectionchange',selectionChanged);clearPress();requestId++;lookupController?.abort();translator.stop();root.removeEventListener('click',clicked);document.removeEventListener('keydown',keydown);document.removeEventListener('click',outside);for(const [type,fn] of [['pointerdown',touchStart],['pointermove',touchMove],['pointerup',touchEnd],['pointercancel',touchEnd]])root.removeEventListener(type,fn);window.visualViewport?.removeEventListener('resize',viewportChanged);window.visualViewport?.removeEventListener('scroll',viewportChanged);window.removeEventListener('resize',viewportChanged);window.removeEventListener('scroll',queueSelectionPosition,true);cancelSelectionFrame();host.remove();}};
}
