// Shared reader against changed local storage; synthetic dictionary only.
import {chromium} from 'playwright';import {build} from 'esbuild';import assert from 'node:assert/strict';import {mkdir,writeFile} from 'node:fs/promises';
const code=await build({stdin:{resolveDir:process.cwd(),contents:`
 import {mountReader} from './src/reader.js';import {createStore,DEFAULT_PREFS} from './src/storage.js';
 const data={prefs:{...DEFAULT_PREFS,mode:'original',words:true}};globalThis.__base=createStore({get:async k=>data[k],set:async(k,v)=>data[k]=structuredClone(v)});
 globalThis.__reads=0;globalThis.__dictionary=0;globalThis.__delay=false;globalThis.__fail=false;globalThis.__jobs=[];
 const store={...__base,words:async()=>{__reads++;if(__fail)throw Error('Synthetic resume read failure');const value=await __base.words();return __delay?new Promise(resolve=>__jobs.push(()=>resolve(value))):value;}};
 globalThis.__reader=mountReader({root:document.querySelector('main'),store,transport:async(_type,word)=>{__dictionary++;return {word,lemma:word,zh:word==='bank'?'银行测试':'海洋测试',kind:'collins'};}});
`},bundle:true,format:'iife',write:false});
await mkdir('test-results',{recursive:true});const report={kind:'favorite status after returning to a reader',status:'failed',nativeExtensionInstalled:false};let browser;
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||'/usr/bin/chromium'});const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setContent('<main><p id="target">bank ocean</p></main>');await page.evaluate(code.outputFiles[0].text);await page.evaluate(()=>__reader.ready);
 const save=page.locator('lextide-reader #save'),resume=()=>page.evaluate(()=>{window.dispatchEvent(new Event('focus'));document.dispatchEvent(new Event('visibilitychange'));});
 await page.evaluate(async()=>{await __base.saveWord({word:'bank',lemma:'bank',zh:'银行测试',sentence:''});await __reader.show('bank',document.querySelector('#target'));});assert.equal(await save.textContent(),'已收藏');
 await page.evaluate(()=>__base.removeWord('bank'));const before=await page.evaluate(()=>__reads);await resume();
 await page.waitForFunction(()=>__reader.shadow.querySelector('#save').textContent==='收藏这次用法',null,{timeout:5000});assert.equal(await page.evaluate(()=>__reads),before+1,'same-task resume events coalesce');assert.equal(await page.evaluate(()=>__dictionary),1);
 await page.evaluate(()=>__base.saveWord({word:'bank',lemma:'bank',zh:'银行测试',sentence:''}));await resume();await page.waitForFunction(()=>__reader.shadow.querySelector('#save').textContent==='已收藏');
 // A delayed resume snapshot may not overwrite the next card or its new save.
 await page.evaluate(()=>__delay=true);await resume();await page.waitForFunction(()=>__jobs.length===1);await page.evaluate(()=>void __reader.show('ocean',document.querySelector('#target')));await page.waitForFunction(()=>__jobs.length===2);await save.click();await page.waitForFunction(()=>__reader.shadow.querySelector('#save').textContent==='已收藏');
 await page.evaluate(()=>{__delay=false;for(const resolve of __jobs.splice(0))resolve();});await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));assert.equal(await save.textContent(),'已收藏');assert.equal(await page.evaluate(()=>__dictionary),2);
 await page.evaluate(()=>__fail=true);await resume();await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));assert.equal(await page.locator('lextide-reader .zh').textContent(),'海洋测试');assert.equal(await save.textContent(),'已收藏');await page.evaluate(()=>__fail=false);
 await page.keyboard.press('Escape');const hidden=await page.evaluate(()=>__reads);await resume();await page.evaluate(()=>new Promise(r=>requestAnimationFrame(r)));assert.equal(await page.evaluate(()=>__reads),hidden);
 await page.evaluate(()=>__reader.openVocabulary());await page.evaluate(()=>__base.saveWord({word:'study',lemma:'study',zh:'研究测试',sentence:''}));await resume();await page.locator('lextide-reader #vocab-list h2').filter({hasText:'study'}).waitFor();
 await page.evaluate(()=>__reader.destroy());const destroyed=await page.evaluate(()=>__reads);await resume();await page.evaluate(()=>new Promise(r=>requestAnimationFrame(r)));assert.equal(await page.evaluate(()=>__reads),destroyed);assert.deepEqual(errors,[]);report.status='passed';console.log(JSON.stringify(report));
}catch(error){report.error=error.stack;throw error;}finally{await browser?.close();await writeFile('test-results/favorite-resume-report.json',JSON.stringify(report,null,2));}
