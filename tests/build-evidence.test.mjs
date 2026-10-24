import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm,rename} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {extensionFingerprint,matchesBuild,nativeEvidence} from '../scripts/build-evidence.mjs';

test('installed evidence follows exact packaged files, including edits without a new commit',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'lextide-evidence-'));
 try{
  await mkdir(join(dir,'src'));
  await writeFile(join(dir,'manifest.json'),'{"version":"0.4.0"}');
  await writeFile(join(dir,'src','reader.js'),'original');
  const fingerprint=await extensionFingerprint(dir),version='0.4.0';
  const report={commit:'same-commit',extensionFingerprint:fingerprint,extensionVersion:version,status:'passed'};
  assert.equal(await extensionFingerprint(dir),fingerprint);
  assert.equal(matchesBuild(report,{fingerprint,version}),true);
  await writeFile(join(dir,'src','reader.js'),'modified');
  assert.equal(matchesBuild(report,{fingerprint:await extensionFingerprint(dir),version}),false);
  await writeFile(join(dir,'src','reader.js'),'original');
  await rename(join(dir,'src','reader.js'),join(dir,'src','renamed.js'));
  assert.notEqual(await extensionFingerprint(dir),fingerprint);
  await rename(join(dir,'src','renamed.js'),join(dir,'src','reader.js'));
  await writeFile(join(dir,'extra.js'),'new resource');
  assert.notEqual(await extensionFingerprint(dir),fingerprint);
  await rm(join(dir,'extra.js'));
  assert.equal(await extensionFingerprint(dir),fingerprint);
  assert.equal(matchesBuild(report,{fingerprint,version:'0.4.1'}),false);
  assert.equal(matchesBuild({commit:'same-commit',extensionVersion:version,status:'passed'},{fingerprint,version}),false);
  assert.equal(matchesBuild({}, {fingerprint:undefined,version}),false);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('package metadata separates partial installed results from complete current-build native acceptance',()=>{
 const fingerprint='c'.repeat(64),version='1.2.3',expected={fingerprint,version},identity={extensionFingerprint:fingerprint,extensionVersion:version,extensionId:'a'.repeat(32)};
 const installed={...identity,kind:'installed Chromium MV3',status:'passed',checks:Array.from({length:3},()=>({status:'passed'})),liveDictionary:{status:'通过',kind:'installed MV3 cross-origin Youdao Collins lookup',first:{requests:1,source:'Collins 英汉双解 · 有道公开词条',zh:'海洋',definitions:'Synthetic contract fixture.'},repeat:{requests:0}},contextAPI:{status:'passed',sameWordDifferentContexts:true,contextSentExternally:true},liveContext:{status:'passed',kind:'installed MV3 live context API'}};
 const offscreen={...identity,kind:'installed MV3 offscreen real dictionary lookup',status:'passed',nativeExtensionInstalled:true,realProviderRequestsCompleted:true,lemma:'ocean',senses:4,source:'Collins 英汉双解 · 有道公开词条',offscreenContexts:1,offscreenCreations:1,warmHead:'unit',offscreenCreateMs:10,lookupElapsedMs:200};
 assert.deepEqual(nativeEvidence(installed,undefined,expected),{extensionTests:'passed',offscreenTests:'not run for this build',nativeAcceptancePassed:false});
 assert.equal(nativeEvidence(installed,offscreen,expected).nativeAcceptancePassed,true);
 for(const patch of [{status:'blocked-by-policy'},{extensionFingerprint:'d'.repeat(64)},{extensionVersion:'old'},{realProviderRequestsCompleted:false}])assert.equal(nativeEvidence(installed,{...offscreen,...patch},expected).nativeAcceptancePassed,false);
 assert.equal(nativeEvidence({...installed,liveContext:undefined},offscreen,expected).nativeAcceptancePassed,false);
 assert.equal(nativeEvidence({...installed,extensionFingerprint:'old'},offscreen,expected).extensionTests,'not run for this build');
 assert.equal(nativeEvidence(undefined,undefined,expected).nativeAcceptancePassed,false);
});
