import {chromium} from 'playwright';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const code=await readFile('build/userscript/click-context.user.js','utf8'),checks=[];
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||'/usr/bin/chromium'});
await mkdir('test-results',{recursive:true});
try{for(const width of [390,1280]){
 const page=await browser.newPage({viewport:{width,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://article.example/**',r=>r.fulfill({contentType:'text/html',body:'<meta name="viewport" content="width=device-width,initial-scale=1"><main><p id="sentence">The river is quiet.</p></main>'}));await page.goto('https://article.example/');
 await page.evaluate(()=>{
  const attach=Element.prototype.attachShadow;Element.prototype.attachShadow=function(o){const root=attach.call(this,o);if(this.localName==='click-context-engines')window.__engine=root;return root;};
  window.__values={};window.__calls=[];window.__menus={};window.GM_info={scriptHandler:'Other',version:'1'};
  window.GM_getValue=(k,d)=>__values[k]??d;window.GM_setValue=(k,v)=>__values[k]=structuredClone(v);window.GM_registerMenuCommand=(k,fn)=>__menus[k]=fn;
  window.GM_xmlhttpRequest=d=>{__calls.push({url:d.url,headers:d.headers,data:d.data,anonymous:d.anonymous});const response=d.url.endsWith('/translator')?'<script>IG:"TEST123"; var params_AbusePreventionHelper=[123456,"public-token",3600000];</script><div data-iid="translator.5023"></div>':d.url.includes('bing.com')?JSON.stringify([{translations:[{to:'zh-Hans',text:'微软：河流很安静。'}]}]):JSON.stringify([[['谷歌：河流很安静。','The river is quiet.']]]);queueMicrotask(()=>d.onload({status:200,response}));return {abort(){}};};
  window.confirm=()=>{throw Error('Free engine selection must not need API confirmation');};
 });
 await page.evaluate(code);await page.locator('lextide-reader .panel').waitFor();await page.locator('lextide-reader #engine-settings').click();await page.waitForFunction(()=>!__engine.querySelector('#controls').disabled);
 assert.deepEqual(await page.evaluate(()=>['body','context'].map(id=>[...__engine.querySelector('#'+id).options].map(o=>o.value))),[['builtin','google-free','microsoft-free'],['builtin']]);
 assert.equal(await page.evaluate(()=>getComputedStyle(__engine.querySelector('#save')).backgroundColor),'rgb(255, 228, 92)');
 await page.evaluate(()=>{for(const [id,value]of [['body','google-free']]){const el=__engine.querySelector('#'+id);el.value=value;el.dispatchEvent(new Event('change'));}__engine.querySelector('#form').requestSubmit();});await page.waitForFunction(()=>__engine.querySelector('#status').textContent.includes('已保存'));
 assert.equal(await page.evaluate(()=>__calls.length),0);assert.equal(await page.evaluate(()=>__values['click-context:v1:engines'].profiles.length),0);
 await page.evaluate(()=>__engine.querySelector('#close').click());await page.evaluate(()=>__menus['语境精读：阅读设置']());await page.locator('lextide-reader #words').check();await page.locator('lextide-reader #bilingual-enabled').check();await page.locator('lextide-reader .panel .close').click();await page.waitForFunction(()=>document.querySelector('main').textContent.includes('谷歌：'));
 await page.evaluate(()=>__menus['语境精读：引擎 / 我的 API']());await page.waitForFunction(()=>!__engine.querySelector('#controls').disabled);await page.evaluate(()=>{const el=__engine.querySelector('#body');el.value='microsoft-free';el.dispatchEvent(new Event('change'));__engine.querySelector('#form').requestSubmit();});await page.waitForFunction(()=>__engine.querySelector('#status').textContent.includes('已保存'));await page.evaluate(()=>__engine.querySelector('#close').click());
 await page.evaluate(()=>{const range=document.createRange();range.selectNodeContents(document.querySelector('#sentence'));getSelection().removeAllRanges();getSelection().addRange(range);document.dispatchEvent(new Event('selectionchange'));});await page.locator('lextide-reader #translate-selection').click();await page.waitForFunction(()=>document.querySelector('lextide-reader').shadowRoot.querySelector('#selection-result').textContent.includes('微软：'));
 const calls=await page.evaluate(()=>__calls);assert.ok(calls.some(c=>c.url.includes('translate.googleapis.com')));assert.ok(calls.some(c=>c.url.includes('/ttranslatev3?')));assert.ok(calls.every(c=>c.anonymous&&!c.headers?.Authorization&&!c.headers?.['x-goog-api-key']));
 await page.evaluate(()=>__menus['语境精读：引擎 / 我的 API']());await page.waitForFunction(()=>!__engine.querySelector('#controls').disabled);assert.equal(await page.evaluate(()=>__engine.querySelector('#body').value),'microsoft-free');assert.equal(await page.evaluate(()=>__values['click-context:v1:engines'].selection),'microsoft-free');
 const bounds=await page.evaluate(()=>{const r=__engine.querySelector('.dialog').getBoundingClientRect();return {left:r.left,right:r.right,width:innerWidth};});assert.ok(bounds.left>=0&&bounds.right<=bounds.width);
 await page.screenshot({path:'test-results/userscript-web-engines-'+width+'.png'});await page.emulateMedia({colorScheme:'dark'});assert.equal(await page.evaluate(()=>getComputedStyle(__engine.querySelector('.dialog')).backgroundColor),'rgb(30, 30, 34)');assert.deepEqual(errors,[]);checks.push({width,sharedTranslation:true,noKeys:true,saved:true,theme:true});await page.close();
}console.log(JSON.stringify({status:'passed',checks}));await writeFile('test-results/userscript-web-engines.json',JSON.stringify({status:'passed',checks},null,2));}finally{await browser.close();}
