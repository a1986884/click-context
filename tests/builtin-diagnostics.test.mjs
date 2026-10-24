import {test} from 'node:test';
import assert from 'node:assert/strict';
import worker from '../workers/context/index.js';
import {parseContextResult,createContextClient} from '../src/context-meaning.js';
import {parseHTML} from 'linkedom';
import {ParagraphTranslator} from '../src/translation.js';
import {createStore} from '../src/storage.js';
const input={word:'bank',sentence:'The bank holds deposits.',offset:4,senses:[]};
const env=run=>({AI:{run},PER_IP:{limit:async()=>({success:true})},TOTAL:{limit:async()=>({success:true})},TRANSLATION_IP:{limit:async()=>({success:true})},TRANSLATION_TOTAL:{limit:async()=>({success:true})}});
const request=route=>new Request('https://test.example/'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(route.includes('translate')?{text:'The bank holds deposits.',translationRevision:'cloudflare-ai:en-zh:v5'}:{...input,contextRevision:'ai-context-v4'})});
for(const shape of [{code:3036},{code:'3036'},{errors:[{code:3036}]},{message:'3036: You have used up your daily free allocation'}])for(const route of ['userscript/meaning','userscript/translate'])test(route+' classifies explicit free-allocation exhaustion without retry or private details '+JSON.stringify(shape),async()=>{
 let calls=0;const response=await worker.fetch(request(route),env(async()=>{calls++;throw Object.assign(Error('PRIVATE_MODEL_DETAILS'),shape);}));const body=await response.json();
 assert.equal(response.status,503);assert.equal(calls,1);assert.equal(body.retryable,false);assert.equal(body.code,route.includes('translate')?'TRANSLATION_QUOTA_EXCEEDED':'CONTEXT_QUOTA_EXCEEDED');assert.match(body.error,/额度/);assert.doesNotMatch(JSON.stringify(body),/PRIVATE_MODEL_DETAILS|allocation/);
});
for(const [rawReason,reason] of [['max_output_tokens','max-output-tokens'],['content_filter','content-filter'],['PRIVATE_MODEL_DETAILS','unknown']])test('context incomplete output preserves only bounded reason '+reason,async()=>{
 const raw={status:'incomplete',incomplete_details:{reason:rawReason,private:'PRIVATE_MODEL_DETAILS'}};
 assert.throws(()=>parseContextResult(raw,input),e=>e.validationReason==='incomplete'&&e.incompleteReason===reason);
 const body=await(await worker.fetch(request('userscript/meaning'),env(async()=>raw))).json();assert.equal(body.code,'CONTEXT_INVALID_RESULT');assert.equal(body.incompleteReason,reason);assert.equal(body.outputTokenLimit,900);assert.doesNotMatch(JSON.stringify(body),/PRIVATE_MODEL_DETAILS/);
});
test('context client surfaces sanitized quota and incomplete messages without retry or cache',async()=>{
 for(const body of [{code:'CONTEXT_QUOTA_EXCEEDED'},{code:'CONTEXT_INVALID_RESULT',validationReason:'incomplete',incompleteReason:'max-output-tokens'}]){
  let calls=0;const client=createContextClient({fetcher:async()=>{calls++;return Response.json({...body,error:'PRIVATE_MODEL_DETAILS'},{status:503});}});
  for(let i=0;i<2;i++)await assert.rejects(client(input),e=>e.code===body.code&&!e.message.includes('PRIVATE')&&(/额度|不完整/.test(e.message)));
  assert.equal(calls,2);
 }
});
for(const code of ['TRANSLATION_QUOTA_EXCEEDED','TRANSLATION_BUSY'])test('paragraph queue pauses after '+code+' rather than sending the rest of the article',async()=>{
 const {window}=parseHTML('<html><body><main><p>The first public paragraph.</p><p>The second public paragraph.</p></main></body></html>');globalThis.window=window;globalThis.document=window.document;
 const root=document.body,original=root.innerHTML,values=new Map(),store=createStore({get:async k=>values.get(k),set:async(k,v)=>values.set(k,v)});let calls=0;
 const translator=new ParagraphTranslator({root,store,interval:0,translate:async()=>{calls++;throw Object.assign(Error('服务暂不可用'),{code,retryable:false});}});
 try{await translator.start('bilingual',true);assert.equal(calls,1);assert.equal(translator.rateLimited,true);assert.equal(await store.cacheGet('The first public paragraph.'),null);}finally{translator.stop();}
 assert.equal(root.innerHTML,original);
});
for(const shape of [{code:3040},{code:'3040'},{cause:{code:'3040'}},{errors:[{code:'3040'}]},{message:'Inference error: 3040: Capacity temporarily exceeded'}])for(const [route,revision] of [['meaning',undefined],['userscript/meaning','ai-context-v4'],['translate','cloudflare-ai:en-zh:v3'],['userscript/translate','cloudflare-ai:en-zh:v5']])test('capacity is classified once across legacy/current routes '+route+' '+JSON.stringify(shape),async()=>{
 const translating=route.includes('translate'),payload=translating?{text:'The bank holds deposits.',translationRevision:revision}:{...input,...(revision?{contextRevision:revision}:{})};
 let calls=0;const req=new Request('https://test.example/'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
 const response=await worker.fetch(req,env(async()=>{calls++;throw Object.assign(Error('PRIVATE_CAPACITY_DETAILS'),shape);}));const body=await response.json();
 assert.equal(response.status,503);assert.equal(body.code,translating?'TRANSLATION_BUSY':'CONTEXT_BUSY');assert.equal(body.retryable,false);assert.equal(calls,1);assert.doesNotMatch(JSON.stringify(body),/PRIVATE_CAPACITY_DETAILS|Inference error/);
});
