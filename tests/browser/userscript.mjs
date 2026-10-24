import {USERSCRIPT_VERSION} from '../../userscript/version.js';
import {createHash} from 'node:crypto';
// Actual generated userscript, simulated privileged GM APIs. No manager installed.
import {chromium} from 'playwright';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const code=await readFile('build/userscript/click-context.user.js','utf8');
const html=`<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font:20px/1.8 Georgia;margin:28px}main{max-width:700px;margin:auto}</style><body><main><h1>Reading beside the river</h1><p id="original">They sat on the <strong id="word">bank</strong> beside the river.</p><p id="other">The morning was quiet and the water moved slowly.</p><p><a href="https://article.example/next">Continue reading</a></p></main></body></html>`;
const dictionary=`<div id="authTrans"><h3>柯林斯英汉双解大词典</h3><div id="collinsResult"><h4><span class="title">bank</span></h4><ul><li><div class="collinsMajorTrans"><p><span class="additional">N-COUNT</span>A bank is an institution that holds money. 银行</p></div></li><li><div class="collinsMajorTrans"><p><span class="additional">N-COUNT</span>A bank is the edge of a river. 岸；河岸</p></div></li></ul></div></div>`;
await mkdir('test-results',{recursive:true});
assert.equal(code.match(/@version\s+(\S+)/)?.[1],USERSCRIPT_VERSION,'generated script version must match the current source');
const report={version:USERSCRIPT_VERSION,scriptSHA256:createHash('sha256').update(code).digest('hex'),kind:'ordinary browser, generated userscript with simulated GM APIs and dictionary/AI fixtures',tampermonkeyInstalled:false,iPhoneTested:false,status:'failed',checks:[]};
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||'/usr/bin/chromium'});
try{
 for(const api of ['legacy','modern']){
  const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://article.example/**',r=>r.fulfill({contentType:'text/html',body:html}));await page.goto('https://article.example/');
  await page.evaluate(({api,dictionary})=>{
   window.__requests=[];window.__values={};window.__menus={};window.__original=document.querySelector('#original');window.__originalHTML=document.querySelector('main').innerHTML;
   const get=(k,d)=>__values[k]??d,set=(k,v)=>{__values[k]=structuredClone(v);},menu=(name,fn)=>__menus[name]=fn;
   const request=d=>{__requests.push({url:d.url,body:d.data,anonymous:d.anonymous});const timer=setTimeout(()=>{
    const input=d.data?JSON.parse(d.data):null;
    const body=d.url.includes('dict.youdao.com')?dictionary:JSON.stringify({ok:true,data:d.url.endsWith('/meaning')?{senseId:'collins-2',zh:'岸；河岸'}:{text:input.text.includes('morning')?'清晨很安静，河水缓缓流动。':'他们坐在河边的岸上。',version:input.translationRevision}});
    d.onload({status:200,finalUrl:d.url,response:new TextEncoder().encode(body).buffer});
   },20);return {abort(){clearTimeout(timer);d.onabort();}};};
   if(api==='legacy')Object.assign(window,{GM_getValue:get,GM_setValue:set,GM_xmlhttpRequest:request,GM_registerMenuCommand:menu});
   else window.GM={getValue:async(...args)=>get(...args),setValue:async(...args)=>set(...args),xmlHttpRequest:request,registerMenuCommand:menu};
  },{api,dictionary});
  await page.evaluate(code);const panel=page.locator('lextide-reader .panel');await panel.waitFor();
  assert.equal(await page.locator('lextide-reader #words').isChecked(),false);assert.equal(await page.evaluate(()=>__requests.length),0);
  assert.match(await panel.textContent(),/API 配置保存在脚本管理器/);report.checks.push(api+': starts disabled, no initial requests and disclosure shown');
  await page.locator('lextide-reader #words').check();await page.locator('lextide-reader .panel .close').click();await page.locator('#word').tap();
  await page.waitForFunction(()=>document.querySelector('lextide-reader').shadowRoot.querySelector('.zh').textContent==='岸；河岸');
  assert.equal(await page.locator('lextide-reader #sense-choice').inputValue(),'collins-2');
  const requests=await page.evaluate(()=>__requests);assert.equal(requests.length,2);assert.ok(requests.every(r=>r.anonymous));assert.match(JSON.parse(requests[1].body).sentence,/They sat on the bank/);
  await page.locator('lextide-reader #save').click();await page.waitForFunction(()=>Object.values(__values).some(x=>Array.isArray(x)&&x.length===1));
  await page.locator('lextide-reader .dict .close').click();
  await page.evaluate(()=>{const range=document.createRange();range.selectNodeContents(document.querySelector('#original'));const selection=getSelection();selection.removeAllRanges();selection.addRange(range);document.dispatchEvent(new Event('selectionchange'));});
  await page.locator('lextide-reader #translate-selection').waitFor();assert.equal(await page.evaluate(()=>__requests.length),2);
  await page.locator('lextide-reader #translate-selection').click();await page.waitForFunction(()=>document.querySelector('lextide-reader').shadowRoot.querySelector('#selection-result').textContent.includes('他们坐'));
  await page.locator('lextide-reader #close-selection').click();
  await page.evaluate(()=>__menus['点击语境查词：阅读设置']());await page.locator('lextide-reader #bilingual-enabled').check();await page.locator('lextide-reader .panel .close').click();
  await page.waitForFunction(()=>document.querySelector('main').textContent.includes('清晨很安静'));
  await page.locator('lextide-reader .bubble').click();await page.waitForFunction(()=>document.querySelector('main').innerHTML===__originalHTML);
  assert.equal(await page.evaluate(()=>document.querySelector('#original')===__original),true);assert.equal(await page.locator('lextide-reader #words').isChecked(),false);
  report.checks.push(api+': touch lookup, correct occurrence/sense, favorite, selection explicit dispatch, body translation, original node restoration');
  // A new mount must remain off even when previous settings enabled translation.
  const stored=await page.evaluate(()=>structuredClone(__values));for(const key of Object.keys(stored))if(key.includes('prefs:'))stored[key]={...stored[key],words:true,enabled:true,mode:'bilingual'};
  await page.goto('https://article.example/second');await page.evaluate(({api,stored})=>{window.__values=stored;window.__requests=[];window.__menus={};const get=async(k,d)=>__values[k]??d,set=async(k,v)=>__values[k]=v,request=()=>__requests.push('unexpected');window.GM={getValue:get,setValue:set,xmlHttpRequest:request,registerMenuCommand:(name,fn)=>__menus[name]=fn};},{api,stored});await page.evaluate(code);await page.waitForFunction(()=>Object.keys(__menus).length===4);
  assert.equal(await page.locator('lextide-reader .panel').isVisible(),false);await page.evaluate(()=>__menus['点击语境查词：阅读设置']());
  assert.equal(await page.locator('lextide-reader #words').isChecked(),false);assert.equal(await page.locator('lextide-reader #bilingual-enabled').isChecked(),false);assert.equal(await page.evaluate(()=>__requests.length),0);
  await page.locator('lextide-reader #vocabulary').click();await page.locator('lextide-reader .vocab').waitFor();assert.match(await page.locator('lextide-reader .vocab').textContent(),/bank/);
  await page.screenshot({path:`test-results/userscript-${api}-mobile.png`});assert.deepEqual(errors,[]);report.checks.push(api+': persisted vocabulary retained, next-page defaults off, zero browser errors');await page.close();
 }
 report.status='passed';
}catch(error){report.error=error.stack;throw error;}finally{await browser.close();await writeFile('test-results/userscript-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
