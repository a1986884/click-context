import {test} from 'node:test';import assert from 'node:assert/strict';import {parseHTML} from 'linkedom';import {mountVocabulary} from '../src/vocabulary-view.js';import {createStore} from '../src/storage.js';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('candidate provenance remains visible after backup import, refresh, deletion and restoration',async()=>{
 const {window}=parseHTML('<html><body><section></section></body></html>');globalThis.window=window;globalThis.document=window.document;
 const values=new Map(),store=createStore({get:async key=>structuredClone(values.get(key)),set:async(key,value)=>values.set(key,structuredClone(value))});
 const provenance='AI 语境释义；候选含义（未确认）';await store.saveWord({word:'terminal',lemma:'terminal',zh:'航站楼',sentence:'The terminal is closed.',dictionarySource:provenance});
 const backup=JSON.parse(JSON.stringify({version:2,words:await store.words()}));await store.removeWord('terminal');await store.importWords(backup);
 const root=document.querySelector('section'),view=mountVocabulary({root,store});await view.refresh();assert.equal(root.querySelector('.vocab-provenance').textContent,provenance);
 await root.querySelector('#vocab-list button').onclick();assert.equal(root.querySelector('.vocab-provenance'),null);await root.querySelector('#vocab-undo').onclick();assert.equal(root.querySelector('.vocab-provenance').textContent,provenance);await view.refresh();assert.equal(root.querySelector('.vocab-provenance').textContent,provenance);
});
test('imported provenance is rendered as literal text and legacy records stay readable',async()=>{
 const {window}=parseHTML('<html><body><section></section></body></html>');globalThis.window=window;globalThis.document=window.document;
 const provenance='<img src=x onerror=alert(1)>；候选含义（未确认）',root=document.querySelector('section');
 const view=mountVocabulary({root,store:{words:async()=>[{word:'bank',lemma:'bank',zh:'银行',dictionarySource:provenance},{word:'ocean',lemma:'ocean',zh:'海洋'}]}});await view.refresh();
 assert.equal(root.querySelector('.vocab-provenance').textContent,provenance);assert.equal(root.querySelector('img'),null);assert.equal(root.querySelectorAll('.word-row').length,2);assert.equal(root.querySelectorAll('.vocab-provenance').length,1);
});
function setup(){const {window}=parseHTML('<html><body><section></section></body></html>');globalThis.window=window;globalThis.document=window.document;const data={words:[{word:'bank',lemma:'bank',zh:'银行',sentence:''},{word:'ocean',lemma:'ocean',zh:'海洋',sentence:''}]};const base=createStore({get:async k=>structuredClone(data[k]),set:async(k,v)=>{data[k]=structuredClone(v);}}),jobs=[];const store={...base,importWords:value=>new Promise((resolve,reject)=>jobs.push({commit:async()=>resolve(await base.importWords(value)),reject}))};const root=document.querySelector('section'),view=mountVocabulary({root,store});return {base,jobs,root,view,$:s=>root.querySelector(s)};}
test('a completed undo cannot discard a newer deleted word or its undo action',async()=>{const {base,jobs,view,$}=setup();await view.refresh();await $('#vocab-list button').onclick();const firstUndo=$('#vocab-undo').onclick();assert.equal(jobs.length,1);await $('#vocab-list button').onclick();await jobs[0].commit();await firstUndo;assert.equal($('#vocab-undo').hidden,false);const secondUndo=$('#vocab-undo').onclick();assert.equal(jobs.length,2);await jobs[1].commit();await secondUndo;assert.deepEqual((await base.words()).map(w=>w.lemma).sort(),['bank','ocean']);assert.equal($('#vocab-undo').hidden,true);});
test('an in-flight undo blocks duplicate requests and a failed undo can be retried',async()=>{const {jobs,view,$}=setup();await view.refresh();await $('#vocab-list button').onclick();const first=$('#vocab-undo').onclick();assert.equal($('#vocab-undo').disabled,true);await $('#vocab-undo').onclick();assert.equal(jobs.length,1);jobs[0].reject(Error('Synthetic import failure'));await first;assert.equal($('#vocab-undo').disabled,false);assert.equal($('#vocab-undo').hidden,false);const retry=$('#vocab-undo').onclick();assert.equal(jobs.length,2);await jobs[1].commit();await retry;assert.equal($('#vocab-undo').hidden,true);});
test('failure of an older undo leaves the newer deleted word available to restore',async()=>{const {base,jobs,view,$}=setup();await view.refresh();await $('#vocab-list button').onclick();const first=$('#vocab-undo').onclick();await $('#vocab-list button').onclick();jobs[0].reject(Error('Synthetic import failure'));await first;assert.equal($('#vocab-undo').hidden,false);const second=$('#vocab-undo').onclick();await jobs[1].commit();await second;await tick();assert.deepEqual((await base.words()).map(w=>w.lemma),['ocean']);});

test('an oversized backup is rejected before reading without changing existing favorites',async()=>{
 const {BACKUP_FILE_LIMIT}=await import('../src/vocabulary-data.js');const {base,jobs,view,$}=setup();await view.refresh();const before=await base.words();let reads=0;const input={files:[{size:BACKUP_FILE_LIMIT+1,text:async()=>{reads++;return '{}';}}],value:'oversized.json'};
 await $('#import-words').onchange({target:input});assert.equal(reads,0);assert.equal(jobs.length,0);assert.match($('#vocab-status').textContent,/16 MB/);assert.equal(input.value,'');assert.deepEqual(await base.words(),before);
});
test('a backup at the byte ceiling still reaches normal record validation and merge',async()=>{
 const {BACKUP_FILE_LIMIT}=await import('../src/vocabulary-data.js');const {base,jobs,view,$}=setup();await view.refresh();const input={files:[{size:BACKUP_FILE_LIMIT,text:async()=>JSON.stringify({version:2,words:[{word:'river',zh:'河流'}]})}],value:'boundary.json'};
 const pending=$('#import-words').onchange({target:input});await tick();assert.equal(jobs.length,1);await jobs[0].commit();await pending;assert.equal((await base.words()).length,3);assert.match($('#vocab-status').textContent,/新增 1/);assert.equal(input.value,'');
});

test('sequential deletions can all be undone in reverse order and the undo bar stays available',async()=>{
 const {base,jobs,view,$}=setup();await view.refresh();await $('#vocab-list button').onclick();await $('#vocab-list button').onclick();assert.equal((await base.words()).length,0);assert.equal($('#vocab-undo-bar').hidden,false);assert.match($('#vocab-undo').textContent,/2 条/);assert.match($('#vocab-undo-message').textContent,/刷新页面/);
 const first=$('#vocab-undo').onclick();await jobs[0].commit();await first;assert.equal((await base.words())[0].lemma,'ocean');assert.equal($('#vocab-undo-bar').hidden,false);assert.equal($('#vocab-undo').disabled,false);
 const second=$('#vocab-undo').onclick();await jobs[1].commit();await second;assert.equal((await base.words()).length,2);assert.equal($('#vocab-undo-bar').hidden,true);
});
test('failed undo retains every deletion and reports retry beside the visible undo action',async()=>{
 const {base,jobs,view,$}=setup();await view.refresh();await $('#vocab-list button').onclick();await $('#vocab-list button').onclick();const failed=$('#vocab-undo').onclick();jobs[0].reject(Error('模拟恢复失败'));await failed;assert.match($('#vocab-undo-message').textContent,/模拟恢复失败.*重试/);assert.match($('#vocab-undo').textContent,/2 条/);
 const retry=$('#vocab-undo').onclick();await jobs[1].commit();await retry;const older=$('#vocab-undo').onclick();await jobs[2].commit();await older;assert.equal((await base.words()).length,2);
});
test('restoring a filtered-out word preserves the filter and explains why the row is not shown',async()=>{
 const {base,jobs,view,$}=setup();await view.refresh();await $('#vocab-list button').onclick();$('#vocab-search').value='ocean';$('#vocab-search').oninput();const restore=$('#vocab-undo').onclick();await jobs[0].commit();await restore;assert.equal($('#vocab-search').value,'ocean');assert.equal((await base.words()).length,2);assert.match($('#vocab-status').textContent,/当前筛选/);assert.equal($('#vocab-clear-filter').hidden,false);
});
