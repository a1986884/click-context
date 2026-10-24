import {test} from 'node:test';
import assert from 'node:assert/strict';
import {rankCollinsSenses} from '../src/sense-ranking.js';
import {parseHTML} from 'linkedom';
import {mountReader} from '../src/reader.js';
import {cacheWordLookup} from '../src/dictionary-cache.js';
const senses=[
 {id:'money',pos:'N-COUNT',definition:'An institution that keeps money and provides financial services.',zh:'金融义（合成测试）',examples:[]},
 {id:'river',pos:'N-COUNT',definition:'The land along the edge of a river or stream.',zh:'河岸义（合成测试）',examples:[]}
];
test('the same cached word ranks differently in financial and river contexts without mutating provider order',()=>{
 const original=structuredClone(senses);
 for(const [sentence,id] of [['She deposited her salary at the bank.','money'],['They sat on the bank beside the river.','river']]){
  const result=rankCollinsSenses(senses,{word:'bank',sentence});assert.equal(result.status,'supported');assert.equal(result.ordered[0].id,id);
 }
 assert.deepEqual(senses,original);
});
test('unclear context and absent modern senses preserve dictionary order rather than inventing a meaning or probability',()=>{
 for(const sentence of ['', 'The bank was there.','The AI hallucination was surprising.']){
  const result=rankCollinsSenses(senses,{word:'bank',sentence});assert.equal(result.status,'uncertain');assert.deepEqual(result.ordered,senses);assert.equal(result.probability,undefined);
 }
});
test('part-of-speech cues alone cannot be presented as a confident semantic choice',()=>{
 const candidates=[{id:'noun',pos:'N',definition:'A written collection of information.',zh:'名词'}, {id:'verb',pos:'V-T',definition:'To store information for future use.',zh:'动词'}];
 assert.equal(rankCollinsSenses(candidates,{word:'record',sentence:'Please record it.'}).status,'uncertain');
});
test('reader requests context-specific API results per sentence while caching only dictionary candidates',async()=>{
 const {window}=parseHTML('<html><body><main></main></body></html>');globalThis.window=window;globalThis.document=window.document;globalThis.localStorage={getItem:()=>null,setItem(){}};window.getSelection=()=>({isCollapsed:true});
 let requests=0;const sent=[];const cached=cacheWordLookup(async()=>{requests++;return {word:'bank',lemma:'bank',kind:'collins',zh:senses[0].zh,source:'Synthetic Collins contract fixture',senses};});
 const reader=mountReader({root:document.querySelector('main'),transport:(...args)=>{sent.push(args);if(args[0]==='context'){const river=args[3].context.sentence.includes('river');return Promise.resolve({senseId:river?'river':'money',zh:senses[river?1:0].zh});}return cached(args[1],{...args[3],online:true});}});
 try{
  await reader.show('bank',null,'She deposited her salary at the bank.');assert.equal(reader.shadow.querySelector('.zh').textContent,senses[0].zh);
  await reader.show('bank',null,'They sat on the bank beside the river.');assert.equal(reader.shadow.querySelector('.zh').textContent,senses[1].zh);assert.equal(requests,1);
  assert.equal(sent.filter(a=>a[0]==='context').length,2);assert.ok(sent.filter(a=>a[0]==='lookup').every(a=>!a[3].context));assert.match(sent.find(a=>a[0]==='context')[3].context.sentence,/salary/);
  const select=reader.shadow.querySelector('#sense-choice');Array.from(select.options).find(option=>option.value==='money').selected=true;select.dispatchEvent(new window.Event('change'));await new Promise(r=>setImmediate(r));assert.equal(reader.shadow.querySelector('.zh').textContent,senses[0].zh);assert.match(reader.shadow.querySelector('.sense-status').textContent,/已选择/);
 }finally{reader.destroy();}
});
test('late context answers cannot overwrite the newest lookup, and manual choice wins over pending AI',async()=>{
 const {window}=parseHTML('<html><body><main></main></body></html>');globalThis.window=window;globalThis.document=window.document;globalThis.localStorage={getItem:()=>null,setItem(){}};window.getSelection=()=>({isCollapsed:true});
 const tasks=[];const reader=mountReader({root:document.querySelector('main'),transport:async(type)=>type==='context'?await new Promise(resolve=>tasks.push(resolve)):{word:'bank',lemma:'bank',kind:'collins',source:'Synthetic fixture',senses}});
 const tick=()=>new Promise(r=>setImmediate(r));
 try{
  const first=reader.show('bank',null,'The bank keeps money.');await tick();const second=reader.show('bank',null,'A bank beside the river.');await tick();
  tasks[1]({senseId:'river',zh:'此处是河岸'});await second;tasks[0]({senseId:'money',zh:'此处是银行'});await first;assert.equal(reader.shadow.querySelector('.zh').textContent,'此处是河岸');
  const third=reader.show('bank',null,'The bank is here.');await tick();const select=reader.shadow.querySelector('#sense-choice');Array.from(select.options).find(o=>o.value==='money').selected=true;select.dispatchEvent(new window.Event('change'));tasks[2]({senseId:'river',zh:'此处是河岸'});await third;assert.equal(reader.shadow.querySelector('.zh').textContent,senses[0].zh);
 }finally{reader.destroy();}
});
test('selected candidate controls the saved lemma and original source; missing dictionary stays explicitly AI-only',async()=>{
 const {window}=parseHTML('<html><body><main></main></body></html>');globalThis.window=window;globalThis.document=window.document;globalThis.localStorage={getItem:()=>null,setItem(){}};window.getSelection=()=>({isCollapsed:true});
 const entries=new Map();const store={prefs:async()=>({words:true,enabled:false,mode:'original'}),savePrefs:async()=>{},words:async()=>[...entries.values()],saveWord:async e=>{entries.set(e.lemma,e);},cacheGet:async()=>null};
 let missing=false;const reader=mountReader({root:document.querySelector('main'),store,transport:async type=>type==='context'?{senseId:missing?null:'leaf',zh:missing?'专有名称':'树叶'}:missing?{word:'Zqv',lemma:'zqv',kind:'unavailable',source:'Collins 暂无可用词条',senses:[],zh:''}:{word:'leaves',lemma:'leave',kind:'collins',source:'Synthetic fixture',senses:[{id:'leave',lemma:'leave',zh:'离开',definition:'To go away.',sourceUrl:'https://dict.youdao.com/w/eng/leave/'},{id:'leaf',lemma:'leaf',zh:'树叶',definition:'Part of a plant.',sourceUrl:'https://dict.youdao.com/w/eng/leaf/'}]}});
 try{await reader.show('leaves',null,'The leaves turned red.');assert.match(reader.shadow.querySelector('.source a').href,/\/leaf\//);reader.shadow.querySelector('#save').click();await new Promise(r=>setImmediate(r));assert.equal(entries.get('leaf').zh,'树叶');missing=true;await reader.show('Zqv',null,'Zqv is a name.');assert.equal(reader.shadow.querySelector('.zh').textContent,'专有名称');assert.match(reader.shadow.querySelector('.dictionary-label').textContent,/AI/);assert.match(reader.shadow.querySelector('.zh-source').textContent,/Collins 暂无/);assert.equal(reader.shadow.querySelector('.sense-picker').hidden,true);}finally{reader.destroy();}
});
