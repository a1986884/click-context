import {test} from 'node:test';import assert from 'node:assert/strict';import {demoStore,createStore} from '../src/storage.js';
const entry={word:'bank',lemma:'bank',zh:'银行',sentence:''};
function browserStorage(initial){const data=new Map(Object.entries(initial));let writes=0;globalThis.localStorage={getItem:k=>data.get(k)??null,setItem:(k,v)=>{writes++;data.set(k,String(v));}};return {data,get writes(){return writes;}};}
test('invalid vocabulary JSON is visible as a read error and all writes preserve its raw bytes',async()=>{
 for(const broken of ['{"broken":','[unclosed','']){
  const fixture=browserStorage({'lextide:v2:words':broken}),store=demoStore();
  try{for(const action of [()=>store.words(),()=>store.saveWord(entry),()=>store.removeWord('bank'),()=>store.importWords({version:2,words:[entry]})])await assert.rejects(action,e=>e.code==='VOCABULARY_READ_FAILED');assert.equal(fixture.data.get('lextide:v2:words'),broken);assert.equal(fixture.writes,0);
   fixture.data.set('lextide:v2:words','[]');await store.saveWord(entry);assert.equal((await store.words()).length,1);
  }finally{delete globalThis.localStorage;}
 }
});
test('a non-array stored vocabulary cannot look empty or be overwritten by any mutation',async()=>{
 for(const value of [{unexpected:'object'},false,0,'wrong']){
  const data={words:value},before=structuredClone(value);let writes=0;const store=createStore({get:async k=>data[k],set:async(k,v)=>{writes++;data[k]=v;}});
  for(const action of [()=>store.words(),()=>store.saveWord(entry),()=>store.removeWord('bank'),()=>store.importWords({version:2,words:[entry]})])await assert.rejects(action,e=>e.code==='VOCABULARY_READ_FAILED');assert.deepEqual(data.words,before);assert.equal(writes,0);
 }
});
test('reading legacy favorites needs no write and migration failure leaves the original backup readable',async()=>{
 const fixture=browserStorage({'lextide-saved':'["ocean","bank","ocean"]'}),store=demoStore();
 try{assert.deepEqual((await store.words()).map(w=>w.lemma),['ocean','bank']);assert.equal(fixture.writes,0);localStorage.setItem=()=>{throw new DOMException('Quota exceeded','QuotaExceededError');};await assert.rejects(store.saveWord(entry),e=>e.code==='STORAGE_FULL');assert.equal(fixture.data.get('lextide-saved'),'["ocean","bank","ocean"]');assert.equal((await store.words()).length,2);assert.equal(fixture.data.has('lextide:v2:words'),false);
 }finally{delete globalThis.localStorage;}
});
test('unreadable legacy data or storage access cannot silently create an empty vocabulary',async()=>{
 for(const raw of ['[broken','{"unexpected":true}','']){
  const fixture=browserStorage({'lextide-saved':raw}),store=demoStore();try{await assert.rejects(()=>store.saveWord(entry),e=>e.code==='VOCABULARY_READ_FAILED');assert.equal(fixture.writes,0);assert.equal(fixture.data.get('lextide-saved'),raw);}finally{delete globalThis.localStorage;}
 }
 globalThis.localStorage={getItem:()=>{throw new DOMException('Access denied','SecurityError');},setItem:()=>assert.fail('No write after read access denial')};try{await assert.rejects(()=>demoStore().saveWord(entry),e=>e.code==='VOCABULARY_READ_FAILED');}finally{delete globalThis.localStorage;}
});
test('missing vocabulary reads need no allocation while optional malformed prefs/cache still use defaults',async()=>{
 const fixture=browserStorage({'lextide:v2:prefs':'{bad','lextide:v2:translation-cache:v3:0':'{bad'}),store=demoStore();try{assert.deepEqual(await store.words(),[]);assert.equal(fixture.writes,0);assert.equal((await store.prefs()).enabled,false);await store.saveWord(entry);assert.equal((await store.words()).length,1);}finally{delete globalThis.localStorage;}
});
