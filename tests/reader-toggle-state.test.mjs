import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {mountReader} from '../src/reader.js';
import {createStore,DEFAULT_PREFS} from '../src/storage.js';
const tick=()=>new Promise(setImmediate);
async function fixture({transport}={}){
 const {window}=parseHTML('<html><body><main><p class="english" data-translation="这是第一段。">The first paragraph.</p><p class="english" data-translation="这是第二段。">The second paragraph.</p></main></body></html>');window.getSelection=()=>({isCollapsed:true});globalThis.window=window;globalThis.document=window.document;
 const values=new Map([['prefs',{...DEFAULT_PREFS,words:true,online:true}]]);let writes=0,calls=0,prefsWrites=0;
 const store=createStore({get:async k=>values.get(k),set:async(k,v)=>{writes++;if(k==='prefs')prefsWrites++;values.set(k,structuredClone(v));}});
 const reader=mountReader({root:document.querySelector('main'),demo:true,store,schedulerOptions:{interval:0},transport:async(...args)=>{calls++;if(transport)return transport(...args);throw Error('Unexpected network fixture call');}});await reader.ready;await tick();
 return {reader,root:document.querySelector('main'),bubble:reader.shadow.querySelector('.bubble'),get writes(){return writes;},get prefsWrites(){return prefsWrites;},get calls(){return calls;}};
}
for(const words of [false,true])for(const mode of ['bilingual','translated'])test(`main switch restores ${mode} with lookup ${words} and retains settings while paused`,async()=>{
 const f=await fixture();try{
  await f.reader.setWords(words);await f.reader.setTranslationUnit('sentence');await f.reader.setMode(mode);await tick();const original=f.root.querySelector('p');
  f.bubble.click();await tick();assert.equal(f.reader.enabled,false);assert.equal(f.reader.preferences.words,false);assert.equal(f.root.querySelectorAll('.lextide-translation').length,0);
  const writes=f.writes,calls=f.calls;f.reader.openSettings();await tick();assert.equal(f.reader.shadow.querySelector('#bilingual-enabled').checked,true);assert.equal(f.reader.shadow.querySelector('#words').checked,words);assert.equal(f.writes,writes);assert.equal(f.calls,calls);
  f.reader.shadow.querySelector('.panel .close').click();f.bubble.click();await tick();assert.equal(f.reader.enabled,true);assert.equal(f.reader.mode,mode);assert.equal(f.reader.preferences.words,words);assert.equal(f.reader.preferences.translationUnit,'sentence');assert.equal(f.root.querySelector('p'),original);assert.ok(f.root.querySelector('.lextide-translation'));
 }finally{f.reader.destroy();}
});
test('editing the paused feature selection is local and determines the next activation',async()=>{
 const f=await fixture();try{
  await f.reader.setMode('bilingual');f.bubble.click();await tick();const calls=f.calls;
  await f.reader.setWords(false);await f.reader.setTranslationUnit('paragraph');assert.equal(f.reader.enabled,false);assert.equal(f.calls,calls);assert.equal(f.root.querySelectorAll('.lextide-translation').length,0);
  f.bubble.click();await tick();assert.equal(f.reader.enabled,true);assert.equal(f.reader.preferences.words,false);assert.equal(f.reader.preferences.translationUnit,'paragraph');
 }finally{f.reader.destroy();}
});
test('lookup-only toggle remains lookup-only and does not enable body translation',async()=>{
 const f=await fixture();try{f.bubble.click();await tick();f.bubble.click();await tick();assert.equal(f.reader.preferences.words,true);assert.equal(f.reader.mode,'original');assert.equal(f.root.querySelectorAll('.lextide-translation').length,0);}finally{f.reader.destroy();}
});
test('turning body translation off inside settings keeps the panel available for further changes',async()=>{
 const f=await fixture();try{
  await f.reader.setMode('bilingual');f.reader.openSettings();const checkbox=f.reader.shadow.querySelector('#bilingual-enabled');checkbox.checked=false;checkbox.dispatchEvent(new window.Event('change'));await tick();
  assert.equal(f.reader.enabled,false);assert.equal(f.reader.shadow.querySelector('.panel').hidden,false);assert.equal(f.bubble.getAttribute('aria-expanded'),'true');assert.equal(f.root.querySelectorAll('.lextide-translation').length,0);assert.equal(f.reader.preferences.words,true);
 }finally{f.reader.destroy();}
});
for(const failure of [{code:'CONTEXT_QUOTA_EXCEEDED',expected:/额度已用完/},{code:'CONTEXT_INVALID_RESULT',validationReason:'incomplete',expected:/输出不完整/}])test('visible dictionary card preserves safe failure explanation '+failure.code,async()=>{
 const f=await fixture();f.reader.destroy();
 const reader=mountReader({root:f.root,transport:async type=>{if(type==='lookup')return {word:'bank',kind:'collins',source:'Collins',senses:[{id:'bank-1',zh:'银行',definition:'A financial institution.',pos:'NOUN'}]};throw Object.assign(Error('PRIVATE_UPSTREAM_DETAILS'),failure);}});
 try{await reader.show('bank',f.root,'The bank holds deposits.',4);const status=reader.shadow.querySelector('.sense-status').textContent;assert.match(status,failure.expected);assert.doesNotMatch(status,/PRIVATE_UPSTREAM/);assert.match(status,/当前显示词典原义/);assert.equal(reader.shadow.querySelector('#retry').hidden,false);}finally{reader.destroy();}
});
for(const paused of [false,true])test('article replacement retains translation selection while '+(paused?'paused':'active'),async()=>{
 const f=await fixture({transport:async()=> '这是新的文章。'});try{await f.reader.setWords(false);await f.reader.setTranslationUnit('sentence');await f.reader.setMode('bilingual');if(paused){f.bubble.click();await tick();}const writes=f.prefsWrites,calls=f.calls;await f.reader.replaceContent(()=>{f.root.innerHTML='<p class="english" data-translation="这是新的文章。">This is the new article.</p>';});await tick();assert.equal(f.reader.preferences.words,false);assert.equal(f.reader.preferences.translationUnit,'sentence');assert.equal(f.reader.preferences.mode,'bilingual');assert.equal(f.prefsWrites,writes);assert.equal(f.calls,calls+(paused?0:1));if(paused){assert.equal(f.reader.enabled,false);assert.equal(f.root.querySelectorAll('.lextide-translation').length,0);f.reader.openSettings();assert.equal(f.reader.shadow.querySelector('#bilingual-enabled').checked,true);f.bubble.click();await tick();}assert.equal(f.reader.enabled,true);assert.match(f.root.textContent,/这是新的文章/);assert.doesNotMatch(f.root.textContent,/第一段|第二段/);}finally{f.reader.destroy();}
});
test('article replacement cancels old context before writing and ignores its late result',async()=>{
 const f=await fixture();f.reader.destroy();let finish,signal;const reader=mountReader({root:f.root,transport:async(type,_word,_online,options)=>{if(type==='lookup')return {word:'bank',kind:'collins',senses:[]};signal=options.signal;return new Promise(resolve=>finish=resolve);}});try{const pending=reader.show('bank',f.root,'The bank holds deposits.',4);await tick();await reader.replaceContent(()=>{assert.ok(signal.aborted);f.root.innerHTML='<p>The new article.</p>';});finish({senseId:null,zh:'银行'});await pending;assert.equal(reader.shadow.querySelector('.dict').hidden,true);assert.equal(f.root.textContent,'The new article.');}finally{reader.destroy();}
});
test('lookup-only article replacement never enables body translation',async()=>{
 const f=await fixture();try{await f.reader.replaceContent(()=>{f.root.innerHTML='<p>Another public article.</p>';});assert.equal(f.reader.preferences.words,true);assert.equal(f.reader.enabled,false);assert.equal(f.calls,0);assert.equal(f.root.querySelectorAll('.lextide-translation').length,0);}finally{f.reader.destroy();}
});
test('slow preference storage cannot block pause/resume or cancellation and each write keeps its own selection',async()=>{
 const {window}=parseHTML('<html><body><main><p>A public sentence that is still being translated.</p></main></body></html>');window.getSelection=()=>({isCollapsed:true});globalThis.window=window;globalThis.document=window.document;let release;const gate=new Promise(resolve=>release=resolve),values=new Map([['prefs',{...DEFAULT_PREFS,words:true,enabled:true,online:true}]]),snapshots=[],jobs=[];let blocked=true;
 const store=createStore({get:async k=>values.get(k),set:async(k,v)=>{if(k==='prefs'&&blocked){blocked=false;await gate;}values.set(k,structuredClone(v));}}),save=store.savePrefs;store.savePrefs=p=>{snapshots.push(p);return save(p);};const reader=mountReader({root:document.querySelector('main'),store,schedulerOptions:{interval:0},transport:async(_type,_text,_online,{signal})=>new Promise(resolve=>jobs.push({signal,resolve}))});
 try{await reader.ready;await tick();assert.equal(jobs.length,1);const bubble=reader.shadow.querySelector('.bubble');bubble.click();await tick();assert.ok(jobs[0].signal.aborted);assert.equal(reader.enabled,false);bubble.click();await tick();assert.equal(reader.enabled,true);assert.equal(jobs.length,1,'resumed requests wait for saved policy');bubble.click();await tick();assert.equal(reader.enabled,false);assert.equal(reader.preferences.words,false);assert.equal(jobs.length,1);assert.equal(document.querySelectorAll('.lextide-translation').length,0);assert.deepEqual(snapshots.map(p=>[p.words,p.enabled]),[[false,false],[true,true],[false,false]]);}finally{reader.destroy();release();for(const job of jobs)job.resolve('迟到译文');await tick();}
});
test('fifty rapid main-switch clicks preserve the final feature selection and original nodes',async()=>{
 const f=await fixture();try{await f.reader.setMode('bilingual');const original=f.root.firstChild;for(let i=0;i<50;i++)f.bubble.click();await tick();await tick();assert.equal(f.reader.enabled,true);assert.equal(f.reader.preferences.words,true);assert.equal(f.bubble.getAttribute('aria-pressed'),'true');assert.equal(f.root.firstChild,original);assert.ok(f.root.querySelector('.lextide-translation'));f.bubble.click();await tick();assert.equal(f.reader.enabled,false);assert.equal(f.root.querySelectorAll('.lextide-translation').length,0);}finally{f.reader.destroy();}
});
test('consecutive article replacements translate only the newest content',async()=>{
 const sent=[],f=await fixture({transport:async(_type,text)=>{sent.push(text);return '最新文章的译文';}});try{await f.reader.setMode('bilingual');await Promise.all([f.reader.replaceContent(()=>{f.root.innerHTML='<p class="english">The superseded public article.</p>';}),f.reader.replaceContent(()=>{f.root.innerHTML='<p class="english">The latest public article.</p>';})]);assert.deepEqual(sent,['The latest public article.']);assert.match(f.root.textContent,/最新文章的译文/);assert.doesNotMatch(f.root.textContent,/superseded/);}finally{f.reader.destroy();}
});
test('leaving during delayed initialization cannot start translation for replaced content',async()=>{
 const {window}=parseHTML('<html><body><main><p>Initial public text.</p></main></body></html>');window.getSelection=()=>({isCollapsed:true});globalThis.window=window;globalThis.document=window.document;let finish,calls=0;const root=document.querySelector('main'),reader=mountReader({root,store:{prefs:()=>new Promise(resolve=>finish=resolve),savePrefs:async()=>{},words:async()=>[]},transport:async()=>{calls++;return 'Unexpected late translation';}});const first=reader.replaceContent(()=>{root.innerHTML='<p>The first replacement.</p>';});const second=reader.replaceContent(()=>{root.innerHTML='<p>The second replacement.</p>';});reader.destroy();finish({...DEFAULT_PREFS,enabled:true,words:true,online:true});await Promise.all([first,second,reader.ready]);await tick();assert.equal(calls,0);assert.equal(root.textContent,'The second replacement.');assert.equal(document.querySelector('lextide-reader'),null);
});
test('explicit toolbar lookup activation exits pause without starting or forgetting the selected display mode',async()=>{
 const f=await fixture();try{await f.reader.setTranslationUnit('sentence');await f.reader.setMode('bilingual');f.bubble.click();await tick();const calls=f.calls;await f.reader.setWords(true,{activate:true});assert.equal(f.reader.preferences.words,true);assert.equal(f.reader.paused,false);assert.equal(f.reader.enabled,false);assert.equal(f.reader.preferences.mode,'bilingual');assert.equal(f.reader.preferences.translationUnit,'sentence');assert.equal(f.root.querySelectorAll('.lextide-translation').length,0);assert.equal(f.calls,calls);f.bubble.click();await tick();f.bubble.click();await tick();assert.equal(f.reader.preferences.words,true);assert.equal(f.reader.enabled,false);}finally{f.reader.destroy();}
});
for(const kind of ['reordered','layout','normalized-online'])test('external '+kind+' preference refresh retains the paused feature choice',async()=>{
 const f=await fixture();try{await f.reader.setMode('bilingual');f.bubble.click();await tick();const prefs=f.reader.preferences,next=kind==='reordered'?Object.fromEntries(Object.entries(prefs).reverse()):kind==='layout'?{...prefs,side:'left'}:{...prefs,online:false},calls=f.calls;await f.reader.configure(next);assert.equal(f.reader.shadow.querySelector('#bilingual-enabled').checked,true);assert.equal(f.reader.paused,true);assert.equal(f.reader.enabled,false);assert.equal(f.calls,calls);if(kind==='layout')assert.equal(f.reader.preferences.side,'left');f.bubble.click();await tick();assert.equal(f.reader.enabled,true);}finally{f.reader.destroy();}
});
test('external explicit feature changes still replace the paused choice without starting body translation',async()=>{
 const f=await fixture();try{await f.reader.setMode('bilingual');f.bubble.click();await tick();const calls=f.calls;await f.reader.configure({...f.reader.preferences,words:true,enabled:false,mode:'original'});assert.equal(f.reader.paused,false);assert.equal(f.reader.preferences.words,true);assert.equal(f.reader.enabled,false);assert.equal(f.reader.mode,'original');assert.equal(f.calls,calls);}finally{f.reader.destroy();}
});
