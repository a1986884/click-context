import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {mountReader} from '../src/reader.js';
import {createStore,DEFAULT_PREFS} from '../src/storage.js';
const tick=()=>new Promise(setImmediate);
function setup(){const {window}=parseHTML('<html><body><main><p>A public article.</p></main></body></html>');window.getSelection=()=>({isCollapsed:true});globalThis.window=window;globalThis.document=window.document;return document.querySelector('main');}
test('a failed old preference write cannot overwrite feedback after a newer successful choice',async()=>{
 const root=setup(),values=new Map([['prefs',{...DEFAULT_PREFS,mode:'original'}]]);let fail,first=true;
 const store=createStore({get:async key=>values.get(key),set:async(key,value)=>{if(first){first=false;await new Promise((_resolve,reject)=>fail=reject);}values.set(key,structuredClone(value));}}),reader=mountReader({root,store});
 try{await reader.ready;const older=reader.setWords(false);await tick();const latest=reader.setWords(true);await tick();fail(Error('Synthetic old save failure'));await Promise.all([older,latest]);assert.equal(values.get('prefs').words,true);assert.equal(reader.preferences.words,true);assert.match(reader.shadow.querySelector('#status').textContent,/查词开启/);assert.doesNotMatch(reader.shadow.querySelector('#status').textContent,/无法保存/);}finally{reader.destroy();}
});
test('the latest preference write failure remains visible and the current page stays usable',async()=>{
 const root=setup(),store=createStore({get:async()=>({...DEFAULT_PREFS,mode:'original'}),set:async()=>{throw Error('Synthetic current save failure');}}),reader=mountReader({root,store});
 try{await reader.ready;await reader.setWords(false);assert.equal(reader.preferences.words,false);assert.match(reader.shadow.querySelector('#status').textContent,/偏好无法保存，本页仍可使用/);assert.equal(reader.shadow.querySelector('.bubble').getAttribute('aria-pressed'),'false');}finally{reader.destroy();}
});
test('a synchronous preference adapter failure is reported without breaking reader controls',async()=>{
 const root=setup(),reader=mountReader({root,store:{prefs:async()=>({...DEFAULT_PREFS,mode:'original'}),savePrefs(){throw Error('PRIVATE_ADAPTER_DETAILS');},words:async()=>[]}});
 try{await reader.ready;await reader.setWords(false);assert.equal(reader.preferences.words,false);assert.match(reader.shadow.querySelector('#status').textContent,/无法保存/);assert.doesNotMatch(reader.shadow.querySelector('#status').textContent,/PRIVATE_ADAPTER_DETAILS/);}finally{reader.destroy();}
});
