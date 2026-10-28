import {chromium} from 'playwright';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {USERSCRIPT_VERSION} from '../../userscript/version.js';
const code=await readFile(process.env.USERSCRIPT_TEST_FILE||'build/userscript/click-context.user.js','utf8');
const actualVersion=code.match(/@version\s+(\S+)/)?.[1];if(!process.env.USERSCRIPT_TEST_FILE)assert.equal(actualVersion,USERSCRIPT_VERSION);
const report={version:actualVersion,scriptSHA256:createHash('sha256').update(code).digest('hex'),kind:'ordinary Chromium; generated userscript with simulated GM introduction storage stalls and page lifecycle',status:'failed',tampermonkeyInstalled:false,iPhoneTested:false,checks:[]};
const html='<div id="authTrans"><h3>柯林斯英汉双解大词典</h3><div id="collinsResult"><h4><span class="title">class</span></h4><ul><li><div class="collinsMajorTrans"><p><span class="additional">N-COUNT</span> A course of teaching in a subject. 课程</p></div></li></ul></div></div>';
await mkdir('test-results',{recursive:true});const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||'/usr/bin/chromium'});
try{for(const mode of ['read','write'])for(const stage of ['dictionary','context']){
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));const check={mode,stage,status:'failed'};
 try{
 await page.route('https://course.example/**',r=>r.fulfill({contentType:'text/html',body:'<meta name="viewport" content="width=device-width,initial-scale=1"><main><p>This <b id="word">class</b> is taught here.</p></main>'}));await page.goto('https://course.example/');
 await page.evaluate(({mode,stage,html})=>{const values={};window.__requests=[];window.__aborts=0;window.__menus={};window.__stalled=false;window.__recovered=false;window.__introWrites=0;
 window.GM_getValue=(k,d)=>{if(k==='click-context:v1:introduced'&&mode==='read'){__stalled=true;return new Promise(resolve=>window.__introDone=resolve);}return values[k]??d;};
 window.GM_setValue=(k,v)=>{if(k==='click-context:v1:introduced'){__introWrites++;if(mode==='write'){__stalled=true;return new Promise(resolve=>window.__introDone=resolve);}}values[k]=v;};
 window.GM_registerMenuCommand=(name,fn)=>__menus[name]=fn;
 window.GM_xmlhttpRequest=d=>{__requests.push(d.url);const dictionary=d.url.includes('dict.youdao.com');const response=dictionary?html:JSON.stringify({ok:true,data:{senseId:null,zh:'课程'}});
 if(!__recovered&&(stage==='dictionary'&&dictionary||stage==='context'&&!dictionary))window.__late=()=>d.onload({status:200,finalUrl:d.url,response});else queueMicrotask(()=>d.onload({status:200,finalUrl:d.url,response}));
 return {abort(){__aborts++;d.onabort();}};};
 },{mode,stage,html});
 await page.evaluate(code);await page.waitForFunction(()=>__stalled&&Object.keys(__menus).length===4);assert.equal(await page.evaluate(()=>__requests.length),0);
 await page.evaluate(()=>__menus['语境精读：阅读设置']());await page.locator('lextide-reader #words').check();await page.locator('lextide-reader .panel .close').click();await page.locator('#word').click();await page.waitForFunction(()=>typeof __late==='function');
 const before=await page.evaluate(()=>__requests.length);await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));
 assert.equal(await page.evaluate(()=>__aborts),1,'pagehide must cancel the pending request while introduction storage is stalled');assert.equal(await page.locator('lextide-reader .dict').isVisible(),false);
 await page.evaluate(async()=>{__introDone(false);for(let i=0;i<5;i++)await Promise.resolve();__late();__recovered=true;window.dispatchEvent(new Event('pageshow'));});
 assert.equal(await page.locator('lextide-reader .panel').isVisible(),false,'late introduction read must not reopen settings');assert.equal(await page.locator('lextide-reader .dict').isVisible(),false);assert.equal(await page.evaluate(()=>__requests.length),before,'page restoration must not auto-query');if(mode==='read')assert.equal(await page.evaluate(()=>__introWrites),0,'discarded introduction must not mark itself as shown');
 await page.locator('#word').click();await page.waitForFunction(()=>document.querySelector('lextide-reader').shadowRoot.querySelector('.zh').textContent==='课程');assert.ok(await page.evaluate(()=>__requests.length)>before);assert.deepEqual(errors,[]);Object.assign(check,{status:'passed',initialRequests:before,aborts:1,recoveryRequests:await page.evaluate(()=>__requests.length)-before});
 }catch(error){check.error=error.stack;}finally{report.checks.push(check);await page.close();}
 }report.status=report.checks.every(x=>x.status==='passed')?'passed':'failed';}finally{await browser.close();await writeFile(process.env.USERSCRIPT_LIFECYCLE_REPORT||'test-results/userscript-lifecycle-report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));}
if(report.status!=='passed')process.exitCode=1;
