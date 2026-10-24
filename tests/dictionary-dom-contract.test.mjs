import {test} from 'node:test';import assert from 'node:assert/strict';import {parseHTML} from 'linkedom/worker';import {readFile} from 'node:fs/promises';
import {dictionaryDocumentView} from '../src/dictionary-dom-view.js';import {extractDictionary} from '../src/dictionary-extract.js';import {dictionaryFixtures} from './fixtures/dictionary-html.mjs';
test('extraction accepts only the minimal read-only DOM view and cannot import parser or network libraries',async()=>{
 const source=await readFile(new URL('../src/dictionary-extract.js',import.meta.url),'utf8');assert.doesNotMatch(source,/linkedom|DOMParser|fetch\(|\.cloneNode\(|\.remove\(|\.closest\(/);
 for(const fixture of dictionaryFixtures){const view=dictionaryDocumentView(parseHTML(fixture.html).document,{stripLabels:fixture.kind.startsWith('youdao-')});assert.deepEqual(Object.keys(view).sort(),['getAttribute','querySelector','querySelectorAll','textContent']);assert.ok(extractDictionary(view,fixture.kind,{phrase:fixture.phrase}));}
});

test('normalization leaves official definition labels intact',()=>{
 const official='<div class="dictentry"><span class="orth">unit</span><div class="collinsMajorTrans"><p class="def"><span class="additional">N</span> A synthetic unit.</p></div></div>';
 const view=dictionaryDocumentView(parseHTML(official).document);assert.equal(extractDictionary(view,'collins-en').definition,'N A synthetic unit.');
});
