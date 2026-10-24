// Real browser DOM/cache timing with synthetic transport; no provider requests.
import {build} from 'esbuild';import assert from 'node:assert/strict';
export async function runSourceGapChecks(browser){
 const code=await build({stdin:{resolveDir:process.cwd(),contents:`
import {ParagraphTranslator} from './src/translation.js';
globalThis.__calls=[];globalThis.__saved=[];globalThis.__reads=0;
globalThis.__translator=new ParagraphTranslator({root:document.querySelector('main'),interval:0,store:{cacheGet:async()=>{if(__gap!=='late-hidden'&&++__reads===1)return new Promise(resolve=>globalThis.__cacheResolve=resolve);return null;},cacheSet:async(text,value)=>__saved.push({text,value})},translate:async text=>{__calls.push(text);if(__gap==='late-hidden'&&__calls.length===1)return new Promise(resolve=>globalThis.__translationResolve=resolve);return '合成译文：'+text;}});globalThis.__start=__translator.start('bilingual',true,__unit);
`},bundle:true,format:'iife',write:false});const checks=[];
 for(const unit of ['paragraph','sentence'])for(const width of [1100,390])for(const gap of ['cache-hidden','cache-hit-hidden','cache-replaced','cache-prefixed','cache-inline-added','cache-css-hidden','cache-no-translate','cache-disclosure','late-hidden']){
  const page=await browser.newPage({viewport:{width,height:900}}),network=[],errors=[],check={unit,width,gap,status:'failed',liveProviderVerified:false};checks.push(check);page.setDefaultTimeout(5000);await page.route('**/*',route=>{network.push(route.request().url());return route.abort();});page.on('pageerror',e=>errors.push(e.message));
  try{
   await page.setContent('<main style="font:20px/1.8 system-ui;margin:32px"><details open><summary>1</summary><p>Original first sentence. Original second sentence.</p></details></main>');
   if(gap==='cache-inline-added')await page.evaluate(()=>document.querySelector('p').innerHTML='Original <em>first</em> sentence. Original second sentence.');
   await page.evaluate(({unit,gap})=>{globalThis.__originalEm=document.querySelector('em');globalThis.__unit=unit;globalThis.__gap=gap;globalThis.__originalNode=document.querySelector('p').firstChild;},{unit,gap});await page.evaluate(code.outputFiles[0].text);
   await page.waitForFunction(gap=>typeof(gap==='late-hidden'?globalThis.__translationResolve:globalThis.__cacheResolve)==='function',gap);
   await page.evaluate(gap=>{const p=document.querySelector('p');if(gap==='cache-replaced'){p.textContent='Replacement first sentence. Replacement second sentence.';globalThis.__replacementNode=p.firstChild;}else if(gap==='cache-prefixed'){globalThis.__prefixNode=document.createTextNode('Updated ');p.prepend(__prefixNode);}else if(gap==='cache-inline-added'){const span=document.createElement('span');span.textContent='updated ';p.insertBefore(span,p.querySelector('em'));}else if(gap==='cache-css-hidden')p.style.contentVisibility='hidden';else if(gap==='cache-no-translate')p.setAttribute('translate','no');else if(gap==='cache-disclosure')document.querySelector('details').open=false;else p.hidden=true;(gap==='late-hidden'?__translationResolve:__cacheResolve)(gap==='late-hidden'?'迟到合成译文':gap==='cache-hit-hidden'?'已有本地缓存译文':null);return __start;},gap);
   check.requests=await page.evaluate(()=>__calls);check.saved=await page.evaluate(()=>__saved);
   if(['cache-prefixed','cache-inline-added'].includes(gap)){
    const first=gap==='cache-prefixed'?'Updated Original first sentence.':'Original updated first sentence.';assert.deepEqual(check.requests.toSorted(),(unit==='sentence'?[first,'Original second sentence.']:[first+' Original second sentence.']).toSorted(),'Pending child-list changes must be reconciled before sending a source snapshot');assert.ok(check.saved.every(s=>!s.text.startsWith('Original first')));
   }else if(gap==='cache-replaced'){
    assert.deepEqual(check.requests.toSorted(),(unit==='sentence'?['Replacement first sentence.','Replacement second sentence.']:['Replacement first sentence. Replacement second sentence.']).toSorted(),'Cache release must not send replaced source');assert.ok(check.saved.every(s=>s.text.startsWith('Replacement')));
   }else{
    assert.equal(check.requests.length,gap==='late-hidden'?1:0,'Unreadable source must not start new requests');assert.deepEqual(check.saved,[],'Unreadable late results must not be cached');assert.equal(await page.locator('.lextide-translation').count(),0,'Unreadable late results must not remain in the DOM');
   }
   await page.evaluate(()=>__translator.stop());assert.equal(await page.locator('p').textContent(),gap==='cache-prefixed'?'Updated Original first sentence. Original second sentence.':gap==='cache-inline-added'?'Original updated first sentence. Original second sentence.':gap==='cache-replaced'?'Replacement first sentence. Replacement second sentence.':'Original first sentence. Original second sentence.');
   assert.equal(await page.locator('p').evaluate((p,gap)=>p.firstChild===(gap==='cache-prefixed'?__prefixNode:gap==='cache-replaced'?__replacementNode:__originalNode),gap),true,'Current host text-node identity must restore');
   if(gap==='cache-prefixed')assert.equal(await page.locator('p').evaluate(p=>p.contains(__originalNode)),true);if(gap==='cache-inline-added')assert.equal(await page.evaluate(()=>document.querySelector('em')===__originalEm),true);
   if(['cache-hidden','cache-hit-hidden','late-hidden'].includes(gap))assert.equal(await page.locator('p').evaluate(p=>p.hidden),true);
   if(gap==='cache-css-hidden')assert.equal(await page.locator('p').evaluate(p=>p.style.contentVisibility),'hidden');if(gap==='cache-no-translate')assert.equal(await page.locator('p').getAttribute('translate'),'no');if(gap==='cache-disclosure')assert.equal(await page.locator('details').evaluate(d=>d.open),false);
   assert.deepEqual(network,[]);assert.deepEqual(errors,[]);check.status='passed';
  }catch(error){check.error=error.message;}finally{await page.close();console.log(JSON.stringify(check));}
 }
 return checks;
}

export async function runCacheCommitChecks(browser){
 const code=await build({stdin:{resolveDir:process.cwd(),contents:`import {ParagraphTranslator} from './src/translation.js';const p=document.querySelector('p');globalThis.__original=p.firstChild;globalThis.__calls=[];globalThis.__saved=[];let changed=false;globalThis.__host=new MutationObserver(()=>{if(!changed&&document.querySelector('.lextide-translation-text')){changed=true;globalThis.__prefix=document.createTextNode('Updated ');p.prepend(__prefix);}});__host.observe(document.querySelector('main'),{subtree:true,childList:true});globalThis.__translator=new ParagraphTranslator({root:document.querySelector('main'),interval:0,store:{cacheGet:async()=>null,cacheSet:async text=>__saved.push(text)},translate:async text=>{__calls.push(text);return '合成译文：'+text;}});globalThis.__start=__translator.start('bilingual',true);`},bundle:true,format:'iife',write:false}),checks=[];
 for(const width of [1100,390]){
  const page=await browser.newPage({viewport:{width,height:900}}),check={width,status:'failed',kind:'synthetic host edit after render, before cache invocation',liveProviderVerified:false},network=[];checks.push(check);await page.route('**/*',route=>{network.push(route.request().url());return route.abort();});
  try{
   await page.setContent('<main><p>Original source sentence.</p></main>');await page.evaluate(code.outputFiles[0].text);await page.evaluate(()=>__start);check.saved=await page.evaluate(()=>__saved);check.requests=await page.evaluate(()=>__calls);
   assert.deepEqual(check.saved,['Updated Original source sentence.'],'An unstarted cache write must recheck its source');assert.deepEqual(check.requests,['Original source sentence.','Updated Original source sentence.']);assert.deepEqual(network,[]);
   await page.evaluate(()=>{__host.disconnect();__translator.stop();});assert.equal(await page.locator('p').textContent(),'Updated Original source sentence.');assert.equal(await page.locator('p').evaluate(p=>p.firstChild===__prefix&&p.contains(__original)),true);check.status='passed';
  }catch(error){check.error=error.message;}finally{await page.close();console.log(JSON.stringify(check));}
 }
 return checks;
}
