import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {proseUnits} from '../src/prose-units.js';
import {ParagraphTranslator} from '../src/translation.js';
import {createStore} from '../src/storage.js';
const tick=()=>new Promise(setImmediate);
function setup(html){const {window}=parseHTML('<html><body>'+html+'</body></html>');globalThis.window=window;globalThis.document=window.document;const values=new Map();return {root:document.body,store:createStore({get:async k=>values.get(k),set:async(k,v)=>values.set(k,v)})};}
test('nested lists, direct prose before and after blocks, tables and definitions form separate readable units',()=>{
 const {root}=setup('<main><ul><li>Parent <em>item</em><ul><li>Nested item</li></ul>Trailing explanation</li></ul><div>Opening text<p>Inner paragraph</p>Closing text</div><table><tr><th>Column title</th><td>Cell <a href="/path">link</a></td></tr></table><dl><dt>Term</dt><dd>Meaning of term</dd></dl></main>');
 assert.deepEqual(proseUnits(root).map(u=>u.text),['Parent item','Nested item','Trailing explanation','Opening text','Inner paragraph','Closing text','Column title','Cell link','Term','Meaning of term']);
});
test('only visible article text is sent; controls, translate=no, code and hidden subtrees are omitted',()=>{
 const {root}=setup('<p>Outside main footer-like content</p><main><article><header><h1>Article headline</h1></header><p>Visible <span hidden>SECRET</span><input value="PRIVATE"><code>privateCode()</code> public text.</p><p aria-hidden="true">Private ARIA</p><div style="display:none"><p>Private CSS</p></div><p translate="no">Keep original</p><p class="notranslate">No translation</p><form><p>Account data</p></form><nav><p>Menu links</p></nav><details><summary>Visible summary</summary><p>Closed content</p></details></article></main>');
 window.getComputedStyle=e=>({display:e.style.display,visibility:e.style.visibility});
 const text=proseUnits(root).map(u=>u.text);assert.deepEqual(text,['Article headline','Visible public text.','Visible summary']);assert.deepEqual(proseUnits(root.querySelector('details p')),[]);
});
test('bilingual insertion preserves original node identity and list/table structure without duplication',async()=>{
 const {root,store}=setup('<main><ul><li id="parent">Parent item<ul><li>Child item</li></ul>Tail text</li></ul><table><tbody><tr><td>Read <a href="/safe">linked text</a></td></tr></tbody></table></main>');
 const original=root.innerHTML,link=root.querySelector('a'),parent=root.querySelector('#parent'),calls=[];
 const translator=new ParagraphTranslator({root,store,interval:0,translate:async text=>{calls.push(text);return '译文：'+text;}});
 await translator.start('bilingual',true);assert.deepEqual([...calls].sort(),['Parent item','Child item','Tail text','Read linked text'].sort());assert.equal(root.querySelectorAll('td').length,1);assert.equal(link.parentElement.tagName,'TD');assert.equal(root.querySelector('tr > .lextide-translation'),null);assert.equal(parent.firstChild.textContent,'Parent item');
 translator.refresh();await tick();assert.equal(calls.length,4);assert.equal(root.querySelectorAll('.lextide-translation').length,4);assert.equal(root.querySelector('a'),link);translator.stop();assert.equal(root.innerHTML,original);
});
test('replacing a pending paragraph cancels immediately, releases its queue slot and never writes stale cache',async()=>{
 const {root,store}=setup('<main><p>Old pending paragraph</p></main>');let signal,finish;const calls=[];
 const translator=new ParagraphTranslator({root,store,interval:0,translate:(text,options)=>{calls.push(text);if(text.startsWith('Old')){signal=options.signal;return new Promise(r=>finish=r);}return Promise.resolve('新段落译文');}});
 const pending=translator.start('bilingual',true);await tick();const p=root.querySelector('main > p');p.textContent='New paragraph';translator.refresh([p]);await pending;await tick();assert.ok(signal.aborted);assert.deepEqual(calls,['Old pending paragraph','New paragraph']);assert.match(root.textContent,/新段落译文/);finish('过期译文');await tick();assert.doesNotMatch(root.textContent,/过期/);assert.equal(await store.cacheGet('Old pending paragraph'),null);translator.stop();
});
test('text changes in translated mode restore the original hidden state when stopped',async()=>{
 const {root,store}=setup('<main><p>Initial paragraph</p></main>');const p=root.querySelector('p');const translator=new ParagraphTranslator({root,store,interval:0,translate:async()=> '译文'});await translator.start('translated',true);assert.equal(p.hidden,true);p.firstChild.textContent='Updated paragraph';translator.refresh([p]);await tick();assert.equal(p.hidden,true);translator.stop();assert.equal(p.hidden,false);assert.equal(p.textContent,'Updated paragraph');
});
test('dynamic changes outside the selected main region do not start translation',async()=>{
 const {root,store}=setup('<div id="other"><p>Outside text</p></div><main><p>Main article</p></main>');const calls=[];const translator=new ParagraphTranslator({root,store,interval:0,translate:async text=>{calls.push(text);return '译文';}});await translator.start('bilingual',true);root.querySelector('#other p').textContent='Updated outside text';translator.refresh([root.querySelector('#other')]);await tick();assert.deepEqual(calls,['Main article']);translator.stop();
});

test('line breaks inside inline markup retain source order and leave source nodes intact',async()=>{
 const {root,store}=setup('<main><p>First <em>line<br>Second line</em> tail<br>Third line</p></main>');const before=root.innerHTML;
 const translator=new ParagraphTranslator({root,store,interval:0,translate:async text=>'中文('+text+')'});await translator.start('bilingual',true);
 assert.match(root.querySelector('p').textContent,/First line中文\(First line\)Second line tail中文\(Second line tail\)Third line中文\(Third line\)/);translator.refresh();await tick();assert.equal(root.querySelectorAll('.lextide-translation').length,3);translator.stop();assert.equal(root.innerHTML,before);
});

test('article scopes inherit hidden wrapper and closed disclosure exclusions',()=>{
 const {root}=setup('<div style="display:none"><main><p>Hidden display article.</p></main></div><div style="content-visibility:hidden"><article><p>Hidden content article.</p></article></div><details><summary>Closed label</summary><main><p>Closed article.</p></main></details><main><p>Visible article.</p></main>');
 window.getComputedStyle=e=>({display:e.style.display,visibility:e.style.visibility,contentVisibility:e.style.getPropertyValue('content-visibility')});
 assert.deepEqual(proseUnits(root).map(u=>u.text),['Visible article.']);
});
test('hidden-only article regions do not suppress visible fallback prose',()=>{
 const {root}=setup('<div style="display:none"><main><p>Hidden cached page.</p></main></div><div><p>Visible fallback prose.</p></div>');
 window.getComputedStyle=e=>({display:e.style.display,visibility:e.style.visibility});
 assert.deepEqual(proseUnits(root).map(u=>u.text),['Visible fallback prose.']);
});
