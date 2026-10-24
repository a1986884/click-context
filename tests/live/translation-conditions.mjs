// Original public-safe samples, real endpoint; no installed-extension evidence.
import {previewExpectation,verifyPublishedPreview} from './preview-evidence.mjs';
import {collectTranslationSamples} from './translation-probe.mjs';
import {conditionCases} from './condition-cases.mjs';
import {chromium} from 'playwright';import assert from 'node:assert/strict';import {mkdir,writeFile} from 'node:fs/promises';
await mkdir('test-results',{recursive:true});
const report={startedAt:new Date().toISOString(),status:'failed',kind:'live condition-direction matrix from published preview origin; finite automatic constraints',nativeExtensionInstalled:false,reviewRequired:true,version:null,previewVerified:false,previewCommitVerified:false,activePhase:'browser-launch',samples:[],caseDefinitions:conditionCases.map(({id,relation,negative,text})=>({id,relation,negative,text})),limitations:'Finite phrase constraints do not prove general semantic fidelity; unrecognized wording needs review.'};let browser;
try{
 Object.assign(report,await previewExpectation());browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||'/usr/bin/chromium'});const page=await browser.newPage();report.activePhase='published-page';await page.goto(process.env.PREVIEW_URL||'https://v04-preview.lextide.pages.dev/');report.activePhase='deployment-metadata';await verifyPublishedPreview(page,report);
 report.activePhase='conditional-samples';await collectTranslationSamples(page,report,{samples:conditionCases.map(c=>c.text),validate:(translated,index)=>conditionCases[index].validate(translated)});
 assert.equal(report.samples.length,7,'All seven condition samples must run once');assert.equal(report.failureCount,0,'Conditional sample failures: '+report.failureCount);report.activePhase='complete';report.status='passed';
}catch(error){report.error=error.stack;throw error;}finally{
 for(const [index,sample] of report.samples.entries())sample.id=conditionCases[index]?.id;
 report.finishedAt=new Date().toISOString();try{await browser?.close();}catch(error){report.cleanupError=error.stack;report.status='failed';process.exitCode=1;}
 await writeFile('test-results/live-translation-conditions.json',JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,samples:report.samples.length,failureCount:report.failureCount,nativeExtensionInstalled:false}));
}
