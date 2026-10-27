// Real modeless panels and cancellation; synthetic held dictionary replies.
import {chromium} from 'playwright';import {build} from 'esbuild';import assert from 'node:assert/strict';import {mkdir,writeFile} from 'node:fs/promises';
const code=await build({stdin:{resolveDir:process.cwd(),contents:`
 import {mountReader} from './src/reader.js';import {createStore,DEFAULT_PREFS} from './src/storage.js';
 globalThis.__jobs=[];globalThis.__external=0;
 globalThis.__mount=external=>{globalThis.__reader?.destroy();const data={prefs:{...DEFAULT_PREFS,mode:'original',words:true}},store=createStore({get:async k=>data[k],set:async(k,v)=>data[k]=structuredClone(v)});
  globalThis.__reader=mountReader({root:document.querySelector('main'),store,...(external?{onOpenVocabulary:()=>{__external++;}}:{}),transport:async(type,word,_online,{signal})=>type==='context'?{senseId:null,zh:'已完成释义'}:new Promise(resolve=>__jobs.push({word,signal,resolve}))});return __reader.ready;};
`},bundle:true,format:'iife',write:false});
await mkdir('test-results',{recursive:true});const report={kind:'reader panel switching and pending lookup cancellation',status:'failed',nativeExtensionInstalled:false};let browser;
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||'/usr/bin/chromium'});const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setContent('<main style="padding:40px;font:22px/2 Georgia"><p>The <b id="word">bank</b> is open.</p></main>');await page.evaluate(code.outputFiles[0].text);await page.evaluate(()=>__mount(false));
 const card=page.locator('lextide-reader .dict'),panel=page.locator('lextide-reader .panel'),vocab=page.locator('lextide-reader .vocab');
 await page.locator('#word').click();await page.waitForFunction(()=>__jobs.length===1);
 await page.locator('lextide-reader .bubble').click({delay:620});await panel.waitFor({state:'visible'});
 assert.equal(await card.isVisible(),false,'settings must not overlap an active word card');
 assert.equal(await page.evaluate(()=>__jobs[0].signal.aborted),true,'switching panels cancels the abandoned lookup');
 assert.equal(await page.evaluate(()=>__reader.shadow.activeElement?.id),'mode');
 await page.evaluate(()=>__jobs[0].resolve({word:'bank',lemma:'bank',zh:'迟到释义',senses:[]}));
 await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 assert.equal(await card.isVisible(),false);assert.equal(await panel.isVisible(),true);
 await page.locator('lextide-reader #vocabulary').click();await vocab.waitFor({state:'visible'});assert.equal(await panel.isVisible(),false);
 // Opening the vocabulary avoids the mobile keyboard by focusing its close button.
 await page.waitForFunction(()=>__reader.shadow.activeElement===__reader.shadow.querySelector('.vocab .close'));
 assert.equal(await page.evaluate(()=>__reader.shadow.activeElement===__reader.shadow.querySelector('.vocab .close')),true);
 assert.equal(await page.evaluate(()=>__reader.shadow.activeElement===__reader.shadow.querySelector('#vocab-search')),false);
 await page.evaluate(()=>__reader.openSettings());assert.equal(await vocab.isVisible(),false);assert.equal(await page.evaluate(()=>__reader.shadow.activeElement?.id),'mode');
 await page.keyboard.press('Escape');assert.equal(await panel.isVisible(),false);
 // Finished entries survive settings changes, while staying hidden behind settings.
 await page.locator('#word').click();await page.waitForFunction(()=>__jobs.length===2);
 await page.evaluate(()=>__jobs[1].resolve({word:'bank',lemma:'bank',zh:'已完成释义',senses:[]}));
 await page.waitForFunction(()=>!__reader.shadow.querySelector('#save').disabled);
 await page.evaluate(()=>__reader.openSettings());assert.equal(await card.isVisible(),false);
 await page.locator('lextide-reader .panel .close').click();assert.equal(await card.isVisible(),true);assert.equal(await page.locator('lextide-reader .zh').textContent(),'已完成释义');
 await page.keyboard.press('Escape');
 // The extension opens a separate vocabulary tab; it must also stop the old query.
 await page.evaluate(()=>__mount(true));await page.locator('#word').click();await page.waitForFunction(()=>__jobs.length===3);await page.evaluate(()=>__reader.openVocabulary());
 assert.equal(await page.evaluate(()=>__external),1);assert.equal(await card.isVisible(),false);assert.equal(await page.evaluate(()=>__jobs[2].signal.aborted),true);
 assert.deepEqual(errors,[]);report.status='passed';console.log(JSON.stringify(report));
}catch(error){report.error=error.stack;throw error;}finally{await browser?.close();await writeFile('test-results/panel-switching-report.json',JSON.stringify(report,null,2));}
