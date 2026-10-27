import {test} from 'node:test';
import assert from 'node:assert/strict';
import {contextSamples,assertContextGloss} from './live/context-gloss-cases.mjs';

test('the modifier oracle rejects a musician gloss even when it contains a valid instrument keyword',()=>{
 const sample=contextSamples.find(([word,sentence,,occurrence])=>word==='bass'&&sentence.includes('player')&&occurrence===0);
 const [, ,expected,,,forbidden]=sample;
 for(const zh of ['贝斯','低音乐器','贝司'])assert.doesNotThrow(()=>assertContextGloss(zh,{expected,forbidden}));
 for(const zh of ['贝斯手','贝司手','低音提琴手','低音乐师'])assert.throws(()=>assertContextGloss(zh,{expected,forbidden}));
});
