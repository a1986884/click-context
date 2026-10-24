// Shared reader with synthetic outage/recovery. No provider calls or installation.
import {build} from 'esbuild';
import assert from 'node:assert/strict';
export async function runReaderOutageChecks(browser){
const checks=[];const compiled=await build({stdin:{resolveDir:process.cwd(),contents:`
import {mountReader} from './src/reader.js';import {createStore} from './src/storage.js';
const values=new Map();globalThis.__store=createStore({get:async k=>values.get(k),set:async(k,v)=>values.set(k,structuredClone(v))});
globalThis.__calls=[];globalThis.__scenario='outage';globalThis.__reader=mountReader({root:document.querySelector('main'),store:__store,schedulerOptions:{interval:0},transport:(type,text,online,{signal})=>{__calls.push(text);if(__scenario==='outage')throw Object.assign(Error('合成服务暂不可用'),{code:'TRANSLATION_UNAVAILABLE',retryable:false});if(__scenario==='pending'){globalThis.__pendingSignal=signal;globalThis.__pendingText=text;return new Promise(resolve=>globalThis.__resolve=resolve);}return Promise.resolve('合成译文：'+text);}});
`},bundle:true,format:'iife',write:false});
for(const unit of ['sentence','paragraph'])for(const width of [1100,390])for(const mode of ['single','all','cancel-pending','dynamic-all','dynamic-single']){
 const page=await browser.newPage({viewport:{width,height:900}}),errors=[],network=[];await page.route('**/*',route=>{network.push(route.request().url());return route.abort();});page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(5000);
 await page.setContent('<main style="font:20px/1.8 system-ui;margin:40px"><p>First <em>scientific sentence.</em> A second sentence links to <a href="#paper">the paper</a>. A final sentence follows.</p></main>');
 if(mode.startsWith('dynamic'))await page.evaluate(()=>document.querySelector('main p').textContent='Original first sentence. Original second sentence.');
 await page.evaluate(()=>{globalThis.__markup=document.querySelector('main').innerHTML;globalThis.__link=document.querySelector('a');});await page.evaluate(compiled.outputFiles[0].text);await page.evaluate(async unit=>{await __reader.ready;await __reader.setTranslationUnit(unit);__reader.openSettings();},unit);
 await page.locator('lextide-reader #bilingual-enabled').check();await page.locator('lextide-reader #status').filter({hasText:'服务暂不可用，后续翻译已暂停'}).waitFor();assert.equal(await page.evaluate(()=>__calls.length),1);assert.equal(await page.locator('.lextide-translation button').count(),1);
 await page.evaluate(()=>{dispatchEvent(new Event('scroll'));dispatchEvent(new Event('resize'));});await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>__calls.length),1,'Viewport events must not retry a paused service');
 if(mode.startsWith('dynamic')){
  await page.evaluate(mode=>{__scenario='success';const p=document.querySelector('main p'),button=document.querySelector('.lextide-translation button'),updated='Replacement first sentence. Replacement second sentence.';if(mode==='dynamic-all'){p.textContent=updated;__reader.shadow.querySelector('#retry-all').click();}else{p.firstChild.nodeValue=updated;button.click();}},mode);
  await page.waitForFunction(n=>document.querySelectorAll('.lextide-translation-text').length===n,unit==='sentence'?2:1);
  const calls=await page.evaluate(()=>__calls.slice(1));assert.deepEqual(calls.toSorted(),(unit==='sentence'?['Replacement first sentence.','Replacement second sentence.']:['Replacement first sentence. Replacement second sentence.']).toSorted(),'Explicit retry must reconcile the current source before sending any old text');
  assert.deepEqual(await page.locator('.lextide-translation-text').allTextContents(),(unit==='sentence'?['Replacement first sentence.','Replacement second sentence.']:['Replacement first sentence. Replacement second sentence.']).map(text=>'合成译文：'+text),'Translated DOM must follow the updated source order');
  assert.equal(await page.evaluate(async()=>!!(await __store.cacheGet(__calls[0]))),false,'Removed source must not be cached by a stale retry');
  await page.evaluate(()=>__reader.setBilingual(false));assert.equal(await page.locator('main').innerHTML(),'<p>Replacement first sentence. Replacement second sentence.</p>');assert.deepEqual(errors,[]);assert.deepEqual(network,[]);checks.push({mode,translationUnit:unit,width,status:'passed',requests:calls.length+1,liveProviderVerified:false});await page.close();continue;
 }
 await page.evaluate(mode=>__scenario=mode==='cancel-pending'?'pending':'success',mode);
 if(mode==='all')await page.locator('lextide-reader #retry-all').click();else{await page.locator('lextide-reader .panel .close').click();await page.locator('.lextide-translation button').click();}
 if(mode==='cancel-pending'){
  await page.waitForFunction(()=>typeof __resolve==='function');await page.locator('lextide-reader .bubble').click();assert.equal(await page.evaluate(()=>__pendingSignal.aborted),true);await page.evaluate(()=>__resolve('LATE_SYNTHETIC_RESULT'));await page.waitForTimeout(50);assert.equal(await page.locator('.lextide-translation').count(),0);assert.equal(await page.evaluate(()=>document.querySelector('main').innerHTML===__markup&&document.querySelector('a')===__link),true);assert.equal(await page.evaluate(async()=>!!(await __store.cacheGet(__pendingText))),false);
 }else{
  await page.waitForFunction(n=>document.querySelectorAll('.lextide-translation-text').length===n,unit==='sentence'?3:1);assert.equal(await page.evaluate(()=>__calls.length),unit==='sentence'?4:2);assert.equal(await page.locator('.lextide-translation button').count(),0);await page.evaluate(()=>__reader.setBilingual(false));assert.equal(await page.evaluate(()=>document.querySelector('main').innerHTML===__markup&&document.querySelector('a')===__link),true);
  await page.evaluate(()=>__reader.setBilingual(true));await page.waitForFunction(n=>document.querySelectorAll('.lextide-translation-text').length===n,unit==='sentence'?3:1);assert.equal(await page.evaluate(()=>__calls.length),unit==='sentence'?4:2,'Successful retry should populate the same translation cache');await page.evaluate(()=>__reader.setBilingual(false));assert.equal(await page.evaluate(()=>document.querySelector('main').innerHTML===__markup),true);
 }
 assert.deepEqual(errors,[]);assert.deepEqual(network,[],'Synthetic UI checks must send no network requests');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));checks.push({mode,translationUnit:unit,width,status:'passed',requests:await page.evaluate(()=>__calls.length),liveProviderVerified:false});await page.close();
}
return checks;
}
