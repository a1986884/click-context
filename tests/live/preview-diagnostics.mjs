// Fully intercepted metadata fixtures. No live provider or native installation.
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {sourceState} from '../../scripts/build-evidence.mjs';
import {verifyPublishedPreview} from './preview-evidence.mjs';
const pkg=JSON.parse(await readFile(new URL('../../package.json',import.meta.url)));
const expectedCommit='a'.repeat(40),original={version:process.env.EXPECTED_PREVIEW_VERSION,commit:process.env.EXPECTED_PREVIEW_COMMIT};
const report={startedAt:new Date().toISOString(),version:pkg.version,source:sourceState(),kind:'local synthetic published-version diagnostics',liveProviderVerified:false,nativeExtensionInstalled:false,status:'failed',checks:[]};
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||'/usr/bin/chromium'});await mkdir('test-results',{recursive:true});
try{
 for(const mode of ['success','http503','non-json502','non-json200','network','timeout','wrong-version','wrong-commit','dirty','missing-dirty','missing-commit','missing-expected-commit']){
  const page=await browser.newPage(),evidence={},paths=[];let probeError=null;
  process.env.EXPECTED_PREVIEW_VERSION=mode==='missing-expected-commit'?'synthetic-other-version':pkg.version;process.env.EXPECTED_PREVIEW_COMMIT=expectedCommit;
  if(mode==='missing-expected-commit')delete process.env.EXPECTED_PREVIEW_COMMIT;
  const fixture={version:process.env.EXPECTED_PREVIEW_VERSION,commit:expectedCommit,dirty:false};
  if(mode==='wrong-version')fixture.version='0.0.0';if(mode==='wrong-commit')fixture.commit='b'.repeat(40);
  if(mode==='dirty')fixture.dirty=true;if(mode==='missing-dirty')delete fixture.dirty;if(mode==='missing-commit')delete fixture.commit;
  await page.route('**/*',async route=>{
   const path=new URL(route.request().url()).pathname;paths.push(path);
   if(path==='/')return route.fulfill({contentType:'text/html',body:'<!doctype html><title>Synthetic metadata diagnostics</title>'});
   assert.equal(path,'/version.json','No inference or unrelated network request is allowed');
   if(mode==='network')return route.abort('connectionfailed');if(mode==='timeout')return;
   if(mode.startsWith('non-json'))return route.fulfill({status:mode==='non-json502'?502:200,contentType:'text/html',body:'<h1>Synthetic non-JSON</h1>'});
   return route.fulfill({status:mode==='http503'?503:200,json:fixture});
  });
  await page.goto('http://preview-fixture.test');let watchdog;
  try{await Promise.race([verifyPublishedPreview(page,evidence,{timeoutMs:mode==='timeout'?100:10000}),new Promise((_,reject)=>{watchdog=setTimeout(()=>reject(Error('Fixture watchdog: metadata deadline missing')),2000);})]);}catch(error){probeError=error.message;}finally{clearTimeout(watchdog);}
  const check={mode,...evidence,probeError,paths,status:'failed'};report.checks.push(check);
  assert.deepEqual(paths,['/','/version.json']);assert.equal(evidence.previewVerified,mode==='success');assert.equal(evidence.previewCommitVerified,mode==='success');
  if(mode==='success')assert.equal(probeError,null);else assert.ok(probeError);
  if(['network','timeout'].includes(mode)){
   assert.equal(evidence.previewHTTPStatus,null);assert.equal(evidence.version,null);assert.equal(evidence.previewFailureKind,mode);
   assert.ok(!probeError.includes('watchdog'),'Probe must enforce its own deadline');
  }else{
   assert.equal(evidence.previewHTTPStatus,mode==='http503'?503:mode==='non-json502'?502:200);
   if(mode.startsWith('non-json')){assert.equal(evidence.version,null);assert.equal(evidence.previewFailureKind,'non-json');}
   else{assert.deepEqual(evidence.version,fixture);if(mode==='http503')assert.equal(evidence.previewFailureKind,'http');}
  }
  if(mode==='missing-expected-commit'){assert.equal(evidence.expectedCommit,null);assert.match(probeError,/EXPECTED_PREVIEW_COMMIT/);}
  check.status='passed';await page.close();console.log('PASS synthetic metadata '+mode+' (no inference)');
 }
 report.status='passed';
}catch(error){report.error=error.stack;throw error;}finally{
 for(const [name,key] of [['EXPECTED_PREVIEW_VERSION','version'],['EXPECTED_PREVIEW_COMMIT','commit']]){if(original[key]===undefined)delete process.env[name];else process.env[name]=original[key];}
 report.finishedAt=new Date().toISOString();await browser.close();await writeFile('test-results/preview-diagnostics.json',JSON.stringify(report,null,2));
}
