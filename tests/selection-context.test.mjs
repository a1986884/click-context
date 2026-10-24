import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {proseBlock,proseSnapshot,selectedContext,sentenceContext} from '../src/selection-context.js';
const page=html=>parseHTML('<html><body><main>'+html+'</main></body></html>').document;
test('context offsets distinguish repeated identical sentences and survive inline formatting',()=>{
 const d=page('<p>The bank closed. The <strong>bank</strong> closed. They left.</p>'),node=d.querySelector('strong').firstChild;
 const snapshot=proseSnapshot(proseBlock(node),node,0);
 assert.equal(snapshot.offset,'The bank closed. The '.length);
 const result=selectedContext({startContainer:node,endContainer:node,startOffset:0},'bank');
 assert.deepEqual(result,{sentence:'The bank closed.',offset:4});
});
test('snapshot excludes hidden content, code, inputs and extension translations without corrupting offsets',()=>{
 const d=page('<p>They <span hidden>SECRET</span><span aria-hidden="true">PRIVATE</span><span style="display:none">HIDDEN</span><code>CODE</code><input value="VALUE"><span class="lextide-translation">译文</span>sat at the <em>bank</em> by the river.</p>'),node=d.querySelector('em').firstChild;
 const s=proseSnapshot(proseBlock(node),node);
 assert.equal(s.text,'They sat at the bank by the river.');assert.equal(s.text.slice(s.offset,s.offset+4),'bank');
 assert.deepEqual(selectedContext({startContainer:node,endContainer:node,startOffset:0},'bank'),{sentence:s.text,offset:16});
});
test('whitespace normalization preserves the actual selection position',()=>{
 const d=page('<p>  First bank.\n\tThe   <em>bank</em>  is near the river. </p>'),node=d.querySelector('em').firstChild;
 const s=proseSnapshot(proseBlock(node),node);assert.equal(s.text.slice(s.offset,s.offset+4),'bank');
 assert.deepEqual(selectedContext({startContainer:node,endContainer:node,startOffset:0},'bank'),{sentence:'The bank is near the river.',offset:4});
});
test('context respects decimal numbers and common title abbreviations',()=>{
 const text='First sentence. Dr. Smith deposited 3.5 dollars at the bank. Next sentence.';
 assert.deepEqual(sentenceContext(text,text.indexOf('bank'),4),{sentence:'Dr. Smith deposited 3.5 dollars at the bank.',offset:39});
});
test('long contexts retain the clicked word and bounded offsets instead of truncating it away',()=>{
 const text='word '.repeat(400)+'bank'+' word'.repeat(400),at=text.indexOf('bank'),s=sentenceContext(text,at,4);
 assert.ok(s.sentence.length<=1200);assert.equal(s.sentence.slice(s.offset,s.offset+4),'bank');
});
test('detached, excluded, broad or unverifiable selections never capture unrelated text',()=>{
 const d=page('<p id="a">First <b>bank</b>.</p><p id="b">Second.</p><div contenteditable="true"><em>private</em></div>'),node=d.querySelector('b').firstChild;
 assert.equal(selectedContext({startContainer:node,endContainer:d.querySelector('#b').firstChild,startOffset:0},'bank'),null);
 assert.equal(selectedContext({startContainer:node,endContainer:node,startOffset:1},'bank'),null);
 assert.equal(proseBlock(d.querySelector('em').firstChild),null);assert.equal(proseBlock(d.querySelector('main')),null);
 d.querySelector('#a').remove();assert.equal(proseSnapshot(d.querySelector('b'),node),null);
});
test('element-boundary selections and selections spanning inline nodes preserve their start',()=>{
 const d=page('<p>The <strong>ba<em>nk</em></strong> is open.</p>'),strong=d.querySelector('strong');
 const result=selectedContext({startContainer:strong,endContainer:strong.querySelector('em').firstChild,startOffset:0},'bank');
 assert.deepEqual(result,{sentence:'The bank is open.',offset:4});
});
test('line breaks separate visible words and interactive role content is excluded',()=>{
 const d=page('<p>They sat<br>at the <span role="button">SAVE</span><b>bank</b>.</p>'),node=d.querySelector('b').firstChild;
 const result=selectedContext({startContainer:node,endContainer:node,startOffset:0},'bank');
 assert.deepEqual(result,{sentence:'They sat at the bank.',offset:16});
});

test('lookup and translation share scientific boundaries while retaining the clicked occurrence',async()=>{
 const {sentenceRanges}=await import('../src/sentences.js');
 const text='Dr. Smith reports a 3.14% gain (Fig. 2). The method agrees with Eq. (3). [12] The method is repeated.';
 for(const word of ['Smith','gain','method','repeated']){const at=text.indexOf(word),expected=sentenceRanges(text).find(r=>at>=r.start&&at<r.end),context=sentenceContext(text,at,word.length);assert.equal(context.sentence,text.slice(expected.start,expected.end).trim());assert.equal(context.sentence.slice(context.offset,context.offset+word.length),word);}
 const at=text.lastIndexOf('method');assert.deepEqual(sentenceContext(text,at,6),{sentence:'The method is repeated.',offset:4});
});

test('leading selection whitespace is trimmed without jumping to an earlier occurrence',()=>{
 for(const space of [' ','\n\t','\u00a0']){
  const d=page('<p>The bank closed. The'+space+'<b>bank</b> is open.</p>'),p=d.querySelector('p'),start=p.firstChild,end=d.querySelector('b').firstChild;
  const result=selectedContext({startContainer:start,endContainer:end,startOffset:start.textContent.length-space.length},'bank');
  assert.deepEqual(result,{sentence:'The bank is open.',offset:4});
 }
});
test('whitespace before a cross-inline phrase preserves its complete selected expression',()=>{
 const d=page('<p>They will <b>carry <em>out</em></b> the study.</p>'),p=d.querySelector('p'),start=p.firstChild,end=d.querySelector('em').firstChild;
 assert.deepEqual(selectedContext({startContainer:start,endContainer:end,startOffset:start.textContent.length-1},'carry out'),{sentence:'They will carry out the study.',offset:10});
});

test('article heading context remains readable while site banners and navigation remain excluded',()=>{
 const d=page('<header><h1 id="site">Site bank</h1></header><article><header><h1 id="title">The <b>bank</b> changed.</h1><nav><p id="nav">bank menu</p></nav><div role="banner"><p id="banner">bank banner</p></div></header></article>'),node=d.querySelector('#title b').firstChild;
 assert.deepEqual(selectedContext({startContainer:node,endContainer:node,startOffset:0},'bank'),{sentence:'The bank changed.',offset:4});
 for(const id of ['site','nav','banner'])assert.equal(proseBlock(d.querySelector('#'+id).firstChild),null,id);
});

test('formatted table words use only their own cell as context',()=>{
 for(const tag of ['td','th']){const d=page('<div><table><tr><'+tag+'>The bank closed.</'+tag+'><'+tag+' id="cell">The <b>bank</b> is open.</'+tag+'></tr></table></div>'),node=d.querySelector('b').firstChild;
  assert.equal(proseBlock(node)?.id,'cell');assert.deepEqual(selectedContext({startContainer:node,endContainer:node,startOffset:0},'bank'),{sentence:'The bank is open.',offset:4});
 }
});
test('a phrase selection cannot bridge separate table cells',()=>{
 const d=page('<div><table><tr><td><b>carry</b> </td><td><em>out</em> the study.</td></tr></table></div>'),start=d.querySelector('b').firstChild,end=d.querySelector('em').firstChild;
 assert.equal(selectedContext({startContainer:start,endContainer:end,startOffset:0},'carry out'),null);
});

test('closed details expose their visible summary but never their folded body in a snapshot',()=>{
 const d=page('<div id="block">The <b>bank</b><details><summary> reference</summary><p id="folded">SECRET private explanation.</p></details> is open.</div>'),node=d.querySelector('b').firstChild,block=d.querySelector('#block');
 const snapshot=proseSnapshot(block,node);assert.ok(!snapshot.text.includes('SECRET'));assert.ok(snapshot.text.includes('reference'));assert.equal(snapshot.text.slice(snapshot.offset,snapshot.offset+4),'bank');assert.equal(proseSnapshot(d.querySelector('#folded'),d.querySelector('#folded').firstChild),null);
 d.querySelector('details').setAttribute('open','');assert.ok(proseSnapshot(block,node).text.includes('SECRET'));
});
test('CSS-hidden ancestors and collapsed labels are excluded without shifting visible words',()=>{
 const d=page('<div style="display:none"><p id="hidden">bank</p></div><p id="visible">The <a><span style="visibility:collapse">PRIVATE </span><b>bank</b></a> is open.</p>'),hidden=d.querySelector('#hidden'),node=d.querySelector('b').firstChild;
 assert.equal(proseSnapshot(hidden,hidden.firstChild),null);const result=proseSnapshot(d.querySelector('#visible'),node);assert.equal(result.text,'The bank is open.');assert.equal(result.offset,4);
});

test('explicitly selected disclosure labels use only the summary context',()=>{
 const d=page('<div>Outside sentence.<details><summary><b>More</b> information.</summary><p>Hidden explanation.</p></details>More outside text.</div>'),node=d.querySelector('b').firstChild;
 assert.deepEqual(selectedContext({startContainer:node,endContainer:node,startOffset:0},'More'),{sentence:'More information.',offset:0});
});

test('citation-adjacent sentence boundaries retain only the clicked finding and its original offset',()=>{
 const text='First finding.[1] The bank is stable.¹ The next result differs.';
 assert.deepEqual(sentenceContext(text,text.indexOf('bank'),4),{sentence:'The bank is stable.¹',offset:4});
 assert.deepEqual(sentenceContext(text,text.indexOf('next'),4),{sentence:'The next result differs.',offset:4});
});

test('DOM superscript citations retain lookup offsets without treating decimal digits as references',()=>{
 const d=page('<p>First finding.<sup><a href="#ref">1</a></sup> The <em>bank</em> held 3.14 units.</p>'),node=d.querySelector('em').firstChild;
 assert.deepEqual(selectedContext({startContainer:node,endContainer:node,startOffset:0},'bank'),{sentence:'The bank held 3.14 units.',offset:4});
});

test('numeric superscript positions survive leading and inline whitespace normalization',()=>{
 for(const html of [
  '<p>  First finding.<sup> 1, <a href="#ref">2</a> </sup>\n\tThe   <em>bank</em>  held 3.14 units. </p>',
  '<p>First finding.<sup><b>1</b>,<i>2</i></sup> The <em>bank</em> held 3.14 units.</p>',
  '<p>First bank finding.<sup>1</sup> The <em>bank</em> held 3.14 units.</p>'
 ]){
  const d=page(html),node=d.querySelector('em').firstChild;
  assert.deepEqual(selectedContext({startContainer:node,endContainer:node,startOffset:0},'bank'),{sentence:'The bank held 3.14 units.',offset:4});
 }
});
