import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCloudQA,nativeVerdict,offscreenVerdict} from '../cloud-qa/worker.mjs';
const manifest={version:'0.6.0',dictionaryProvider:'youdao-collins-public-page',sourceCommit:'source',extensionFingerprint:'fingerprint'};
const native={kind:'installed Chromium MV3',status:'passed',extensionId:'a'.repeat(32),extensionVersion:manifest.version,extensionFingerprint:manifest.extensionFingerprint,checks:[{status:'passed'},{status:'passed'},{status:'passed'}],contextAPI:{status:'passed',sameWordDifferentContexts:true,contextSentExternally:true},liveContext:{status:'passed',kind:'installed MV3 live context API'},liveDictionary:{status:'通过',kind:'installed MV3 cross-origin Youdao Collins lookup',first:{requests:1,source:'Collins 英汉双解 · 有道公开词条',zh:'海洋',definitions:'A synthetic contract fixture.'},repeat:{requests:0}}};
const offscreen={kind:'installed MV3 offscreen real dictionary lookup',status:'passed',nativeExtensionInstalled:true,extensionId:native.extensionId,extensionVersion:manifest.version,extensionFingerprint:manifest.extensionFingerprint,realProviderRequestsCompleted:true,lemma:'ocean',senses:4,source:'Collins 英汉双解 · 有道公开词条',offscreenContexts:1,offscreenCreations:1,warmHead:'unit',offscreenCreateMs:12,lookupElapsedMs:300};
test('cloud bridge only accepts matching native installation evidence, never a component fixture or a stale build',()=>{
 assert.equal(nativeVerdict(native,manifest,offscreen),true);
 for(const patch of [{kind:'ordinary page fixture'},{contextAPI:{status:'passed',sameWordDifferentContexts:true,contextSentExternally:false}},{liveContext:undefined},{extensionId:undefined},{extensionFingerprint:'old'},{status:'blocked'},{liveDictionary:{...native.liveDictionary,repeat:{requests:2}}}])assert.equal(nativeVerdict({...native,...patch},manifest,offscreen),false);
});
test('cloud test source and reports require a private token; report acceptance is derived independently',async()=>{
 const values=new Map(),env={QA_TOKEN:'EXAMPLE_QA_TOKEN_NOT_REAL',QA_STORE:{get:async key=>values.get(key),put:async(key,value)=>values.set(key,JSON.parse(value))}};
 const worker=createCloudQA({manifest,bundle:btoa('unit fixture')});
 assert.equal((await worker.fetch(new Request('https://qa.test/manifest'),env)).status,401);
 assert.equal((await worker.fetch(new Request('https://qa.test/health'),env)).status,200);
 const headers={Authorization:'Bearer '+env.QA_TOKEN,'Content-Type':'application/json'};
 const report=async data=>worker.fetch(new Request('https://qa.test/report',{method:'POST',headers,body:JSON.stringify(data)}),env);
 assert.equal((await report({sourceCommit:'wrong',status:'finished'})).status,400);
 let response=await report({sourceCommit:'source',status:'running',nativeAcceptancePassed:true});assert.equal((await response.json()).nativeAcceptancePassed,false);
 response=await report({sourceCommit:'source',status:'finished',exitCode:0,nativeReport:native,offscreenReport:offscreen});assert.equal((await response.json()).nativeAcceptancePassed,true);
 const latest=await worker.fetch(new Request('https://qa.test/latest',{headers}),env);assert.equal((await latest.json()).nativeReport.extensionId,native.extensionId);
 const updated=createCloudQA({manifest:{...manifest,sourceCommit:'next-build'},bundle:''});
 const stale=await updated.fetch(new Request('https://qa.test/latest',{headers}),env);const pending=await stale.json();assert.equal(pending.nativeAcceptancePassed,false);assert.equal(pending.status,'waiting_for_notebook');
 const oversized=await worker.fetch(new Request('https://qa.test/report',{method:'POST',headers,body:'x'.repeat(128*1024+1)}),env);assert.equal(oversized.status,400);
});

test('native acceptance requires matching installed offscreen evidence with measured creation and real lookup',()=>{
 assert.equal(nativeVerdict(native,manifest),false);
 for(const patch of [{status:'blocked-by-policy'},{kind:'ordinary DOMParser page'},{nativeExtensionInstalled:false},{extensionVersion:'old'},{extensionFingerprint:'old'},{extensionId:'b'.repeat(32)},{realProviderRequestsCompleted:false},{offscreenCreateMs:null},{offscreenCreateMs:-1},{lookupElapsedMs:undefined},{offscreenContexts:0},{offscreenCreations:2},{warmHead:'wrong'},{lemma:'wrong'},{senses:0},{source:'synthetic dictionary'}]){
  assert.equal(offscreenVerdict({...offscreen,...patch},manifest,native.extensionId),false,JSON.stringify(patch));
  assert.equal(nativeVerdict(native,manifest,{...offscreen,...patch}),false,JSON.stringify(patch));
 }
});
test('latest report rechecks stored acceptance rather than trusting an earlier flag',async()=>{
 const stored={sourceCommit:manifest.sourceCommit,status:'finished',exitCode:0,nativeAcceptancePassed:true,nativeReport:native};
 const env={QA_TOKEN:'unit-token',QA_STORE:{get:async()=>stored}};
 const worker=createCloudQA({manifest,bundle:''});
 const result=await worker.fetch(new Request('https://qa.test/latest',{headers:{Authorization:'Bearer unit-token'}}),env);
 assert.equal((await result.json()).nativeAcceptancePassed,false);
});
