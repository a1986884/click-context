// Native CSS visibility and the production translator; synthetic translations.
import {chromium} from 'playwright';
import {build} from 'esbuild';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const code=await build({stdin:{resolveDir:process.cwd(),contents:`
 import {ParagraphTranslator} from './src/translation.js';
 import {createStore} from './src/storage.js';
 const data={},store=createStore({get:async k=>data[k],set:async(k,v)=>data[k]=structuredClone(v)});
 globalThis.__calls=[];globalThis.__hold=false;
 globalThis.__translator=new ParagraphTranslator({root:globalThis.__useBody?document.body:document.querySelector('main'),store,interval:0,translate:(text,{signal})=>{
  const call={text,signal};__calls.push(call);
  return __hold?new Promise(resolve=>call.resolve=resolve):Promise.resolve('可见正文测试译文');
 }});
`},bundle:true,format:'iife',write:false});
await mkdir('test-results',{recursive:true});
const report={kind:'native content-visibility translation regression',status:'failed',nativeExtensionInstalled:false,modes:[]};
let browser;
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||'/usr/bin/chromium'});
 for(const mode of ['paragraph','sentence']){
  const page=await browser.newPage({viewport:{width:1000,height:800}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.setContent('<main style="font:20px/1.8 Georgia;padding:30px"><p id="visible">The ocean is blue.<span style="content-visibility:hidden"> Unshown inline secret.</span></p><section id="hidden" style="content-visibility: hidden;"><p id="hidden-p">The hidden research remains unpublished.</p></section></main>');
  const original=await page.locator('main').innerHTML();
  await page.evaluate(code.outputFiles[0].text);
  await page.evaluate(mode=>__translator.start('bilingual',true,mode),mode);
  assert.deepEqual(await page.evaluate(()=>__calls.map(c=>c.text)),['The ocean is blue.'],'hidden content must not be sent for translation');
  assert.equal(await page.locator('#hidden .lextide-translation').count(),0);
  await page.evaluate(()=>{__hold=true;document.querySelector('#hidden').style.contentVisibility='visible';});
  await page.waitForFunction(()=>__calls.length===2);
  assert.equal(await page.evaluate(()=>__calls[1].text),'The hidden research remains unpublished.');
  await page.evaluate(()=>document.querySelector('#hidden').style.contentVisibility='hidden');
  await page.waitForFunction(()=>__calls[1].signal.aborted);
  await page.evaluate(()=>__calls[1].resolve('迟到译文不得显示'));
  await page.waitForFunction(()=>!document.querySelector('#hidden .lextide-translation'));
  await page.evaluate(()=>document.querySelector('#hidden').style.contentVisibility='visible');
  await page.waitForFunction(()=>__calls.length===3);
  await page.evaluate(()=>__calls[2].resolve('重新展开后的译文'));
  await page.waitForFunction(()=>document.querySelector('#hidden .lextide-translation')?.textContent==='重新展开后的译文');
  await page.evaluate(()=>{__translator.stop();document.querySelector('#hidden').style.contentVisibility='hidden';});
  assert.equal(await page.locator('main').innerHTML(),original);
  assert.deepEqual(errors,[]);
  report.modes.push({mode,status:'passed'});await page.close();
 }
 for(const mode of ['paragraph','sentence']){
  const page=await browser.newPage({viewport:{width:1000,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setContent('<div id="cached" style="content-visibility: hidden;"><main><p>Previously hidden cached article.</p></main></div><div id="live" style="display: block;"><p>Visible fallback research paragraph.</p></div>');
  const original=await page.locator('body').innerHTML();await page.evaluate(()=>globalThis.__useBody=true);await page.evaluate(code.outputFiles[0].text);await page.evaluate(mode=>__translator.start('bilingual',true,mode),mode);
  assert.deepEqual(await page.evaluate(()=>__calls.map(c=>c.text)),['Visible fallback research paragraph.']);
  await page.evaluate(()=>{document.querySelector('#cached').style.contentVisibility='visible';});
  await page.waitForFunction(()=>__translator.records.length===1&&__translator.records[0].text==='Previously hidden cached article.'&&__translator.records[0].state==='done',null,{timeout:5000});
  assert.equal(await page.locator('#live .lextide-translation').count(),0);
  await page.evaluate(()=>{document.querySelector('#cached').style.contentVisibility='hidden';});
  await page.waitForFunction(()=>__translator.records.length===1&&__translator.records[0].text==='Visible fallback research paragraph.'&&__translator.records[0].state==='done');
  assert.equal(await page.locator('#cached .lextide-translation').count(),0);assert.equal(await page.evaluate(()=>__calls.length),2);
  await page.evaluate(()=>__translator.stop());assert.equal(await page.locator('body').innerHTML(),original);assert.deepEqual(errors,[]);report.modes.push({mode,scope:'body with hidden main and visible fallback',status:'passed'});await page.close();
 }
 report.status='passed';console.log(JSON.stringify(report));
}catch(error){report.error=error.stack;throw error;}
finally{await browser?.close();await writeFile('test-results/translation-visibility-report.json',JSON.stringify(report,null,2));}
