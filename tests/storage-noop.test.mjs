import {test} from 'node:test';import assert from 'node:assert/strict';import {createStore} from '../src/storage.js';
const bank={word:'bank',lemma:'bank',zh:'银行',sentence:'The bank accepts deposits.'};
test('merging an already restored backup and removing an absent word succeed without writes when storage is full',async()=>{
 const data={words:[bank]},before=structuredClone(data);let writes=0;
 const store=createStore({get:async k=>structuredClone(data[k]),set:async()=>{writes++;throw new DOMException('Quota exceeded','QuotaExceededError');}});
 assert.deepEqual(await store.importWords({version:2,words:[bank,bank]}),{added:0,duplicates:2});await store.removeWord('absent');assert.equal(writes,0);assert.deepEqual(data,before);
 await assert.rejects(store.importWords({version:2,words:[{word:'<invalid>'}]}),/未导入任何内容/);assert.equal(writes,0);
 await assert.rejects(store.importWords({version:2,words:[{word:'river'}]}),e=>e.code==='STORAGE_FULL');assert.equal(writes,1);assert.deepEqual(data,before);
});
test('no-op detection waits for a preceding save and retains that newly saved use',{timeout:1000},async()=>{
 const river={word:'river',lemma:'river',zh:'河流',sentence:''},data={words:[bank]};let writes=0,release;
 const store=createStore({get:async k=>structuredClone(data[k]),set:async(k,v)=>{writes++;if(writes>1)throw Error('Unchanged backup attempted another write');await new Promise(r=>release=r);data[k]=structuredClone(v);}});
 const save=store.saveWord(river);await new Promise(setImmediate);const merge=store.importWords({version:2,words:[bank,river]});release();await save;
 assert.deepEqual(await merge,{added:0,duplicates:2});assert.equal(writes,1);assert.deepEqual(data.words.map(w=>w.lemma),['bank','river']);
});
