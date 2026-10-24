import {test} from 'node:test';import assert from 'node:assert/strict';import {createStore} from '../src/storage.js';import {WORD_LIMIT} from '../src/vocabulary-data.js';
const entry={word:'bank',lemma:'bank',zh:'银行',sentence:''};
test('storage capacity errors are actionable, preserve existing data and do not poison later writes',async()=>{
 for(const failure of [new DOMException('The quota has been exceeded.','QuotaExceededError'),Error('QUOTA_BYTES quota exceeded')]){
  const data={words:[{word:'ocean',lemma:'ocean',zh:'海洋',sentence:''}]},original=structuredClone(data.words);let full=true;
  const store=createStore({get:async k=>data[k],set:(k,v)=>{if(full)throw failure;data[k]=structuredClone(v);}});
  await assert.rejects(store.saveWord(entry),e=>e.code==='STORAGE_FULL'&&/存储空间已满/.test(e.message)&&/导出|清除翻译缓存/.test(e.message));assert.deepEqual(data.words,original);full=false;await store.saveWord(entry);assert.equal(data.words.length,2);
 }
});
test('non-capacity write failures and write-rate quotas retain their original error',async()=>{
 for(const failure of [Error('Synthetic storage disconnected'),Error('MAX_WRITE_OPERATIONS_PER_MINUTE quota exceeded')]){
  const store=createStore({get:async()=>[],set:async()=>{throw failure;}});await assert.rejects(store.saveWord(entry),e=>e===failure);
 }
});
test('favorites at the logical limit remain intact and an existing use needs no storage write',async()=>{
 const words=Array.from({length:WORD_LIMIT},(_,i)=>({word:'study',lemma:'study',zh:'学习',sentence:'Example '+i+'.'}));let writes=0;
 const store=createStore({get:async()=>words,set:async()=>{writes++;throw Error('An unchanged favorite must not write');}});
 await assert.rejects(store.saveWord(entry),e=>e.code==='VOCABULARY_FULL');assert.equal(words.length,WORD_LIMIT);assert.equal(writes,0);await store.saveWord(words[0]);assert.equal(writes,0);
});
test('cache clearing does not allocate missing legacy/bucket keys when storage is full',async()=>{
 const data=new Map(),store=createStore({get:async k=>data.get(k),set:async(k,v)=>{if(!data.has(k))throw Error('QUOTA_BYTES quota exceeded');data.set(k,v);}});
 data.set('translation-cache:v3:0',{example:{at:0,value:'Cached translation'}});data.set('words',[entry]);await store.clearCache();assert.deepEqual(data.get('translation-cache:v3:0'),{});assert.equal(data.has('translations'),false);assert.equal(data.size,2);assert.deepEqual(data.get('words'),[entry]);
});
