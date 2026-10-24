import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseVocabularyBackup,selectVocabulary} from '../src/vocabulary-data.js';
import {createStore} from '../src/storage.js';
function setup(){const data={};return {data,store:createStore({get:async key=>structuredClone(data[key]),set:async(key,value)=>{data[key]=structuredClone(value);}})};}
test('vocabulary import validates the complete file before a non-destructive deduplicated merge',async()=>{
 const {store}=setup();await store.saveWord({word:'Ocean',lemma:'ocean',zh:'原有释义'});
 const result=await store.importWords({version:2,words:[{word:'ocean',zh:'不覆盖'},{word:'study',sentence:'I study here.'},{word:'study'}]});
 assert.deepEqual(result,{added:3,duplicates:0});const words=await store.words();assert.equal(words[0].zh,'原有释义');assert.equal(words[2].sentence,'I study here.');
 await assert.rejects(store.importWords({version:2,words:[{word:'valid'},{word:'<script>'}]}),/第 2 条/);assert.equal((await store.words()).length,4);
});
test('vocabulary import bounds fields and rejects incompatible or excessive backup data',()=>{
 assert.throws(()=>parseVocabularyBackup({version:3,words:[]}),/version 2/);
 assert.throws(()=>parseVocabularyBackup({version:2,words:Array(5001).fill({word:'unit'})}),/5,000/);
 const [word]=parseVocabularyBackup({version:2,words:[{word:'STUDY',zh:'中'.repeat(600),savedAt:'invalid'}]});assert.equal(word.lemma,'study');assert.equal(word.zh.length,500);assert.equal(word.savedAt,null);
});
test('vocabulary search includes Chinese and sentence context; sorting never mutates saved order',()=>{
 const words=[{lemma:'ocean',zh:'海洋',sentence:'Blue water',savedAt:'2026-10-18T00:00:00Z'},{lemma:'study',zh:'学习',sentence:'A blue book',savedAt:'2026-10-19T00:00:00Z'}];
 assert.deepEqual(selectVocabulary(words,'海洋').map(w=>w.lemma),['ocean']);assert.deepEqual(selectVocabulary(words,'BLUE').map(w=>w.lemma),['study','ocean']);assert.deepEqual(selectVocabulary(words,'','alpha').map(w=>w.lemma),['ocean','study']);assert.equal(words[0].lemma,'ocean');
});
test('deleted entries can be restored without losing their original context or overwriting a concurrent save',async()=>{
 const {store}=setup();await store.saveWord({word:'went',lemma:'go',sentence:'We went home.'});const [removed]=await store.words();await store.removeWord('go');await store.importWords({version:2,words:[removed]});assert.equal((await store.words())[0].sentence,'We went home.');
 await store.removeWord('go');await store.saveWord({word:'go',lemma:'go',sentence:'New context'});await store.importWords({version:2,words:[removed]});assert.equal((await store.words())[0].sentence,'New context');assert.equal((await store.words()).length,2);
});

test('phrase uses and different meanings survive export, merge and individual deletion',async()=>{
 const {store}=setup();const first={word:'take into account',lemma:'take into account',zh:'考虑到',sentence:'We take into account the costs.'};
 await store.saveWord(first);await store.saveWord(first);await store.saveWord({word:'bank',lemma:'bank',zh:'河岸',sentence:'We sat on the bank.'});await store.saveWord({word:'bank',lemma:'bank',zh:'银行',sentence:'She went to the bank.'});
 const words=await store.words();assert.equal(words.length,3);const copy=setup().store;await copy.importWords({version:2,words});assert.deepEqual((await copy.importWords({version:2,words})),{added:0,duplicates:3});
 const {vocabularyKey}=await import('../src/vocabulary-data.js');await copy.removeWord(vocabularyKey(words[1]));assert.deepEqual((await copy.words()).map(w=>w.zh),['考虑到','银行']);
});
