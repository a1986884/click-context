// Native CSS media queries; the real translator with controlled provider replies.
import {chromium} from 'playwright';import {build} from 'esbuild';import assert from 'node:assert/strict';import {mkdir,writeFile} from 'node:fs/promises';
const code=await build({stdin:{resolveDir:process.cwd(),contents:`
 import {ParagraphTranslator} from './src/translation.js';import {createStore} from './src/storage.js';
 const data={};globalThis.__store=createStore({get:async k=>data[k],set:async(k,v)=>data[k]=v});globalThis.__calls=[];globalThis.__hold=false;
 globalThis.__translator=new ParagraphTranslator({root:document.querySelector('main'),store:__store,interval:0,translate:(text,{signal})=>{const call={text,signal};__calls.push(call);return __hold?new Promise(resolve=>call.resolve=resolve):Promise.resolve('响应式正文测试译文');}});
`},bundle:true,format:'iife',write:false});
await mkdir('test-results',{recursive:true});const report={kind:'responsive CSS translation reconciliation',status:'failed',nativeExtensionInstalled:false,modes:[]};let browser;
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||'/usr/bin/chromium'});
 for(const mode of ['paragraph','sentence']){
  const page=await browser.newPage({viewport:{width:1000,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setContent('<style>@media(max-width:600px){#wide{display:none}}@media(min-width:601px){#narrow{display:none}}</style><main style="padding:30px;font:20px/1.9 Georgia"><p id="wide">Wide screen research paragraph.</p><p id="narrow">Narrow screen research paragraph.</p></main>');
  const original=await page.locator('main').innerHTML();await page.evaluate(code.outputFiles[0].text);await page.evaluate(mode=>__translator.start('bilingual',true,mode),mode);
  assert.deepEqual(await page.evaluate(()=>__calls.map(c=>c.text)),['Wide screen research paragraph.']);
  await page.setViewportSize({width:390,height:844});
  await page.waitForFunction(()=>__translator.records.length===1&&__translator.records[0].text==='Narrow screen research paragraph.'&&__translator.records[0].state==='done',null,{timeout:5000});
  assert.equal(await page.locator('#wide .lextide-translation,#wide + .lextide-translation').count(),0);
  assert.equal(await page.locator('.lextide-translation-text').count(),1);assert.equal(await page.locator('.lextide-translation-text').isVisible(),true);
  await page.evaluate(()=>{__hold=true;document.querySelector('#wide').textContent='Updated wide screen research paragraph.';});
  await page.setViewportSize({width:1000,height:800});await page.waitForFunction(()=>__calls.length===3);
  await page.setViewportSize({width:390,height:844});await page.waitForFunction(()=>__calls[2].signal.aborted);
  await page.evaluate(()=>__calls[2].resolve('迟到译文不得显示'));await page.waitForFunction(()=>__translator.records.length===1&&__translator.records[0].state==='done');
  assert.equal(await page.locator('.lextide-translation-text').count(),1);assert.equal(await page.evaluate(()=>__calls.length),3);assert.equal(await page.evaluate(()=>__store.cacheGet('Updated wide screen research paragraph.')),null);
  await page.evaluate(()=>__translator.stop());await page.setViewportSize({width:1000,height:800});await page.evaluate(()=>new Promise(r=>setTimeout(r,180)));
  assert.equal(await page.evaluate(()=>__calls.length),3);assert.equal(await page.locator('.lextide-translation').count(),0);assert.equal(await page.locator('main').innerHTML(),original.replace('Wide screen research paragraph.','Updated wide screen research paragraph.'));assert.deepEqual(errors,[]);
  report.modes.push({mode,status:'passed'});await page.close();
 }
 report.status='passed';console.log(JSON.stringify(report));
}catch(error){report.error=error.stack;throw error;}finally{await browser?.close();await writeFile('test-results/responsive-translation-report.json',JSON.stringify(report,null,2));}
