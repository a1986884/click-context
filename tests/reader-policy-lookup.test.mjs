import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {mountReader} from '../src/reader.js';
import {DEFAULT_PREFS} from '../src/storage.js';
const tick=()=>new Promise(setImmediate);
function fixture({initialWords=false}={}){
 const {window}=parseHTML('<html><body><main><p>The bank approved the loan.</p></main></body></html>');window.getSelection=()=>({isCollapsed:true});globalThis.window=window;globalThis.document=window.document;
 const root=document.querySelector('main'),jobs=[],sent=[];let words=initialWords;
 const store={prefs:async()=>({...DEFAULT_PREFS,mode:'original',words:initialWords}),words:async()=>[],savePrefs:p=>new Promise(resolve=>{const snapshot={...p};jobs.push({commit(){words=snapshot.words;resolve();}});})};
 const reader=mountReader({root,store,transport:async(type,_word,_online,{signal})=>{signal.throwIfAborted();sent.push({type,allowed:words});assert.equal(words,true,'saved background policy must permit lookup');return type==='lookup'?{word:'bank',lemma:'bank',kind:'collins',senses:[{id:'bank',lemma:'bank',zh:'银行',pos:'NOUN',definition:'A financial institution.'}],source:'Synthetic Collins fixture'}:{senseId:'bank',zh:'银行'};}});
 return {root,reader,jobs,sent};
}
test('lookup and context wait for pending preference activation before contacting the background',async()=>{
 const f=fixture();try{await f.reader.ready;const enabled=f.reader.setWords(true);await tick();const lookup=f.reader.show('bank',f.root,'The bank approved the loan.',4);await tick();assert.equal(f.reader.preferences.words,true);assert.equal(f.sent.length,0,'no request before preference save');f.jobs[0].commit();await Promise.all([enabled,lookup]);assert.deepEqual(f.sent.map(x=>x.type),['lookup','context']);assert.ok(f.sent.every(x=>x.allowed));assert.equal(f.reader.shadow.querySelector('.zh').textContent,'银行');}finally{f.reader.destroy();for(const job of f.jobs)job.commit();}
});
test('closing a pending activation releases lookup and never sends after its delayed save',async()=>{
 const f=fixture();let timer;try{await f.reader.ready;const enabled=f.reader.setWords(true);await tick();const lookup=f.reader.show('bank',f.root,'The bank approved the loan.',4);await tick();f.reader.restore();await tick();await Promise.race([lookup,new Promise((_resolve,reject)=>timer=setTimeout(()=>reject(Error('Cancelled lookup stayed blocked on storage')),200))]);for(const job of f.jobs)job.commit();await enabled;await tick();assert.equal(f.sent.length,0);assert.equal(f.reader.shadow.querySelector('.dict').hidden,true);}finally{clearTimeout(timer);f.reader.destroy();for(const job of f.jobs)job.commit();}
});
test('an unrelated pending layout save does not block an already permitted dictionary request',async()=>{
 const f=fixture({initialWords:true});try{await f.reader.ready;f.reader.shadow.querySelector('#side').onchange({target:{value:'left'}});await tick();await f.reader.show('bank',f.root,'The bank approved the loan.',4);assert.equal(f.sent.length,2);assert.ok(f.sent.every(x=>x.allowed));assert.equal(f.reader.shadow.querySelector('.zh').textContent,'银行');}finally{f.reader.destroy();for(const job of f.jobs)job.commit();}
});
test('first activation never blocks a second main-switch click on slow storage',async()=>{
 const f=fixture();try{await f.reader.ready;const bubble=f.reader.shadow.querySelector('.bubble');bubble.click();await tick();assert.equal(f.reader.preferences.words,true);assert.equal(f.jobs.length,1);bubble.click();await tick();assert.equal(f.reader.preferences.words,false,'a second click must pause even before the first save completes');assert.equal(f.reader.paused,true);assert.equal(f.jobs.length,2);assert.equal(f.sent.length,0);for(const job of f.jobs)job.commit();await tick();assert.equal(f.reader.preferences.words,false);}finally{f.reader.destroy();for(const job of f.jobs)job.commit();}
});
