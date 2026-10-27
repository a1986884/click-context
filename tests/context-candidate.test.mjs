import {test} from 'node:test';import assert from 'node:assert/strict';
import {cleanContext,contextPrompt,parseContextResult} from '../src/context-meaning.js';
import worker from '../workers/context/index.js';
test('v6 cannot attach dictionary provenance to a fragment missing a shared qualifier',()=>{
 const input={word:'recreational',sentence:'They bought recreational equipment.',offset:12,senses:[{id:'use',lemma:'recreational',pos:'ADJ',zh:'运动、娱乐用的',definition:'Used for recreation.'}]};
 const raw={senseId:null,lemma:'recreational',pos:'ADJ',zh:'运动'};
 const candidate=parseContextResult(raw,{...input,contextRevision:'ai-context-v6'});assert.equal(candidate.senseId,null);assert.equal(candidate.meaningStatus,'candidate');assert.equal(candidate.zh,'运动');
 const complete=parseContextResult({...raw,zh:'运动、娱乐用的'},{...input,contextRevision:'ai-context-v6'});assert.equal(complete.senseId,'use');assert.equal(complete.meaningStatus,'dictionary-match');
 assert.equal(parseContextResult(raw,{...input,contextRevision:'ai-context-v5'}).senseId,'use');
});
test('v6 preserves the clicked occurrence and never exposes candidate anchors',()=>{
 const sentence='She saw the saw on the bench.';
 for(const offset of [4,12]){const input=cleanContext({word:'saw',sentence,offset,senses:[{id:'secret',lemma:'saw',pos:'NOUN',zh:'候选诱导词',definition:'DICTIONARY_ANCHOR'}],contextRevision:'ai-context-v6'}),prompt=contextPrompt(input),data=JSON.parse(prompt.input);assert.equal(data.markedSentence,sentence.slice(0,offset)+'⟦saw⟧'+sentence.slice(offset+3));assert.doesNotMatch(prompt.input,/secret|候选诱导词|DICTIONARY_ANCHOR/);}
});
test('v6 derives candidate status from dictionary provenance rather than trusting a model certainty claim',()=>{
 const input=cleanContext({word:'port',sentence:'The port is closed.',offset:4,senses:[{id:'computer',lemma:'port',pos:'NOUN',zh:'端口',definition:'A computer connection.'}],contextRevision:'ai-context-v6'});
 const candidate=parseContextResult({senseId:null,lemma:'port',pos:'NOUN',zh:'港口',meaningStatus:'dictionary-match'},input);assert.equal(candidate.senseId,null);assert.equal(candidate.meaningStatus,'candidate');
 const exact=parseContextResult({senseId:null,lemma:'port',pos:'NOUN',zh:'端口',meaningStatus:'candidate'},input);assert.equal(exact.senseId,'computer');assert.equal(exact.meaningStatus,'dictionary-match');
});
test('v6 returns its independent interpretation without letting another generation overwrite the selected word',async()=>{
 let calls=0,captured;const env={PER_IP:{limit:async()=>({success:true})},TOTAL:{limit:async()=>({success:true})},AI:{run:async(_model,prompt)=>{calls++;captured=prompt;if(calls>1)throw Error('An unverified second rewrite is forbidden');return {response:JSON.stringify({senseId:null,lemma:'bass',pos:'NOUN',zh:'低音乐器'})};}}};
 const response=await worker.fetch(new Request('https://worker.test/meaning',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({word:'bass',sentence:'The bass player cooked a bass for dinner.',offset:4,senses:[],contextRevision:'ai-context-v6'})}),env),body=await response.json();
 assert.equal(response.status,200);assert.equal(calls,1);assert.equal(captured.max_output_tokens,900);assert.equal(captured.reasoning.effort,'medium');assert.equal(body.data.zh,'低音乐器');assert.equal(body.data.meaningStatus,'candidate');assert.equal(body.data.method,'ai-context-v6');
});
