import {chromium} from 'playwright';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {USERSCRIPT_VERSION} from '../../userscript/version.js';
const code=await readFile('build/userscript/click-context.user.js','utf8');
const values={'click-context:v1:introduced':true},checks=[];
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||'/usr/bin/chromium'});
try{
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
 await context.exposeFunction('__readTestGM',(key,fallback)=>structuredClone(values[key]??fallback));
 await context.exposeFunction('__writeTestGM',(key,value)=>{values[key]=structuredClone(value);});
 await context.addInitScript(()=>{
  window.__calls=[];window.__menus={};window.__listeners=new Map();let next=0;
  window.GM={getValue:(...args)=>__readTestGM(...args),setValue:(...args)=>__writeTestGM(...args),registerMenuCommand:(name,fn)=>__menus[name]=fn,
   addValueChangeListener:(key,fn)=>{const id=++next;__listeners.set(id,{key,fn});return id;},removeValueChangeListener:id=>__listeners.delete(id),
   xmlHttpRequest:details=>{__calls.push(details.url);let timer=setTimeout(()=>{const input=JSON.parse(details.data||'{}');details.onload({status:200,finalUrl:details.url,response:JSON.stringify({ok:true,data:{text:'他们坐在河岸旁。',version:input.translationRevision}})});},10);return {abort(){clearTimeout(timer);details.onabort();}};}};
 });
 await context.route(/https:\/\/(article|other)\.example\//,route=>route.fulfill({contentType:'text/html',body:'<meta name="viewport" content="width=device-width,initial-scale=1"><main><p>They sat on the bank beside the river.</p></main>'}));
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const boot=async(url)=>{await page.goto(url);await page.evaluate(code);await page.waitForFunction(()=>Object.keys(__menus).length===4);};
 await boot('https://article.example/read');assert.equal(await page.evaluate(()=>__calls.length),0);
 await page.locator('lextide-reader .bubble').click();await page.evaluate(()=>__menus['语境精读：阅读设置']());
 for(const id of ['mode','words','bilingual-enabled','translation-unit','vocabulary','engine-settings','reset-bubble','clear-cache','retry-all','remember-site','exclude-site','pause-sites'])assert.equal(await page.locator('lextide-reader #'+id).count(),1,id+' must be available');
 await page.locator('lextide-reader #mode').selectOption('bilingual');await page.locator('lextide-reader #translation-unit').selectOption('sentence');
 await page.locator('lextide-reader .site-controls').evaluate(el=>el.open=true);
 await page.locator('lextide-reader #remember-site').check();await page.waitForFunction(()=>!document.querySelector('lextide-reader').shadowRoot.querySelector('#remember-site').disabled);
 await page.waitForFunction(()=>document.querySelector('main').textContent.includes('他们坐在河岸旁'));
 assert.equal(values['click-context:v1:site-policy:https://article.example'].remember,true);checks.push('shared reading controls and remembered sentence bilingual mode');
 await boot('https://article.example/next');await page.waitForFunction(()=>document.querySelector('main').textContent.includes('他们坐在河岸旁'));
 await page.evaluate(()=>__menus['语境精读：阅读设置']());assert.equal(await page.locator('lextide-reader #words').isChecked(),true);assert.equal(await page.locator('lextide-reader #translation-unit').inputValue(),'sentence');checks.push('navigation preserves words, bilingual translation and sentence unit');
 await page.locator('lextide-reader .site-controls').evaluate(el=>el.open=true);await page.locator('lextide-reader #pause-sites').check();
 await page.waitForFunction(()=>document.querySelector('lextide-reader').shadowRoot.querySelector('#words').disabled&&!document.querySelector('main').textContent.includes('他们坐在河岸旁'));
 const before=await page.evaluate(()=>__calls.length);await page.locator('lextide-reader .panel .close').click();await page.locator('lextide-reader .bubble').click();assert.equal(await page.evaluate(()=>__calls.length),before);assert.equal(await page.locator('lextide-reader .panel').isVisible(),true);
 await page.locator('lextide-reader #pause-sites').uncheck();await page.waitForFunction(()=>document.querySelector('main').textContent.includes('他们坐在河岸旁'));checks.push('global pause cancels reading; resume restores selected features');
 await page.locator('lextide-reader #exclude-site').check();await page.waitForFunction(()=>document.querySelector('lextide-reader').shadowRoot.querySelector('#words').disabled);assert.equal(values['click-context:v1:site-policy:https://article.example'].excluded,true);
 await page.locator('lextide-reader #exclude-site').uncheck();await page.waitForFunction(()=>!document.querySelector('lextide-reader').shadowRoot.querySelector('#words').disabled);checks.push('exclude and restore current website');
 values['click-context:v1:paused']=true;await page.evaluate(()=>{for(const item of __listeners.values())if(item.key==='click-context:v1:paused')item.fn(item.key,false,true,true);});await page.waitForFunction(()=>document.querySelector('lextide-reader').shadowRoot.querySelector('#words').disabled);checks.push('remote GM pause event disables an already open page');
 values['click-context:v1:paused']=false;await boot('https://other.example/read');assert.equal(await page.evaluate(()=>__calls.length),0);checks.push('other origins remain opt-in');
 await boot('https://article.example/account/profile');assert.equal(await page.evaluate(()=>__calls.length),0);checks.push('account paths remain manually activated');assert.deepEqual(errors,[]);
}finally{await browser.close();await mkdir('test-results',{recursive:true});await writeFile('test-results/userscript-site-controls-report.json',JSON.stringify({version:USERSCRIPT_VERSION,status:checks.length===7?'passed':'failed',checks},null,2));console.log(JSON.stringify({checks}));}
