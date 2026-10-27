import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {mountReader} from '../src/reader.js';
import {createStore,DEFAULT_PREFS} from '../src/storage.js';
import {parseVocabularyBackup} from '../src/vocabulary-data.js';
const tick=()=>new Promise(setImmediate);
const cases=[
 {name:'missing dictionary',lemma:'wind',expected:'wind'},
 {name:'candidate lemma and part of speech mismatch',lemma:'wind',expected:'wind',senses:[{id:'noun',lemma:'wound',pos:'NOUN',zh:'伤口',definition:'An injury to the body.'}],senseId:'noun'},
 {name:'missing model lemma',expected:'wound'},
 {name:'invalid model lemma',lemma:'https://invalid.example/wind',expected:'wound'},
 {name:'lemma outside backup expression limit',lemma:'one two three four five',expected:'wound'},
 {name:'reviewed phrase fallback',word:'took into account',sentence:'They took into account the weather.',offset:5,expected:'take into account'}
];
for(const c of cases)test('AI-only favorite keeps a usable contextual lemma: '+c.name,async()=>{
 const {window}=parseHTML('<html><body><main></main></body></html>');window.getSelection=()=>({isCollapsed:true});globalThis.window=window;globalThis.document=window.document;const root=document.querySelector('main'),values=new Map(),store=createStore({get:async key=>key==='prefs'?DEFAULT_PREFS:values.get(key),set:async(key,value)=>values.set(key,structuredClone(value))});
 const word=c.word||'wound',sentence=c.sentence||'She wound the bandage around the wound.',reader=mountReader({root,store,transport:async type=>type==='lookup'?{word,lemma:word,kind:c.senses?'collins':'unavailable',senses:c.senses||[],source:'Synthetic Collins fixture'}:{senseId:c.senseId??null,zh:'缠绕测试',pos:'VERB',...(c.lemma?{lemma:c.lemma}:{})}});
 try{await reader.show(word,root,sentence,c.offset??4);assert.match(reader.shadow.querySelector('.dictionary-label').textContent,/AI/);reader.shadow.querySelector('#save').click();await tick();const words=await store.words();assert.equal(words.length,1);assert.equal(words[0].word,word);assert.equal(words[0].lemma,c.expected);assert.equal(words[0].sentence,sentence);assert.match(words[0].dictionarySource,/AI/);assert.equal(parseVocabularyBackup({version:2,words}).length,1);}finally{reader.destroy();}
});
