// Fully intercepted module transport. No provider requests or native installation.
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {sourceState} from '../../scripts/build-evidence.mjs';
import {observePreviewModules} from './preview-modules.mjs';
const pkg=JSON.parse(await readFile(new URL('../../package.json',import.meta.url)));
const report={startedAt:new Date().toISOString(),version:pkg.version,source:sourceState(),kind:'local synthetic module-loading diagnostics',liveProviderVerified:false,nativeExtensionInstalled:false,status:'failed',checks:[]};
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||'/usr/bin/chromium'});await mkdir('test-results',{recursive:true});
try{
 for(const mode of ['http503','non-js200','network','dependency502','success']){
  const page=await browser.newPage(),evidence={},paths=[];observePreviewModules(page,'http://module-fixture.test',evidence);
  await page.route('**/*',async route=>{
   const url=new URL(route.request().url());assert.equal(url.origin,'http://module-fixture.test');paths.push(url.pathname);
   if(url.pathname==='/')return route.fulfill({contentType:'text/html',body:'<!doctype html><title>Synthetic modules</title>'});
   assert.ok(['/src/reader.js','/src/dependency.js'].includes(url.pathname),'Unexpected request must remain intercepted');
   if(url.pathname==='/src/dependency.js')return route.fulfill({status:502,contentType:'application/javascript',body:'/* synthetic dependency failure */'});
   if(mode==='network')return route.abort('connectionfailed');
   if(mode==='non-js200')return route.fulfill({status:200,contentType:'text/html',body:'<h1>Synthetic wrong media type</h1>'});
   return route.fulfill({status:mode==='http503'?503:200,contentType:'application/javascript',body:(mode==='dependency502'?"import '/src/dependency.js';":"")+'export const mountReader=()=>{};'});
  });
  await page.goto('http://module-fixture.test');let importError=null,mountReader=null;
  try{mountReader=await page.evaluate(async()=>typeof(await import('/src/reader.js')).mountReader);}catch(error){importError=error.message;}
  const check={mode,...evidence,paths,importError,status:'failed'};report.checks.push(check);
  assert.ok(paths.every(p=>p==='/'||p.endsWith('.js')),'No inference is allowed');
  if(mode==='success'){assert.equal(importError,null);assert.equal(mountReader,'function');}else assert.ok(importError);
  if(mode==='network'){assert.equal(evidence.moduleResponses.length,0);assert.equal(evidence.moduleNetworkFailures[0].path,'/src/reader.js');assert.match(evidence.moduleNetworkFailures[0].error,/ERR_/);}
  else{
   const response=evidence.moduleResponses.find(r=>r.path===(mode==='dependency502'?'/src/dependency.js':'/src/reader.js'));
   assert.equal(response.httpStatus,mode==='http503'?503:mode==='dependency502'?502:200);assert.equal(response.contentType,mode==='non-js200'?'text/html':'application/javascript');
  }
  check.status='passed';await page.close();console.log('PASS synthetic module '+mode+' (no inference)');
 }
 report.status='passed';
}catch(error){report.error=error.stack;throw error;}finally{report.finishedAt=new Date().toISOString();await browser.close();await writeFile('test-results/module-diagnostics.json',JSON.stringify(report,null,2));}
