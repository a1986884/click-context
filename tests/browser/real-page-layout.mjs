// Shared reader in a real browser with synthetic translation responses.
// Exercises arbitrary page DOM; not native extension installation evidence.
import {chromium} from 'playwright';
import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const compiled=await build({stdin:{resolveDir:process.cwd(),contents:`
 import {ParagraphTranslator} from './src/translation.js';import {createStore} from './src/storage.js';
 const values=new Map();const store=createStore({get:async k=>values.get(k),set:async(k,v)=>values.set(k,v)});
 globalThis.__calls=[];globalThis.__signals=new Map();globalThis.__finishes=new Map();
 globalThis.__translator=new ParagraphTranslator({root:document.body,store,interval:0,translate:(text,{signal})=>{__calls.push(text);__signals.set(text,signal);if(text==='Pending old paragraph')return new Promise(r=>__finishes.set(text,r));return Promise.resolve('中文：'+text);}});
 globalThis.__start=mode=>__translator.start(mode,true);globalThis.__stop=()=>__translator.stop();
 `},bundle:true,format:'iife',write:false});
const html=`<!doctype html><html lang="en"><head><style>body{max-width:900px;margin:20px auto;font:18px/1.6 system-ui;padding:12px}.hidden-css{display:none}.cards{display:grid;grid-template-columns:1fr 1fr;gap:12px}.cards p{border:1px solid #ccc;padding:10px}td,th{border:1px solid #ccc;padding:8px}table{width:100%;border-collapse:collapse}a{color:#166b96}</style></head><body>
<header><p>Global menu secret</p></header><aside>Sidebar text</aside><main><article>
<header><h1>Article heading</h1></header><p id="inline">Read <em>inline emphasis</em> and the <a id="link" href="#destination">original link</a>.<span hidden>HIDDEN_SECRET</span><span class="hidden-css">CSS_SECRET</span><code>CODE_SECRET</code><input value="INPUT_SECRET"></p>
<ul><li id="parent">Parent item<ul><li id="child">Nested item</li></ul>Tail explanation</li></ul>
<div id="mixed">Opening explanation<p>Nested paragraph</p>Closing explanation</div>
<table><tbody><tr><th>Term</th><th>Meaning</th></tr><tr><td id="cell">Useful <a href="#cell">cell link</a></td><td>Definition text</td></tr></tbody></table>
<div class="cards"><p id="grid-one">First card</p><p id="grid-two">Second card</p></div>
<details id="disclosure"><summary>Show details</summary><p id="closed">Deferred disclosure text</p></details>
<p id="hidden-change" style="display:none">Hidden until revealed</p><p translate="no">DO_NOT_TRANSLATE</p><form><p>PRIVATE_FORM</p></form><div id="dynamic"></div>
<p id="far" style="margin-top:1800px">Far below the viewport</p></article></main></body></html>`;
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||'/usr/bin/chromium'});
const report={kind:'ordinary browser arbitrary-page compatibility fixture',nativeExtensionInstalled:false,status:'failed',checks:[]};
await mkdir('test-results',{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:1100,height:1300}}),errors=[];page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));await page.setContent(html);await page.evaluate(compiled.outputFiles[0].text);
 await page.evaluate(()=>{globalThis.__link=document.querySelector('#link');globalThis.__cell=document.querySelector('#cell');globalThis.__inline=document.querySelector('#inline');__link.addEventListener('click',()=>globalThis.__linkClicks=(globalThis.__linkClicks||0)+1);});
 console.log('Starting initial scan');await page.evaluate(()=>__start('bilingual'));console.log('Initial scan finished');
 const calls=()=>page.evaluate(()=>__calls);
 const sent=await calls();assert.ok(sent.includes('Article heading'));assert.ok(sent.includes('Parent item'));assert.ok(sent.includes('Nested item'));assert.ok(sent.includes('Tail explanation'));assert.ok(sent.includes('Read inline emphasis and the original link.'));
 assert.ok(!sent.some(t=>/SECRET|PRIVATE|DO_NOT|Global menu|Sidebar|Deferred disclosure|Far below|Hidden until/.test(t)));
 assert.equal(await page.locator('#cell > .lextide-translation').count(),1);assert.equal(await page.locator('tr > .lextide-translation').count(),0);
 assert.equal(await page.locator('.cards > p').count(),2);assert.equal(await page.locator('.cards > .lextide-translation').count(),0);assert.equal(await page.locator('#grid-one > .lextide-translation').count(),1);
 await page.locator('#link').click();assert.equal(await page.evaluate(()=>__link===document.querySelector('#link')&&__linkClicks===1),true);
 console.log('Passed stage',report.checks.length+1);report.checks.push('nested and mixed prose, article header, inline links, tables and grid layout preserved; hidden/private/control text excluded');
 await page.locator('#disclosure').scrollIntoViewIfNeeded();await page.evaluate(()=>{document.querySelector('#disclosure').open=true;document.querySelector('#hidden-change').style.display='block';});
 await page.locator('#hidden-change').scrollIntoViewIfNeeded();await page.waitForFunction(()=>__calls.includes('Deferred disclosure text')&&__calls.includes('Hidden until revealed')).catch(async error=>{console.log(await page.evaluate(()=>({calls:__calls,records:__translator.records.map(r=>({text:r.text,eligible:r.eligible,state:r.state,rect:r.p.getBoundingClientRect().top}))})));throw error;});
 console.log('Passed stage',report.checks.length+1);report.checks.push('opening details and revealing CSS-hidden content translate on demand');
 await page.evaluate(()=>{const p=document.createElement('p');p.id='pending';p.textContent='Pending old paragraph';document.querySelector('#dynamic').append(p);});
 await page.locator('#pending').scrollIntoViewIfNeeded();await page.waitForFunction(()=>__calls.includes('Pending old paragraph'));
 await page.evaluate(()=>{document.querySelector('#pending').textContent='Replaced paragraph';});
 await page.waitForFunction(()=>__calls.includes('Replaced paragraph')&&__signals.get('Pending old paragraph').aborted);
 await page.evaluate(()=>__finishes.get('Pending old paragraph')('STALE_TRANSLATION'));assert.equal(await page.getByText('STALE_TRANSLATION',{exact:true}).count(),0);
 await page.evaluate(()=>document.querySelector('#pending').remove());await page.waitForFunction(()=>!Array.from(document.querySelectorAll('.lextide-translation')).some(n=>n.textContent.includes('Replaced paragraph')));
 const before=await calls();await page.evaluate(()=>document.querySelector('#mixed').classList.add('new-style'));await page.waitForTimeout(230);assert.deepEqual(await calls(),before);
 console.log('Passed stage',report.checks.length+1);report.checks.push('dynamic replacement aborts old request without blocking queue; removed paragraphs clean up; unchanged text does not repeat requests');
 await page.locator('#far').scrollIntoViewIfNeeded();await page.waitForFunction(()=>__calls.includes('Far below the viewport'));console.log('Passed stage',report.checks.length+1);report.checks.push('offscreen paragraphs wait until scrolling');
 await page.evaluate(()=>__stop());assert.equal(await page.locator('.lextide-translation').count(),0);assert.ok(await page.evaluate(()=>__cell===document.querySelector('#cell')&&__inline===document.querySelector('#inline')&&__link===document.querySelector('#link')));
 await page.locator('#inline').scrollIntoViewIfNeeded();await page.evaluate(()=>__start('translated'));assert.equal(await page.locator('#inline').isVisible(),true);await page.evaluate(()=>__stop());assert.equal(await page.locator('#inline').getAttribute('hidden'),null);
 await page.setViewportSize({width:390,height:844});await page.locator('#cell').scrollIntoViewIfNeeded();await page.evaluate(()=>__start('bilingual'));await page.screenshot({path:'test-results/real-page-layout-mobile.png'});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.evaluate(()=>__stop());assert.deepEqual(errors,[]);console.log('Passed stage',report.checks.length+1);report.checks.push('stop restores original nodes; translated mode preserves interactive content; 390px layout fits; no uncaught errors');
 const anchored=await browser.newPage({viewport:{width:1000,height:800}});await anchored.setContent('<html><body style="margin:0;font:18px/1.7 system-ui"><main><p id="above" style="height:500px;margin:0">Pending old paragraph</p><p id="reading" style="height:350px;margin:0">Current reading paragraph.</p><p style="height:1200px">Later content.</p></main></body></html>');await anchored.evaluate(compiled.outputFiles[0].text);await anchored.evaluate(()=>{void __start('bilingual');});await anchored.waitForFunction(()=>__finishes.has('Pending old paragraph'));await anchored.locator('#reading').scrollIntoViewIfNeeded();await anchored.evaluate(()=>document.querySelector('#reading').scrollIntoView({block:'center'}));const readingTop=await anchored.locator('#reading').evaluate(e=>e.getBoundingClientRect().top);await anchored.evaluate(()=>__finishes.get('Pending old paragraph')('较长的翻译内容。'.repeat(180)));await anchored.waitForFunction(()=>document.querySelector('#above').nextElementSibling?.textContent.includes('较长的'));const shifted=await anchored.locator('#reading').evaluate(e=>e.getBoundingClientRect().top);assert.ok(Math.abs(readingTop-shifted)<2,'reading position must not move when a translation above it grows');await anchored.evaluate(()=>__stop());await anchored.close();report.checks.push('source reading position stays stable when an earlier pending translation grows');
 report.status='passed';
}finally{await browser.close();await writeFile('test-results/real-page-layout-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
