import {sourceState} from '../../scripts/build-evidence.mjs';
// Real shared-reader Selection/Range/DOM with synthetic transports, no vendors.
import {chromium} from 'playwright';import {build} from 'esbuild';import assert from 'node:assert/strict';import {mkdir,writeFile,readFile} from 'node:fs/promises';
const bundle=await build({stdin:{resolveDir:process.cwd(),contents:`
 import {mountReader} from './src/reader.js';import {createStore,DEFAULT_PREFS} from './src/storage.js';
 const data={prefs:{...DEFAULT_PREFS,mode:'original',words:true}},store=createStore({get:async k=>data[k],set:async(k,v)=>data[k]=v});
 globalThis.__calls=[];globalThis.__hold=false;globalThis.__failure=false;globalThis.__bodyFailure=false;globalThis.__released=null;globalThis.__aborted=0;
 globalThis.__engines={body:{id:'body-a',label:'Body A',cacheKey:'engine:body:a',minInterval:1},selection:{id:'selection-a',label:'Selection A',cacheKey:'engine:selection:a',minInterval:1},profiles:[]};
 globalThis.__source=document.querySelector('main').innerHTML;globalThis.__link=document.querySelector('#link');
 globalThis.__reader=mountReader({root:document.querySelector('main'),store,engines:__engines,transport:async(type,text,_online,{signal,engineKey}={})=>{
  __calls.push({type,text,engineKey});if(type==='translate'){if(__bodyFailure)throw Object.assign(Error('Synthetic body service failure'),{code:'TRANSLATION_UNAVAILABLE'});return engineKey==='engine:body:b'?'正文乙译文12.5。':'正文甲译文12.5。';}
  if(type==='selection'){signal.addEventListener('abort',()=>__aborted++,{once:true});if(__hold)return new Promise(r=>__released=r);if(__failure)throw Error('Synthetic selection service failure');return engineKey==='engine:selection:b'?'选文乙译文12.5。':'选文甲译文12.5。';}
  if(type==='context')return {senseId:null,zh:'词典语境测试'};return {word:text,lemma:text,kind:'unavailable',source:'Synthetic dictionary fixture',senses:[]};
 }});`},bundle:true,format:'iife',write:false});
await mkdir('test-results',{recursive:true});const report={startedAt:new Date().toISOString(),version:JSON.parse(await readFile('package.json','utf8')).version,...sourceState(),status:'failed',kind:'independent body/selection engines with real DOM and synthetic transport',nativeExtensionInstalled:false,liveVendorRequests:0,checks:[]};let browser;
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||'/usr/bin/chromium'});
 for(const width of [1100,390]){
  const page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setContent('<main style="max-width:720px;margin:24px auto;padding:16px;font:20px/1.8 Georgia"><p id="p1">Alpha has a value of 12.5 with a <a id="link" href="https://example.test/reference">reference</a>.</p><p id="p2">Beta also has a value of 12.5.</p><p id="long">The measured value is 12.5. This selection includes punctuation and more than four words, so it must use the separate translation action.</p></main>');await page.evaluate(bundle.outputFiles[0].text);await page.evaluate(()=>__reader.ready);
  const select=async id=>{await page.evaluate(id=>{const r=document.createRange();r.selectNodeContents(document.getElementById(id));getSelection().removeAllRanges();getSelection().addRange(r);},id);await page.locator('lextide-reader #translate-selection').waitFor({state:'visible'});};
  const waitResult=text=>page.locator('lextide-reader #selection-result').filter({hasText:text}).waitFor();
  // Engine reconfiguration restarts translation asynchronously. Wait for the
  // completed status, and verify both engine identity and actual provenance.
  const checkProgress=async(pattern,message)=>{
   const status=page.locator('lextide-reader #status');
   await status.filter({hasText:pattern}).waitFor();
   assert.match(await status.textContent(),pattern,message);
  };
  await select('long');assert.equal(await page.locator('lextide-reader #lookup-selection').isVisible(),false);assert.equal(await page.evaluate(()=>__calls.length),0);
  await page.evaluate(()=>__reader.shadow.querySelector('#translate-selection').click());assert.equal(await page.evaluate(()=>__calls.length),0,'a page-synthesized click cannot send selected text');
  await page.locator('lextide-reader #translate-selection').click();await waitResult('选文甲译文');assert.equal(await page.evaluate(()=>__calls.at(-1).type),'selection');assert.equal(await page.evaluate(()=>__calls.at(-1).engineKey),'engine:selection:a');assert.match(await page.locator('lextide-reader #selection-provider').textContent(),/Selection A/);
  await page.screenshot({path:'test-results/selection-engine-'+width+'.png',fullPage:true});assert.ok(await page.locator('lextide-reader .selection-card').evaluate(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1;}));
  await page.keyboard.press('Escape');assert.equal(await page.locator('lextide-reader .selection-card').isVisible(),false);
  // Real word/phrase action still uses its dictionary/context routes.
  await page.evaluate(()=>{const p=document.querySelector('#p1'),r=document.createRange();r.setStart(p.firstChild,0);r.setEnd(p.firstChild,5);getSelection().removeAllRanges();getSelection().addRange(r);});await page.locator('lextide-reader #lookup-selection').waitFor({state:'visible'});await page.locator('lextide-reader #lookup-selection').click();await page.locator('lextide-reader .zh').filter({hasText:'词典语境测试'}).waitFor();assert.equal(await page.evaluate(()=>__calls.at(-1).type),'context');await page.keyboard.press('Escape');
  await page.evaluate(()=>__hold=true);await select('long');await page.locator('lextide-reader #translate-selection').click();await page.waitForFunction(()=>typeof __released==='function');const before=await page.evaluate(()=>__calls.filter(c=>c.type==='translate').length);
  await page.evaluate(()=>{__engines={...__engines,selection:{id:'selection-b',label:'Selection B',cacheKey:'engine:selection:b',minInterval:1}};return __reader.configureEngines(__engines);});await page.evaluate(()=>{__hold=false;__released('迟到译文不可显示');});assert.equal(await page.locator('lextide-reader .selection-card').isVisible(),false);assert.equal(await page.evaluate(()=>__calls.filter(c=>c.type==='translate').length),before);assert.ok(await page.evaluate(()=>__aborted>0));
  await select('long');await page.locator('lextide-reader #translate-selection').click();await waitResult('选文乙译文');
  // Engine switching isolates source caches and preserves the original link.
  await page.evaluate(()=>__reader.setBilingual(true));await page.waitForFunction(()=>document.querySelectorAll('.lextide-translation-text').length===3);const firstBodyCalls=await page.evaluate(()=>__calls.filter(c=>c.type==='translate').length);assert.equal(firstBodyCalls,3);
  await checkProgress(/已翻译 3 \/ 3 段 · 0 段失败 · Body A 服务返回 3 段$/,'progress must name the selected body engine and service provenance');
  await page.evaluate(()=>{__engines={...__engines,body:{id:'body-b',label:'Body B',cacheKey:'engine:body:b',minInterval:1}};return __reader.configureEngines(__engines);});await page.waitForFunction(()=>document.querySelectorAll('[data-translation-source="Body B · 机器翻译"]').length===3);assert.equal(await page.evaluate(()=>__calls.filter(c=>c.type==='translate').length),6);
  await checkProgress(/已翻译 3 \/ 3 段 · 0 段失败 · Body B 服务返回 3 段$/,'switched body progress names the new engine');
  await page.evaluate(()=>{__engines={...__engines,body:{id:'body-a',label:'Body A',cacheKey:'engine:body:a',minInterval:1}};return __reader.configureEngines(__engines);});await page.waitForFunction(()=>document.querySelectorAll('[data-translation-source="本地缓存 · Body A 翻译"]').length===3);assert.equal(await page.evaluate(()=>__calls.filter(c=>c.type==='translate').length),6);
  await checkProgress(/已翻译 3 \/ 3 段 · 0 段失败 · 本地缓存（Body A） 3 段$/,'cached body progress retains the matching engine and cache provenance');
  await page.evaluate(()=>__reader.setTranslationUnit('sentence'));await checkProgress(/已翻译 4 句 · 已加载 4 句 · 0 句失败 · 本地缓存（Body A） 2 句 · Body A 服务返回 2 句 · 随阅读继续翻译$/,'sentence progress retains the matching engine and service provenance');
  await page.evaluate(()=>__reader.setTranslationUnit('paragraph'));
  await page.evaluate(()=>{__bodyFailure=true;__engines={...__engines,body:{id:'body-c',label:'Body C',cacheKey:'engine:body:c',minInterval:1}};return __reader.configureEngines(__engines);});
  await checkProgress(/1 段失败 · 当前引擎：Body C · 服务暂不可用/,'paused errors must name the failed engine');
  await page.evaluate(()=>{__bodyFailure=false;__engines={...__engines,body:{id:'body-a',label:'Body A',cacheKey:'engine:body:a',minInterval:1}};return __reader.configureEngines(__engines);});
  await checkProgress(/已翻译 3 \/ 3 段 · 0 段失败 · 本地缓存（Body A） 3 段$/,'returning to the prior engine uses its isolated cache');
  await page.evaluate(()=>__reader.setBilingual(false));assert.equal(await page.evaluate(()=>document.querySelector('main').innerHTML===__source&&document.querySelector('#link')===__link),true);
  await page.evaluate(()=>{__hold=true;__released=null;});await select('long');await page.locator('lextide-reader #translate-selection').click();await page.waitForFunction(()=>typeof __released==='function');await page.evaluate(()=>__reader.setWords(false));await page.evaluate(()=>{__hold=false;__released('停止后不可显示');});assert.equal(await page.locator('lextide-reader .selection-card').isVisible(),false);assert.equal(await page.locator('lextide-reader #translate-selection').isVisible(),false);
  await page.evaluate(()=>__reader.setWords(true));await page.evaluate(()=>__failure=true);await select('long');await page.locator('lextide-reader #translate-selection').click();await page.locator('lextide-reader #retry-selection').waitFor({state:'visible'});await page.evaluate(()=>__failure=false);await page.locator('lextide-reader #retry-selection').click();await waitResult('选文乙译文');
  // Crossing an editable area must not send its content as part of a selection.
  const count=await page.evaluate(()=>__calls.length);await page.evaluate(()=>{__reader.shadow.querySelector('#close-selection').click();document.querySelector('main').insertAdjacentHTML('beforeend','<p id="mixed">Public <span contenteditable="true">private editor content</span> end.</p>');const r=document.createRange();r.selectNodeContents(document.querySelector('#mixed'));getSelection().removeAllRanges();getSelection().addRange(r);});await page.waitForTimeout(40);assert.equal(await page.locator('lextide-reader #translate-selection').isVisible(),false);assert.equal(await page.evaluate(()=>__calls.length),count);
  await page.evaluate(()=>__reader.destroy());assert.deepEqual(errors,[]);report.checks.push({width,selectionExplicitOnly:true,dictionaryRetained:true,independentScopes:true,lateResultBlocked:true,cacheIsolation:true,progressEngineLabels:true,sentenceProgressEngine:true,pausedFailureEngine:true,cacheProgressEngine:true,linkIdentityRestored:true,offAndRetry:true,editableExcluded:true});await page.close();
 }
 report.status='passed';console.log(JSON.stringify(report));
}catch(error){report.error=error.stack;throw error;}finally{report.finishedAt=new Date().toISOString();await browser?.close();await writeFile('test-results/selection-engines-report.json',JSON.stringify(report,null,2));}
