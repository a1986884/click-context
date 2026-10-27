import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {cleanContext,contextPrompt,CONTEXT_CURRENT_REVISION,parseContextResult} from '../src/context-meaning.js';
const input={word:'bank',sentence:'They sat on the bank.',offset:16,senses:[]};
test('evidence revision is explicit while previous sampling and prompt bytes stay compatible',()=>{
 assert.equal(CONTEXT_CURRENT_REVISION,'ai-context-v6');
 for(const [revision,expected]of [[undefined,'d137797102db252460820e143ee76a46924fa31583a8a55cce180fba79944ac1'],['ai-context-v3','cb431cd1d335dcadaca39e3b2d7ce359eefeac9c4d47e0de84b974df1503c97d']])assert.equal(createHash('sha256').update(JSON.stringify(contextPrompt(cleanContext({...input,...(revision?{contextRevision:revision}:{})})))).digest('hex'),expected);
 const legacy=contextPrompt(cleanContext({...input,contextRevision:'ai-context-v4'}));assert.equal(createHash('sha256').update(JSON.stringify(legacy)).digest('hex'),'60a18d5370c3b75271028fc6a5fb6cbf74c4e98521d5b3015676e0119b43e831');
 const current=contextPrompt(cleanContext({...input,contextRevision:'ai-context-v5'}));assert.equal(createHash('sha256').update(JSON.stringify(current)).digest('hex'),'6cb46e9b46176203ce32138e0195e16a051460b34264f1029d3542085c6ae2d1');assert.equal(current.temperature,0);assert.equal(current.max_output_tokens,900);assert.deepEqual(current.reasoning,{effort:'medium'});assert.notEqual(current.instructions,legacy.instructions);assert.doesNotMatch(current.instructions,/station|steel beam|police|broken chair|placebo|negative charge/);
 assert.deepEqual(contextPrompt(cleanContext({...input,contextRevision:'ai-context-v6'})),current);
});
test('the evidence revision preserves occurrence marking and result provenance',()=>{
 const data=cleanContext({...input,contextRevision:'ai-context-v5'}),payload=JSON.parse(contextPrompt(data).input);assert.equal(payload.markedSentence,'They sat on the ⟦bank⟧.');assert.equal(parseContextResult({senseId:null,zh:'岸',method:'ai-context-v5'},data).method,'ai-context-v5');assert.throws(()=>parseContextResult({senseId:null,zh:'岸',method:'ai-context-v4'},data));
});
test('independent v5 prompt never exposes dictionary candidates to the model',()=>{
 const data=cleanContext({...input,contextRevision:'ai-context-v5',senses:[{id:'secret-candidate',lemma:'bank',pos:'NOUN',zh:'候选诱导词',definition:'CANDIDATE_ANCHOR_SENTINEL'}]}),prompt=contextPrompt(data),payload=JSON.parse(prompt.input);assert.equal(payload.senses,undefined);assert.doesNotMatch(prompt.instructions+prompt.input,/secret-candidate|候选诱导词|CANDIDATE_ANCHOR_SENTINEL/);
});
test('independent interpretation only receives a unique exact dictionary match with lemma and part of speech',()=>{
 const data=cleanContext({...input,contextRevision:'ai-context-v5',senses:[{id:'specific',lemma:'bank',pos:'NOUN',zh:'一种专门机构',definition:'A specific institution.'}]});
 assert.equal(parseContextResult({senseId:'specific',lemma:'bank',pos:'NOUN',zh:'机构'},data).senseId,null);
 assert.equal(parseContextResult({senseId:null,lemma:'bank',pos:'NOUN',zh:'一种专门机构'},data).senseId,'specific');
 assert.equal(parseContextResult({senseId:'specific',lemma:'bank',pos:'VERB',zh:'一种专门机构'},data).senseId,null);
 const ambiguous={...data,senses:[...data.senses,{...data.senses[0],id:'duplicate'}]};assert.equal(parseContextResult({senseId:null,lemma:'bank',pos:'NOUN',zh:'一种专门机构'},ambiguous).senseId,null);
 assert.equal(parseContextResult({senseId:'specific',zh:'一种专门机构'},data).senseId,null);
});
test('unconfirmed review status alone prevents dictionary attribution even if a response omitted its no-match marker',()=>{
 const data=cleanContext({...input,contextRevision:'ai-context-v5',senses:[{id:'one',lemma:'bank',pos:'NOUN',zh:'岸',definition:'Land beside a river.'}]});
 for(const reviewStatus of ['scope-unconfirmed','evidence-unconfirmed']){
  const result=parseContextResult({senseId:'one',lemma:'bank',pos:'NOUN',zh:'岸',reviewStatus},data);
  assert.equal(result.senseId,null);assert.equal(result.dictionaryMatchAllowed,false);assert.equal(result.reviewStatus,reviewStatus);
 }
});
test('worker accepts all existing revisions and only independently maps v5 meanings',async()=>{
 const {default:worker}=await import('../workers/context/index.js');let captured;const calls=[];
 const env={PER_IP:{limit:async()=>({success:true})},TOTAL:{limit:async()=>({success:true})},AI:{run:async(_model,prompt,options)=>{captured={prompt,options};calls.push(captured);return {response:JSON.stringify(JSON.parse(prompt.input).proposedGloss?{supported:true,sameTarget:true,lemma:'bank',pos:'NOUN',zh:'岸',cue:'bank'}:{lemma:'bank',pos:'NOUN',senseId:null,zh:'岸'})};}}};
 const senses=[{id:'river',lemma:'bank',pos:'NOUN',zh:'岸',definition:'Land beside a river.'}];
 for(const revision of ['ai-context-v3','ai-context-v4','ai-context-v5','ai-context-v6']){const before=calls.length;const response=await worker.fetch(new Request('https://worker.test/meaning',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...input,senses,contextRevision:revision})}),env);assert.equal(response.status,200);assert.equal(calls.length-before,revision==='ai-context-v5'?2:1);assert.equal(calls.slice(before).reduce((n,c)=>n+c.prompt.max_output_tokens,0),900);const result=await response.json();assert.equal(result.data.method,revision);assert.equal(captured.options.rejectIfBusy,revision==='ai-context-v3'?undefined:true);assert.equal(JSON.parse(captured.prompt.input).senses===undefined,['ai-context-v5','ai-context-v6'].includes(revision));assert.equal(result.data.senseId,['ai-context-v5','ai-context-v6'].includes(revision)?'river':null);}
 const health=await (await worker.fetch(new Request('https://worker.test/health'),env)).json();assert.deepEqual(health.acceptedContextRevisions,['ai-context-v3','ai-context-v4','ai-context-v5','ai-context-v6']);
});
