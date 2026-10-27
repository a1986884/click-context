import {test} from 'node:test';import assert from 'node:assert/strict';
import {specificityAccuracyCases as cases,accuracyCaseInput,evaluateAccuracyMeaning} from './live/context-accuracy-specificity.mjs';
test('specificity cohort includes contrasting domain cues and exact repeated occurrences',()=>{
 assert.equal(cases.length,18);assert.equal(new Set(cases.map(c=>c.id)).size,cases.length);for(const c of cases){const input=accuracyCaseInput(c);assert.equal(input.sentence.slice(input.offset,input.offset+input.word.length).toLowerCase(),input.word.toLowerCase());}
 assert.equal(accuracyCaseInput(cases.find(c=>c.id==='specificity-saw-verb')).offset,4);assert.equal(accuracyCaseInput(cases.find(c=>c.id==='specificity-saw-noun')).offset,12);
});
test('generic cases cannot pass as a specific subtype and ambiguous lexical matches still require review',()=>{
 const terminal=cases.find(c=>c.id==='specificity-terminal-closed');assert.equal(evaluateAccuracyMeaning(terminal,{zh:'航站楼'}).status,'failed');assert.equal(evaluateAccuracyMeaning(terminal,{zh:'终端（具体类型不明）'}).status,'needs-human-review');
 assert.equal(evaluateAccuracyMeaning(cases.find(c=>c.id==='specificity-terminal-air'),{zh:'航站楼'}).status,'rules-passed');
 assert.equal(evaluateAccuracyMeaning(cases.find(c=>c.id==='specificity-saw-verb'),{zh:'看见',lemma:'saw',pos:'NOUN'}).status,'failed');
 assert.equal(evaluateAccuracyMeaning(cases.find(c=>c.id==='specificity-bass-modifier'),{zh:'贝斯手'}).status,'failed');
});
