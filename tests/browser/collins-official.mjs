// Real cloud-browser component test. Runs in a normal Collins page, NOT an installed extension.
// Does not exercise MV3 messaging, host permissions, worker lifecycle or cross-origin fetch.
import {chromium} from 'playwright';
import {build} from 'esbuild';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const result=await build({stdin:{resolveDir:process.cwd(),contents:`
 import {lookupCollins} from './src/collins.js';
 import {cacheWordLookup} from './src/dictionary-cache.js';
 import {mountReader} from './src/reader.js';
 import {createStore} from './src/storage.js';
 const values=new Map();const store=createStore({get:async key=>values.get(key),set:async(key,value)=>{values.set(key,structuredClone(value));}});
 const section=document.createElement('main');section.id='cloud-reader-test';
 section.style.cssText='position:fixed;inset:0;z-index:2147483645;background:#f8f7f2;color:#213b52;padding:28px;overflow:auto;font:20px/1.8 sans-serif';
 section.innerHTML='<h1>Lextide · Collins 官网直连云端测试</h1><p>普通浏览器组件测试 · 非插件安装验收</p><p id="cloud-ocean">Scientists explore the <strong>ocean</strong>.</p><p id="cloud-study">Researchers <strong>study</strong> language.</p><p id="cloud-listed">Several items are <strong>listed</strong>.</p><p id="cloud-beautiful">The view is <strong>beautiful</strong>.</p>';
 document.body.append(section);const requests=[],lookups=[];const fetcher=async(url,options)=>{const at=performance.now();const r=await fetch(url,options);requests.push({url,status:r.status,headersMs:performance.now()-at,credentials:options.credentials});return r;};
 const lookup=cacheWordLookup(lookupCollins);
 const reader=mountReader({root:section,store,dictionaryNotice:'Collins 官网',transport:async(type,word,online,options)=>{if(type!=='lookup')throw Error('This test only queries words');const at=performance.now(),before=requests.length;try{const entry=await lookup(word,{online,...options,fetcher,useSession:${process.env.COLLINS_SESSION==='1'}});lookups.push({word,providerMs:performance.now()-at,requests:requests.length-before,zh:entry.zh,headword:entry.word,morphology:entry.morphology,definitions:entry.definitions,source:entry.source});return entry;}catch(error){lookups.push({word,error:error.message,code:error.code,requests:requests.length-before});throw error;}}});
 globalThis.__lextideCloudTest={reader,requests,lookups,store};
 `},bundle:true,format:'iife',platform:'browser',target:'chrome130',write:false});
const report={kind:'real Chromium normal-page component test',nativeExtensionInstalled:false,sessionModeRequested:process.env.COLLINS_SESSION==='1',limitations:['Same-origin Collins page; does not prove extension cross-origin access','No MV3 messaging, toolbar host permissions or service-worker lifecycle tested'],fixture:false,sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceWorkingTreeDirty:!!execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),checks:[],status:'failed'};
let browser;
await mkdir('test-results',{recursive:true});
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||'/usr/bin/chromium'});
 report.browserVersion=browser.version();const context=await browser.newContext({viewport:{width:1280,height:800}});const page=await context.newPage();page.setDefaultTimeout(20000);
 const response=await page.goto('https://www.collinsdictionary.com/dictionary/english-chinese/hello',{waitUntil:'domcontentloaded',timeout:30000});assert.equal(response.status(),200);await page.locator('.dictionary.biling .orth').first().waitFor({state:'attached'});
 // Evaluating test-owned modules in an ordinary page does not install/load an extension.
 await page.evaluate(result.outputFiles[0].text);await page.evaluate(()=>globalThis.__lextideCloudTest.reader.ready);
 assert.equal(await page.evaluate(()=>globalThis.__lextideCloudTest.requests.length),0);
 async function clickWord(word){
  await page.evaluate(()=>{const state=globalThis.__lextideCloudTest;state.clickStart=null;document.querySelector('#cloud-reader-test').addEventListener('click',()=>{state.clickStart=performance.now();},{once:true,capture:true});});
  const before=await page.evaluate(()=>globalThis.__lextideCloudTest.lookups.length);
  await page.locator('#cloud-'+word+' strong').click();
  await page.waitForFunction(before=>globalThis.__lextideCloudTest.lookups.length>before,before);
  const data=await page.evaluate(()=>{const s=globalThis.__lextideCloudTest;return {lookup:s.lookups.at(-1),renderedZh:s.reader.shadow.querySelector('.zh').textContent,definitions:s.reader.shadow.querySelector('.defs').textContent,source:s.reader.shadow.querySelector('.source').textContent};});
  assert.ok(!data.lookup.error,JSON.stringify(data));assert.match(data.renderedZh,/[\u3400-\u9fff]/);assert.match(data.source,/Collins 官网词条摘录/);assert.ok(data.definitions.trim());
  data.clickToPaintMs=await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(performance.now()-globalThis.__lextideCloudTest.clickStart)))));
  report.checks.push(data);return data;
 }
 for(const word of ['ocean','study','beautiful','listed']){const data=await clickWord(word);assert.equal(data.lookup.requests,2);if(word==='listed'){assert.equal(data.lookup.headword,'list');assert.match(data.lookup.morphology,/listed.*list/);}await page.keyboard.press('Escape');}
 const repeated=await clickWord('ocean');assert.equal(repeated.lookup.requests,0);
 await page.locator('lextide-reader #save').click();await page.locator('lextide-reader #save').filter({hasText:'已收藏'}).waitFor();assert.equal(await page.evaluate(async()=>(await globalThis.__lextideCloudTest.store.words())[0].lemma),'ocean');
 await page.screenshot({path:'test-results/official-browser-desktop.png'});
 await page.setViewportSize({width:390,height:844});await page.keyboard.press('Escape');await clickWord('ocean');const rect=await page.locator('lextide-reader .dict').boundingBox();assert.ok(rect.x>=0&&rect.y>=0&&rect.x+rect.width<=391&&rect.y+rect.height<=845);await page.screenshot({path:'test-results/official-browser-mobile.png'});
 report.requests=await page.evaluate(()=>globalThis.__lextideCloudTest.requests);assert.ok(report.requests.every(r=>new URL(r.url).hostname==='www.collinsdictionary.com'&&r.status===200&&r.credentials===(process.env.COLLINS_SESSION==='1'?'include':'omit')));
 report.status='passed';console.log(JSON.stringify(report));
}catch(error){report.failure=error.stack;console.error(error);process.exitCode=1;}
finally{await browser?.close();await writeFile(process.env.COLLINS_SESSION==='1'?'test-results/official-browser-session-report.json':'test-results/official-browser-report.json',JSON.stringify(report,null,2));}
