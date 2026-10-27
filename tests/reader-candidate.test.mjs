import {test} from 'node:test';import assert from 'node:assert/strict';import {parseHTML} from 'linkedom';
import {mountReader} from '../src/reader.js';import {createStore,DEFAULT_PREFS} from '../src/storage.js';
for(const matched of [false,true])test('v6 distinguishes a possible AI reading from an exact dictionary match: '+matched,async()=>{
 const {window}=parseHTML('<html><body><main><p>The terminal is closed.</p></main></body></html>');window.getSelection=()=>({isCollapsed:true});globalThis.window=window;globalThis.document=window.document;
 const values=new Map([['prefs',DEFAULT_PREFS]]),store=createStore({get:async k=>values.get(k),set:async(k,v)=>values.set(k,structuredClone(v))});
 const reader=mountReader({root:document.querySelector('main'),store,transport:async type=>type==='lookup'?{word:'terminal',lemma:'terminal',kind:'collins',source:'Synthetic Collins fixture',senses:[{id:'transport',lemma:'terminal',pos:'NOUN',zh:'终点站',definition:'A travel endpoint.'}]}:{senseId:null,lemma:'terminal',pos:'NOUN',zh:matched?'终点站':'航站楼',method:'ai-context-v6'}});
 try{await reader.show('terminal',document.querySelector('main'),'The terminal is closed.',4);const r=reader.shadow;
  if(matched){assert.match(r.querySelector('.dictionary-label').textContent,/Collins/);assert.match(r.querySelector('.sense-status').textContent,/AI 按原句匹配/);assert.doesNotMatch(r.querySelector('.sense-status').textContent,/候选/);}
  else{assert.equal(r.querySelector('.zh').textContent,'航站楼');assert.match(r.querySelector('.dictionary-label').textContent,/AI.*候选/);assert.match(r.querySelector('.sense-status').textContent,/可能.*候选/);assert.match(r.querySelector('.zh-source').textContent,/尚未确认/);assert.equal(r.querySelector('#save').textContent,'收藏候选');assert.match(r.querySelector('#save-hint').textContent,/未确认/);await r.querySelector('#save').onclick();assert.match((await store.words())[0].dictionarySource,/候选含义（未确认）/);assert.equal(r.querySelector('#save-hint').hidden,true);
   await r.querySelector('#vocabulary').onclick();assert.match(r.querySelector('.vocab-provenance').textContent,/候选含义（未确认）/);r.querySelector('.vocab .close').onclick();
   await reader.show('terminal',document.querySelector('main'),'The terminal is closed.',4);
   const select=r.querySelector('#sense-choice');for(const option of select.options)option.selected=option.value==='transport';select.dispatchEvent(new window.Event('change'));assert.equal(r.querySelector('.zh').textContent,'终点站');assert.equal(r.querySelector('.sense-status').textContent,'已选择该义项');assert.doesNotMatch(r.querySelector('.dictionary-label').textContent,/候选/);
  }
 }finally{reader.destroy();}
});
test('v6 context failure never presents or saves an arbitrary first dictionary sense as the contextual meaning',async()=>{
 const {window}=parseHTML('<html><body><main><p>The terminal is closed.</p></main></body></html>');window.getSelection=()=>({isCollapsed:true});globalThis.window=window;globalThis.document=window.document;
 const values=new Map([['prefs',DEFAULT_PREFS]]),store=createStore({get:async k=>values.get(k),set:async(k,v)=>values.set(k,structuredClone(v))});
 const reader=mountReader({root:document.querySelector('main'),store,contextRevision:'ai-context-v6',transport:async type=>{if(type==='lookup')return {word:'terminal',lemma:'terminal',kind:'collins',source:'Synthetic Collins fixture',senses:[{id:'disease',lemma:'terminal',pos:'ADJ',zh:'晚期的',definition:'A terminal illness.'},{id:'transport',lemma:'terminal',pos:'NOUN',zh:'终点站',definition:'A travel endpoint.'}]};throw Object.assign(Error('Synthetic unavailable response'),{code:'CONTEXT_UNAVAILABLE'});}});
 try{await reader.ready;const before=reader.preferences;await reader.show('terminal',document.querySelector('main'),'The terminal is closed.',4);const r=reader.shadow;assert.equal(r.querySelector('.zh').textContent,'此处含义未确认');assert.doesNotMatch(r.querySelector('.defs').textContent,/illness/);assert.equal(r.querySelector('#save').disabled,true);await r.querySelector('#save').onclick();assert.equal((await store.words()).length,0);assert.equal(reader.preferences.mode,before.mode);assert.equal(reader.preferences.words,before.words);
  assert.match(r.querySelector('#save-hint').textContent,/先选择一个词典义项/);assert.equal(r.querySelector('#save').getAttribute('aria-describedby'),'save-hint');
  r.querySelector('#collapse-dict').onclick();assert.equal(r.querySelector('#save-hint').hidden,true);r.querySelector('#collapse-dict').onclick();assert.equal(r.querySelector('#save-hint').hidden,false);
  const select=r.querySelector('#sense-choice');for(const option of select.options)option.selected=option.value==='transport';select.dispatchEvent(new window.Event('change'));assert.equal(r.querySelector('.zh').textContent,'终点站');assert.equal(r.querySelector('#save').disabled,false);assert.equal(r.querySelector('#save-hint').hidden,true);await r.querySelector('#save').onclick();assert.equal((await store.words())[0].zh,'终点站');
 }finally{reader.destroy();}
});
test('an AI candidate without dictionary entries does not promise an unavailable dictionary action',async()=>{
 const {window}=parseHTML('<html><body><main><p>The bass player arrived.</p></main></body></html>');window.getSelection=()=>({isCollapsed:true});globalThis.window=window;globalThis.document=window.document;
 const values=new Map([['prefs',DEFAULT_PREFS]]),store=createStore({get:async k=>values.get(k),set:async(k,v)=>values.set(k,structuredClone(v))});
 const reader=mountReader({root:document.querySelector('main'),store,transport:async type=>type==='lookup'?{word:'bass',lemma:'bass',kind:'unavailable',source:'Dictionary unavailable',dictionaryError:'Synthetic unavailable fixture',senses:[]}:{senseId:null,lemma:'bass',pos:'NOUN',zh:'低音乐器',method:'ai-context-v6'}});
 try{await reader.show('bass',document.querySelector('main'),'The bass player arrived.',4);const source=reader.shadow.querySelector('.zh-source').textContent;assert.match(source,/当前没有可核对的词典义项/);assert.doesNotMatch(source,/下拉|可查看/);assert.equal(reader.shadow.querySelector('.sense-picker').hidden,true);assert.match(reader.shadow.querySelector('.dictionary-label').textContent,/AI.*候选/);}finally{reader.destroy();}
});
