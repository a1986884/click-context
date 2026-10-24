import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {mountReader,sentenceAt} from '../src/reader.js';
import {createStore,CACHE_TTL,remoteStore} from '../src/storage.js';
import {resolveForm} from '../src/morphology.js';
import {lookup} from '../src/core.js';
import {ParagraphTranslator,paragraphs} from '../src/translation.js';
function storage(options){const data={};return {data,store:createStore({get:async k=>data[k],set:async(k,v)=>{data[k]=structuredClone(v);} },options)};}
function setup(html='<p class="english" data-translation="海洋">The <em data-word="ocean">ocean</em>.</p>'){
 const {window}=parseHTML('<html><body><article>'+html+'</article></body></html>');window.getSelection=()=>({isCollapsed:true});globalThis.window=window;globalThis.document=window.document;return document.querySelector('article');
}
const tick=()=>new Promise(setImmediate);
test('three modes retain node identity, images, links and original hidden attributes',async()=>{
 const root=setup('<p class="english" data-translation="海洋">The ocean.</p><p class="english" data-translation="链接"><a href="/safe">ocean</a><img src="x" alt="test"></p>');const originals=[...root.children],link=root.querySelector('a'),img=root.querySelector('img');const {store}=storage();const r=mountReader({root,demo:true,store});await r.ready;
 for(let n=0;n<3;n++){await r.setMode('bilingual');assert.equal(root.querySelectorAll('.lextide-translation').length,2);assert.equal(originals[0].hidden,false);await r.setMode('translated');assert.equal(originals[0].hidden,true);assert.equal(originals[1].hidden,false);root.querySelector('.lextide-translation button').click();assert.equal(originals[0].hidden,false);await r.setMode('original');assert.equal(root.querySelectorAll('.lextide-translation').length,0);assert.equal(root.firstChild,originals[0]);assert.equal(root.querySelector('a'),link);assert.equal(root.querySelector('img'),img);assert.equal(originals[0].hasAttribute('hidden'),false);}
 r.destroy();
});
test('lookup works independently in original mode, and disabling lookup retains translation',async()=>{
 const root=setup(),{store}=storage();const r=mountReader({root,demo:true,store});await r.ready;root.querySelector('em').click();await tick();assert.equal(r.shadow.querySelector('.zh').textContent,'海洋');await r.setMode('bilingual');await r.setWords(false);root.querySelector('em').click();await tick();assert.equal(r.shadow.querySelector('.dict').hidden,true);assert.equal(root.querySelectorAll('.lextide-translation').length,1);r.destroy();
});
test('translation preferences persist and repeat reads use cache without another request',async()=>{
 const root=setup('<p class="english">The ocean.</p>'),{store}=storage();let calls=0;let r=mountReader({root,demo:true,store,transport:async()=>{calls++;return '译文';}});await r.setMode('translated');await r.setWords(false);r.destroy();r=mountReader({root,demo:true,store,transport:async()=>{calls++;return '译文';}});await r.ready;await tick();assert.equal(r.mode,'translated');assert.equal(r.preferences.words,false);assert.equal(calls,1);assert.equal(root.querySelector('p.english').hidden,true);r.destroy();
});
test('explicit morphology handles examples but never strips unknown suffixes',async()=>{
 for(const [word,lemma] of [['studying','study'],['researchers','researcher'],['went','go']]){assert.equal(resolveForm(word).lemma,lemma);assert.equal((await lookup(word)).lemma,lemma);}
 assert.equal(resolveForm('business').lemma,'business');assert.equal(resolveForm('interesting').confirmed,false);assert.match(resolveForm('interesting').note,/不确定/);
});
test('vocabulary preserves different contexts, stores context, deletes and supports remote shared storage',async()=>{
 const {store}=storage({now:()=>1000});const remote=remoteStore((op,args)=>store[op](...args));await Promise.all([remote.saveWord({word:'studying',lemma:'study',zh:'研究',sentence:'I am studying.',source:'https://one.test/'}),remote.saveWord({word:'studied',lemma:'study',zh:'研究'})]);const words=await remote.words();assert.equal(words.length,2);assert.equal(words[0].word,'studying');assert.equal(words[0].sentence,'I am studying.');assert.equal(words[0].source,'https://one.test/');assert.equal(words[0].savedAt,'1970-01-01T00:00:01.000Z');await remote.removeWord('study');assert.deepEqual(await remote.words(),[]);
});
test('dictionary save and delete buttons operate on the unified data model',async()=>{
 const root=setup(),{store}=storage();const r=mountReader({root,demo:true,store});await r.ready;root.querySelector('em').click();await tick();assert.match(r.shadow.querySelector('.sentence').textContent,/The ocean/);r.shadow.querySelector('#save').click();await tick();assert.equal((await store.words())[0].lemma,'ocean');await r.openVocabulary();r.shadow.querySelector('#vocab-list button').click();await tick();assert.equal((await store.words()).length,0);r.destroy();
});
test('translation cache hits, expires and clears without a network request on cache hits',async()=>{
 let time=100;const {store}=storage({now:()=>time});await store.cacheSet('Hello','你好');assert.equal(await store.cacheGet('Hello'),'你好');time+=CACHE_TTL;assert.equal(await store.cacheGet('Hello'),null);await store.cacheSet('Hello','你好');const root=setup('<p>Hello</p>');let calls=0;const s=new ParagraphTranslator({root,store,translate:async()=>{calls++;return '你好';},interval:0});await s.start('bilingual',false);assert.equal(calls,0);assert.equal(root.querySelector('.lextide-translation').textContent,'你好');assert.match(root.querySelector('.lextide-translation').dataset.translationSource,/本地缓存/);s.stop();await store.clearCache();assert.equal(await store.cacheGet('Hello'),null);
});
test('API transient error retries once, permanent failure offers explicit retry, and concurrency stays one',async()=>{
 const root=setup('<p>One</p><p>Two</p>'),{store}=storage();let active=0,max=0,calls=0;const s=new ParagraphTranslator({root,store,interval:0,translate:async()=>{active++;max=Math.max(max,active);calls++;await tick();active--;if(calls===1)throw Object.assign(Error('temporary'),{retryable:true});if(calls===3)throw Object.assign(Error('quota'),{retryable:false});return '译文';}});await s.start('bilingual',true);assert.equal(calls,3);assert.equal(max,1);assert.equal(root.querySelectorAll('.lextide-translation button').length,1);await s.retry();assert.equal(calls,4);assert.equal(root.querySelectorAll('.lextide-translation button').length,0);s.stop();
});
test('viewport priority skips offscreen paragraphs until intersection, then processes on scroll',async()=>{
 const root=setup('<p>Above</p><p>Visible</p><p>Below</p>'),{store}=storage();const ps=[...root.children];ps.forEach((p,i)=>p.getBoundingClientRect=()=>({top:[-200,10,2000][i],bottom:[-100,100,2100][i]}));let observe;window.IntersectionObserver=class{constructor(cb){observe=cb;}observe(){}disconnect(){}};const calls=[];const s=new ParagraphTranslator({root,store,interval:0,translate:async text=>{calls.push(text);return text;}});await s.start('bilingual',true);assert.deepEqual(calls,['Visible']);observe([{target:ps[2],isIntersecting:true}]);await tick();assert.deepEqual(calls,['Visible','Below']);s.stop();
});
test('navigation, code, editable areas and nested blocks are excluded from translation',()=>{
 const root=setup('<nav><p>Navigation</p></nav><pre><code>Code</code></pre><div contenteditable="true"><p>Edit</p></div><blockquote><p>Actual text</p></blockquote>');assert.deepEqual(paragraphs(root).map(p=>p.textContent),['Actual text']);
});
test('mode changes abort old signals and never reinsert stale results',async()=>{
 const root=setup('<p>Pending</p>'),{store}=storage();let finish,signal;const s=new ParagraphTranslator({root,store,interval:0,translate:async(text,options)=>{signal=options.signal;return new Promise(r=>finish=r);}});const pending=s.start('translated',true);await tick();s.stop();assert.equal(signal.aborted,true);finish('过期');await pending;assert.equal(root.querySelectorAll('.lextide-translation').length,0);assert.equal(root.querySelector('p').hidden,false);
});
test('sentence extraction uses the clicked sentence',()=>assert.equal(sentenceAt('First sentence. Researchers study the ocean. Next one.','ocean'),'Researchers study the ocean.'));
test('repeated words capture the clicked occurrence rather than the first sentence',async()=>{const root=setup('<p>The ocean is large. This <span data-word="ocean">ocean</span> is blue.</p>'),{store}=storage();const r=mountReader({root,store});await r.ready;root.querySelector('span').click();await tick();assert.equal(r.shadow.querySelector('.sentence').textContent,'当前句子：This ocean is blue.');r.destroy();});
test('JSON export contains complete schema and user data',async()=>{const root=setup(),{store}=storage();await store.saveWord({word:'went',lemma:'go',zh:'去',sentence:'They went.',source:'https://source.test/'});const r=mountReader({root,store});await r.ready;const saved=URL.createObjectURL,revoked=URL.revokeObjectURL;let blob;URL.createObjectURL=value=>{blob=value;return 'blob:test';};URL.revokeObjectURL=()=>{};try{await r.exportWords();const data=JSON.parse(await blob.text());assert.equal(data.version,2);assert.equal(data.words[0].lemma,'go');assert.equal(data.words[0].sentence,'They went.');}finally{URL.createObjectURL=saved;URL.revokeObjectURL=revoked;r.destroy();}});
