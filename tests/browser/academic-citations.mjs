// Native DOM citation links, shared sentence translation and lookup context.
import {chromium} from 'playwright';import {build} from 'esbuild';import assert from 'node:assert/strict';import {mkdir,writeFile} from 'node:fs/promises';
const code=await build({stdin:{resolveDir:process.cwd(),contents:`
 import {cleanContext} from './src/context-meaning.js';import {mountReader} from './src/reader.js';import {ParagraphTranslator} from './src/translation.js';import {createStore} from './src/storage.js';import {selectedContext} from './src/selection-context.js';
 const data={},store=createStore({get:async k=>data[k],set:async(k,v)=>data[k]=v});globalThis.__calls=[];
 globalThis.__translator=new ParagraphTranslator({root:document.querySelector('main'),store,interval:0,translate:async text=>{__calls.push(text);return '逐句对照测试译文';}});
 globalThis.__contexts=[];globalThis.__startReader=()=>{globalThis.__reader=mountReader({root:document.querySelector('main'),store,transport:async(type,word,_online,options)=>{if(type==='context'){__contexts.push(cleanContext(options.context));return {senseId:null,zh:'语境测试'};}return {word,lemma:word,kind:'unavailable',senses:[]};}});return __reader.ready;};
 globalThis.__numericContext=()=>{const node=document.querySelector('#numeric-word').firstChild,range=document.createRange();range.selectNodeContents(node);return selectedContext(range,'bank');};
 globalThis.__context=()=>{const walker=document.createTreeWalker(document.querySelector('#paper'),NodeFilter.SHOW_TEXT);let node;while(node=walker.nextNode())if(node.textContent.includes('Third')){const range=document.createRange(),at=node.textContent.indexOf('Third');range.setStart(node,at);range.setEnd(node,at+5);return selectedContext(range,'Third');}};
`},bundle:true,format:'iife',write:false});
await mkdir('test-results',{recursive:true});const report={kind:'academic citation offsets and intact links',status:'failed',nativeExtensionInstalled:false,widths:[]};let browser;
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||'/usr/bin/chromium'});
 for(const width of [1280,390]){
  const page=await browser.newPage({viewport:{width,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setContent('<main style="max-width:680px;margin:30px auto;padding:16px;font:20px/1.9 Georgia"><p id="paper">First finding.<sup><a id="reference" href="#ref1">[1]</a></sup> Second finding.¹ Third finding.</p><p id="numeric">An earlier result was stable.<sup><a id="numeric-reference" href="#ref2">1,2</a></sup> The <em id="numeric-word">bank</em> held 3.14 units.</p></main>');
  await page.evaluate(()=>{globalThis.__reference=document.querySelector('#reference');globalThis.__first=document.querySelector('#paper').firstChild;globalThis.__linkClicks=0;__reference.addEventListener('click',()=>__linkClicks++);});
  const original=await page.locator('main').innerHTML();await page.evaluate(code.outputFiles[0].text);await page.evaluate(()=>__translator.start('bilingual',true,'sentence'));
  const expected=['First finding.[1]','Second finding.¹','Third finding.','An earlier result was stable.1,2','The bank held 3.14 units.'];assert.deepEqual(await page.evaluate(()=>__translator.records.map(r=>r.text)),expected);assert.deepEqual((await page.evaluate(()=>__calls)).sort(),[...expected].sort());
  assert.equal(await page.locator('#paper [data-translation-unit=sentence]').count(),3);assert.equal(await page.locator('a .lextide-translation,sup .lextide-translation').count(),0);
  assert.deepEqual(await page.evaluate(()=>__context()),{sentence:'Third finding.',offset:0});assert.deepEqual(await page.evaluate(()=>__numericContext()),{sentence:'The bank held 3.14 units.',offset:4});
  assert.equal(await page.locator('#numeric [data-translation-unit=sentence]').count(),2);await page.locator('#numeric-reference').click();assert.equal(await page.evaluate(()=>location.hash),'#ref2');
  await page.locator('#reference').click();assert.equal(await page.evaluate(()=>__linkClicks),1);assert.equal(await page.evaluate(()=>location.hash),'#ref1');
  await page.evaluate(()=>__translator.stop());assert.equal(await page.locator('main').innerHTML(),original);assert.equal(await page.evaluate(()=>__reference===document.querySelector('#reference')&&__first===document.querySelector('#paper').firstChild),true);await page.evaluate(()=>__startReader());await page.locator('#numeric-word').click();await page.waitForFunction(()=>__contexts.length===1);const sent=await page.evaluate(()=>__contexts[0]);assert.equal(sent.sentence,'The bank held 3.14 units.');assert.equal(sent.sentence.slice(sent.offset,sent.offset+4),'bank');await page.evaluate(()=>__reader.destroy());assert.equal(await page.locator('main').innerHTML(),original);assert.deepEqual(errors,[]);
  report.widths.push({width,status:'passed'});await page.close();
 }
 report.status='passed';console.log(JSON.stringify(report));
}catch(error){report.error=error.stack;throw error;}finally{await browser?.close();await writeFile('test-results/academic-citations-report.json',JSON.stringify(report,null,2));}
