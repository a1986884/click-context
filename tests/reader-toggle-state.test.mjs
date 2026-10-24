import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {mountReader} from '../src/reader.js';
import {createStore,DEFAULT_PREFS} from '../src/storage.js';
const tick=()=>new Promise(setImmediate);
async function fixture(){
 const {window}=parseHTML('<html><body><main><p class="english" data-translation="这是第一段。">The first paragraph.</p><p class="english" data-translation="这是第二段。">The second paragraph.</p></main></body></html>');window.getSelection=()=>({isCollapsed:true});globalThis.window=window;globalThis.document=window.document;
 const values=new Map([['prefs',{...DEFAULT_PREFS,words:true,online:true}]]);let writes=0,calls=0;
 const store=createStore({get:async k=>values.get(k),set:async(k,v)=>{writes++;values.set(k,structuredClone(v));}});
 const reader=mountReader({root:document.querySelector('main'),demo:true,store,transport:async()=>{calls++;throw Error('Unexpected network fixture call');}});await reader.ready;await tick();
 return {reader,root:document.querySelector('main'),bubble:reader.shadow.querySelector('.bubble'),get writes(){return writes;},get calls(){return calls;}};
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
