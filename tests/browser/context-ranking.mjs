// Ordinary-browser UI fixture. Native installation evidence comes from extension.mjs.
import {chromium} from 'playwright';
import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const compiled=await build({stdin:{resolveDir:process.cwd(),contents:`
 import {mountReader} from './src/reader.js';import {cacheWordLookup} from './src/dictionary-cache.js';import {createStore,DEFAULT_PREFS} from './src/storage.js';
 const values=new Map([['prefs',{...DEFAULT_PREFS,mode:'original',online:true}]]),store=createStore({get:async k=>values.get(k),set:async(k,v)=>values.set(k,structuredClone(v))});
 globalThis.__contextCalls=[];const lookup=cacheWordLookup(async()=>{globalThis.__contextCalls.push('bank');return {word:'bank',lemma:'bank',kind:'collins',source:'Synthetic UI fixture, not live Collins data',senses:[{id:'money',pos:'N-COUNT',definition:'An institution holding money and financial deposits.',zh:'金融测试',examples:[]},{id:'river',pos:'N-COUNT',definition:'The land beside a river or stream.',zh:'河岸测试',examples:[]}]};});
 globalThis.__contextReader=mountReader({root:document.querySelector('main'),store,transport:(type,word,online,options)=>type==='context'?Promise.resolve({senseId:options.context.sentence.includes('river')?'river':'money',zh:options.context.sentence.includes('river')?'河岸测试':'金融测试'}):lookup(word,{...options,online})});
 `},bundle:true,format:'iife',write:false});
const report={kind:'ordinary browser UI fixture',nativeExtensionInstalled:false,status:'failed'};let browser;
await mkdir('test-results',{recursive:true});
try{
 browser=await chromium.launch(process.env.CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.CHROMIUM_EXECUTABLE_PATH}:{channel:'chromium'});
 const page=await browser.newPage({viewport:{width:1000,height:800}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setContent('<html><body style="font:20px/1.8 sans-serif;padding:70px"><main><p>She deposited her salary at the <strong id="money">bank</strong>.</p><p>They sat on the <strong id="river">bank</strong> beside the river.</p><p>The <strong id="unclear">bank</strong> was there.</p></main></body></html>');
 await page.evaluate(compiled.outputFiles[0].text);await page.evaluate(()=>globalThis.__contextReader.ready);
 await page.locator('#money').click();await page.locator('lextide-reader .zh').filter({hasText:'金融测试'}).waitFor();await page.keyboard.press('Escape');
 await page.evaluate(()=>{const text=document.querySelector('#river').firstChild,range=document.createRange();range.selectNodeContents(text);const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);});
 await page.locator('lextide-reader #lookup-selection').waitFor({state:'visible'});assert.equal(await page.evaluate(()=>globalThis.__contextCalls.length),1);
 await page.locator('lextide-reader #lookup-selection').click();await page.locator('lextide-reader .zh').filter({hasText:'河岸测试'}).waitFor();assert.equal(await page.evaluate(()=>globalThis.__contextCalls.length),1);
 if(await page.locator('lextide-reader .other-senses').getAttribute('open')===null)await page.locator('lextide-reader .other-senses summary').click();await page.locator('lextide-reader #sense-choice').selectOption('money');assert.equal(await page.locator('lextide-reader .zh').textContent(),'金融测试');
 await page.screenshot({path:'test-results/context-selection-desktop.png'});
 await page.keyboard.press('Escape');await page.locator('#unclear').click();await page.locator('lextide-reader .sense-status').filter({hasText:'按原句匹配的词典义项'}).waitFor();assert.equal(await page.locator('lextide-reader #sense-choice').inputValue(),'money');
 await page.setViewportSize({width:390,height:844});const rect=await page.locator('lextide-reader .dict').boundingBox();assert.ok(rect.x>=0&&rect.x+rect.width<=391);
 await page.screenshot({path:'test-results/context-selection-mobile.png'});
 await page.keyboard.press('Escape');await page.setViewportSize({width:1000,height:800});
 await page.evaluate(()=>{const p=document.createElement('p');p.innerHTML='She used the bank. Dr. Smith deposited 3.5 dollars at the <strong id="accurate">ba<em>nk</em></strong>.<span style="display:none">SECRET river water.</span><span class="lextide-translation">中文译文。</span> They left.';document.querySelector('main').append(p);});
 await page.evaluate(()=>{const element=document.querySelector('#accurate'),range=document.createRange();range.selectNodeContents(element);const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);});
 await page.locator('lextide-reader #lookup-selection').waitFor({state:'visible'});await page.locator('lextide-reader #lookup-selection').click();
 await page.locator('lextide-reader .zh').filter({hasText:'金融测试'}).waitFor();
 assert.equal(await page.locator('lextide-reader .sentence').textContent(),'当前句子：Dr. Smith deposited 3.5 dollars at the bank.');
 assert.equal(await page.evaluate(()=>globalThis.__contextCalls.length),1);assert.deepEqual(errors,[]);
 report.status='passed';report.checks=['selected-word action sends no query until clicked','same cached candidates rank by the current sentence','manual override works','identical contextual gloss selects the real dictionary option','narrow viewport','repeated words and cross-inline selections preserve the correct sentence','hidden and extension text excluded; titles and decimals preserved','no uncaught page errors'];console.log(JSON.stringify(report));
}catch(error){report.error=error.stack;throw error;}finally{await browser?.close();await writeFile('test-results/context-ranking-report.json',JSON.stringify(report,null,2));}
