// Explicit opt-in: real default-service inference from the published preview.
import {chromium} from 'playwright';import {mkdir,writeFile} from 'node:fs/promises';import assert from 'node:assert/strict';
import {previewExpectation,verifyPublishedPreview} from './preview-evidence.mjs';
import {TRANSLATION_ENDPOINT,TRANSLATION_MODEL,TRANSLATION_LEGACY_CACHE_VERSION,TRANSLATION_PREVIOUS_CACHE_VERSION} from '../../src/translation-service.js';
await mkdir('test-results',{recursive:true});const report={startedAt:new Date().toISOString(),status:'failed',kind:'fresh real legacy translation compatibility from published origin',nativeExtensionInstalled:false,activePhase:'browser-launch',samples:[]};let browser;
try{
 Object.assign(report,await previewExpectation());browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||'/usr/bin/chromium'});const page=await browser.newPage();await page.goto(process.env.PREVIEW_URL||'https://v04-preview.lextide.pages.dev/');await verifyPublishedPreview(page,report);report.activePhase='legacy-requests';
 for(const revision of [undefined,TRANSLATION_LEGACY_CACHE_VERSION,TRANSLATION_PREVIOUS_CACHE_VERSION]){
  const sample={requestedRevision:revision??'omitted',passed:false};report.samples.push(sample);
  try{Object.assign(sample,await page.evaluate(async({endpoint,revision})=>{const began=Date.now(),text='Water freezes at 0 degrees Celsius.';const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,...(revision?{translationRevision:revision}:{})}),signal:AbortSignal.timeout(22000),credentials:'omit',referrerPolicy:'no-referrer'});return {httpStatus:response.status,body:await response.json(),elapsedMs:Date.now()-began};},{endpoint:TRANSLATION_ENDPOINT,revision}));assert.equal(sample.httpStatus,200);assert.equal(sample.body.ok,true);assert.equal(sample.body.data.version,revision??TRANSLATION_LEGACY_CACHE_VERSION);assert.equal(sample.body.data.model,TRANSLATION_MODEL);assert.match(sample.body.data.text,/0/);assert.match(sample.body.data.text,/(?:结冰|冻结)/);sample.passed=true;}catch(error){sample.error=error.message;}
 }
 assert.ok(report.samples.every(s=>s.passed),'Each old protocol must pass; original failures remain recorded');report.status='passed';report.activePhase='complete';console.log(JSON.stringify({status:report.status,samples:report.samples.length,nativeExtensionInstalled:false}));
}catch(error){report.error=error.stack;throw error;}
finally{try{await browser?.close();}catch(error){report.cleanupError=error.message;report.status='failed';process.exitCode=1;}report.finishedAt=new Date().toISOString();await writeFile('test-results/live-translation-compatibility.json',JSON.stringify(report,null,2));}
