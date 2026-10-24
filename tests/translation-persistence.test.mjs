import {test} from 'node:test';import assert from 'node:assert/strict';import {parseHTML} from 'linkedom';import {ParagraphTranslator} from '../src/translation.js';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function setup(cacheSet,cacheGet=async()=>null,translate=async()=> '已经收到的中文译文'){const {window}=parseHTML('<html><body><main><p>A translated paragraph.</p></main></body></html>');globalThis.window=window;globalThis.document=window.document;const root=document.querySelector('main'),reports=[];return {root,reports,translator:new ParagraphTranslator({root,interval:0,store:{cacheGet,cacheSet},translate,report:text=>reports.push(text)})};}
test('a received translation is visible before its optional cache write completes',{timeout:5000},async()=>{let finish;const {root,translator}=setup(()=>new Promise(resolve=>finish=resolve));const pending=translator.start('bilingual',true);try{await tick();assert.equal(typeof finish,'function');assert.equal(root.querySelector('.lextide-translation-text')?.textContent,'已经收到的中文译文');}finally{finish?.();await pending;translator.stop();}});
test('shutdown completes even if a cache write is still pending and late failure cannot change a newer report',{timeout:5000},async()=>{let reject;const {root,translator,reports}=setup(()=>new Promise((_resolve,no)=>reject=no));const pending=translator.start('bilingual',true);await tick();translator.stop();await pending;assert.equal(root.querySelector('.lextide-translation'),null);reports.push('New reading state');reject(Error('Synthetic late cache failure'));await tick();assert.equal(reports.at(-1),'New reading state');assert.equal(root.textContent,'A translated paragraph.');});
test('a synchronous cache write failure cannot turn a valid translation into an error',{timeout:5000},async()=>{const {root,translator}=setup(()=>{throw Error('Synthetic cache failure');});try{await translator.start('bilingual',true);assert.equal(root.querySelector('.lextide-translation-text')?.textContent,'已经收到的中文译文');assert.equal(root.querySelector('.lextide-translation button'),null);}finally{translator.stop();}});

test('a synchronous or asynchronous optional cache read failure still allows online translation',{timeout:5000},async()=>{
 for(const cacheGet of [()=>{throw Error('Synthetic synchronous cache read failure');},async()=>{throw Error('Synthetic rejected cache read');}]){
  let requests=0,writes=0;const {root,translator}=setup(async()=>writes++,cacheGet,async()=>{requests++;return '联网成功译文';});
  try{await translator.start('bilingual',true);assert.equal(root.querySelector('.lextide-translation-text')?.textContent,'联网成功译文');assert.equal(root.querySelectorAll('.lextide-translation button').length,0);assert.equal(requests,1);assert.equal(writes,1);}finally{translator.stop();}
 }
});
test('cache read failure never bypasses offline mode or hides the real upstream failure',{timeout:5000},async()=>{
 let requests=0;const {root,translator}=setup(async()=>{},async()=>{throw Error('Synthetic cache read failure');},async()=>{requests++;throw Error('Actual provider failure');});
 try{await translator.start('bilingual',false);assert.equal(requests,0);assert.match(root.querySelector('.lextide-translation').textContent,/当前无法联网翻译/);await translator.start('bilingual',true);assert.equal(requests,1);assert.match(root.querySelector('.lextide-translation').textContent,/Actual provider failure/);}finally{translator.stop();}
});
test('cancelled cache reads do not launch translation and late rejection cannot modify a newer session',{timeout:5000},async()=>{
 let reject,requests=0;const {root,translator,reports}=setup(async()=>{},()=>new Promise((_resolve,no)=>reject=no),async()=>{requests++;return '不得请求';});
 const pending=translator.start('bilingual',true);await tick();translator.stop();await pending;reports.push('Current session');reject(Error('Late cache read failure'));await tick();assert.equal(requests,0);assert.equal(root.querySelectorAll('.lextide-translation').length,0);assert.equal(reports.at(-1),'Current session');
});
