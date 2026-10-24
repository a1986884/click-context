// Real public documents, shared DOM engine, synthetic translations except one
// explicitly reported live Cloudflare AI sample per site when LIVE_TRANSLATION=1.
import {chromium} from 'playwright';
import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
import {translate} from '../../src/core.js';
import assert from 'node:assert/strict';
const compiled=await build({stdin:{resolveDir:process.cwd(),contents:`
 import {ParagraphTranslator} from './src/translation.js';import {proseUnits} from './src/prose-units.js';import {createStore} from './src/storage.js';
 globalThis.__units=proseUnits(document.body);globalThis.__calls=[];const values=new Map();const store=createStore({get:async k=>values.get(k),set:async(k,v)=>values.set(k,v)});
 globalThis.__webTranslator=new ParagraphTranslator({root:document.body,store,interval:0,translate:async text=>{__calls.push(text);return text===globalThis.__liveOriginal?globalThis.__liveTranslated:'网页兼容测试译文';}});
 `},bundle:true,format:'iife',write:false});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||'/usr/bin/chromium'});
const report={kind:'real public-page DOM compatibility; no native extension installed',syntheticDOMTranslations:true,sites:[]};
await mkdir('test-results',{recursive:true});
try{for(const [name,url]of [['personal-blog','https://paulgraham.com/read.html'],['documentation','https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Introduction'],['wikipedia','https://en.wikipedia.org/wiki/Ocean']]){
 const page=await browser.newPage({viewport:{width:1100,height:900}}),result={name,url,status:'failed'};page.setDefaultTimeout(15000);
 try{
  const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});assert.ok(response.ok(),'HTTP '+response.status());await page.evaluate(compiled.outputFiles[0].text);
  const sample=await page.evaluate(()=>__units.find(u=>u.text.length>=50&&u.text.length<=300)?.text);result.units=await page.evaluate(()=>__units.length);assert.ok(result.units>0);
  if(process.env.LIVE_TRANSLATION==='1'&&sample){try{const started=Date.now(),zh=await translate(sample);result.liveTranslation={status:'passed',source:'Cloudflare AI live API',characters:sample.length,zh,elapsedMs:Date.now()-started};assert.match(zh,/[\u3400-\u9fff]/);await page.evaluate(({sample,zh})=>{globalThis.__liveOriginal=sample;globalThis.__liveTranslated=zh;},{sample,zh});}catch(error){result.liveTranslation={status:'failed',reason:error.message};}}
  await page.evaluate(()=>{globalThis.__originalLinks=Array.from(document.querySelectorAll('main a,article a,td a')).slice(0,20);globalThis.__linkValues=__originalLinks.map(a=>a.getAttribute('href'));});
  await page.evaluate(()=>__webTranslator.start('bilingual',true));await page.waitForFunction(()=>document.querySelector('.lextide-translation'));
  result.translatedVisibleUnits=await page.locator('.lextide-translation').count();result.requestCount=await page.evaluate(()=>__calls.length);assert.ok(result.translatedVisibleUnits>0);
  assert.equal(await page.evaluate(()=>__originalLinks.every((a,i)=>a.isConnected&&a.getAttribute('href')===__linkValues[i])),true);
  assert.equal(await page.locator('tr > .lextide-translation,thead > .lextide-translation,tbody > .lextide-translation').count(),0);
  await page.screenshot({path:'test-results/real-'+name+'.png'});await page.evaluate(()=>__webTranslator.stop());assert.equal(await page.locator('.lextide-translation').count(),0);result.status='passed';
 }catch(error){result.error=error.message;}finally{await page.close();report.sites.push(result);console.log(JSON.stringify(result));}
}}finally{await browser.close();await writeFile('test-results/public-webpage-compatibility.json',JSON.stringify(report,null,2));}
if(report.sites.some(s=>s.status!=='passed'||s.liveTranslation?.status==='failed'))process.exitCode=1;
