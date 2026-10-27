import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {mountReader} from '../src/reader.js';
import {createStore,DEFAULT_PREFS} from '../src/storage.js';
const tick=()=>new Promise(setImmediate);
for(const failure of [{code:'CONTEXT_UNAVAILABLE'},{code:'RATE_LIMITED'},{code:'CONTEXT_INVALID_RESULT',validationReason:'incomplete'}])test('manual retry retains the original occurrence after '+failure.code,async()=>{
 const {window}=parseHTML('<html><body><main><p>She wound the bandage around the wound.</p></main></body></html>');window.getSelection=()=>({isCollapsed:true});globalThis.window=window;globalThis.document=window.document;
 const root=document.querySelector('main'),values=new Map([['prefs',{...DEFAULT_PREFS,mode:'original',online:true}]]),store=createStore({get:async key=>values.get(key),set:async(key,value)=>values.set(key,structuredClone(value))}),contexts=[];
 const senses=[{id:'injury',lemma:'wound',pos:'NOUN',zh:'伤口',definition:'An injury to the body.'},{id:'wrap',lemma:'wind',pos:'VERB',zh:'缠绕',definition:'To wrap something around another object.'}];
 const reader=mountReader({root,store,transport:async(type,word,_online,options)=>{
  if(type==='lookup'){assert.equal(word,'wound');return {word:'wound',lemma:'wound',kind:'collins',senses,source:'Synthetic Collins fixture'};}
  contexts.push(structuredClone(options.context));if(contexts.length===1)throw Object.assign(Error('PRIVATE_UPSTREAM_DETAILS'),failure);return {senseId:'wrap',lemma:'wind',pos:'VERB',zh:'缠绕'};
 }});
 try{await reader.show('wound',root,'She wound the bandage around the wound.',4);assert.equal(reader.shadow.querySelector('.zh').textContent,'伤口');assert.equal(reader.shadow.querySelector('#retry').hidden,false);assert.match(reader.shadow.querySelector('.sense-status').textContent,/当前显示词典原义/);assert.doesNotMatch(reader.shadow.querySelector('.sense-status').textContent,/PRIVATE_UPSTREAM_DETAILS/);
 reader.shadow.querySelector('#retry').click();await tick();await tick();assert.equal(contexts.length,2);for(const input of contexts){assert.equal(input.word,'wound');assert.equal(input.sentence,'She wound the bandage around the wound.');assert.equal(input.offset,4);}assert.equal(reader.shadow.querySelector('.zh').textContent,'缠绕');assert.match(reader.shadow.querySelector('.sense-status').textContent,/按原句匹配/);assert.equal(reader.shadow.querySelector('#retry').hidden,true);assert.equal(reader.shadow.querySelector('.word').textContent,'wound');
 }finally{reader.destroy();}
});
