import {USERSCRIPT_VERSION} from '../../userscript/version.js';
// Public real services through a curl-backed GM simulation. No actual manager.
import {chromium} from 'playwright';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {NETWORK_HOSTS} from '../../userscript/gm-adapter.js';
import {createHash} from 'node:crypto';
const report={version:USERSCRIPT_VERSION,date:new Date().toISOString(),kind:'ordinary Chromium browser; generated userscript; curl-backed simulated GM API; real dictionary and AI services; Origin matches simulated course.example page',tampermonkeyInstalled:false,iPhoneTested:false,status:'failed',requests:[],checks:[]};
await mkdir('test-results',{recursive:true});
const code=await readFile('build/userscript/click-context.user.js','utf8');report.scriptSHA256=createHash('sha256').update(code).digest('hex');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||'/usr/bin/chromium'});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true});
 await page.route('https://course.example/**',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{font:20px/1.9 Georgia;padding:20px}</style><main><h1>Course introduction</h1><p id="sentence">This <strong id="word">class</strong> is co-taught by Anish, Jon, and Jose.</p></main>'}));
 await page.exposeBinding('__liveGM',async(_,details)=>{
  const url=new URL(details.url);if(url.protocol!=='https:'||!NETWORK_HOSTS.includes(url.hostname))throw Error('Disallowed URL');
  const args=['--silent','--show-error','--max-time','25','--max-filesize','1048576','--request',details.method,'--write-out','\n%{http_code}',details.url];
  for(const [key,value]of Object.entries(details.headers||{}))args.push('--header',key+': '+value);
  if(url.hostname==='lextide-context.aa1986884.workers.dev')args.push('--header','Origin: https://course.example');
  if(details.data)args.push('--data-binary','@-');
  const start=Date.now();
  try{const raw=execFileSync('curl',args,{input:details.data||'',maxBuffer:2*1024*1024}),split=raw.lastIndexOf(10),status=Number(raw.subarray(split+1).toString());report.requests.push({url:details.url,status,ms:Date.now()-start});return {status,base64:raw.subarray(0,split).toString('base64')};}
  catch{report.requests.push({url:details.url,status:'network-error',ms:Date.now()-start});throw Error('Public request failed');}
 });
 await page.goto('https://course.example/');
 await page.evaluate(()=>{
  const values={};window.__menus={};window.GM_registerMenuCommand=(name,fn)=>__menus[name]=fn;window.GM_getValue=(k,d)=>values[k]??d;window.GM_setValue=(k,v)=>values[k]=v;
  const original=Element.prototype.attachShadow;Element.prototype.attachShadow=function(options){const root=original.call(this,options);if(this.localName==='click-context-diagnostics')window.__diagnostics=root;return root;};
  window.GM_xmlhttpRequest=d=>{let aborted=false;window.__liveGM({url:d.url,method:d.method,headers:d.headers,data:d.data}).then(result=>{if(!aborted)d.onload({status:result.status,finalUrl:d.url,response:Uint8Array.from(atob(result.base64),c=>c.charCodeAt(0)).buffer});},()=>{if(!aborted)d.onerror();});return {abort(){aborted=true;d.onabort();}};};
 });
 await page.evaluate(code);
 await page.locator('lextide-reader .panel').waitFor();if(report.requests.length)throw Error('Unexpected initial request');
 await page.locator('lextide-reader #words').check();await page.locator('lextide-reader .panel .close').click();await page.locator('#word').tap();
 await page.waitForFunction(()=>{const s=document.querySelector('lextide-reader').shadowRoot;return !s.querySelector('#save').disabled||!s.querySelector('#retry').hidden;},{},{timeout:55000});
 const lookup=await page.locator('lextide-reader .dict').textContent();report.lookupText=lookup;
 report.selectedDefinition=await page.locator('lextide-reader .defs').textContent();report.selectedGloss=await page.locator('lextide-reader .zh').textContent();
 report.checks.push({name:'real contextual class lookup with webpage Origin',passed:report.selectedGloss.includes('课程')&&/course/.test(report.selectedDefinition)&&!lookup.includes('语境分析失败')&&report.requests.some(x=>x.url.endsWith('/userscript/meaning')&&x.status===200)});
 await page.screenshot({path:'test-results/userscript-live-lookup-mobile.png'});
 await page.locator('lextide-reader .dict .close').click();
 await page.evaluate(()=>{const range=document.createRange();range.selectNodeContents(document.querySelector('#sentence'));getSelection().removeAllRanges();getSelection().addRange(range);document.dispatchEvent(new Event('selectionchange'));});
 await page.locator('lextide-reader #translate-selection').click();
 await page.waitForFunction(()=>{const s=document.querySelector('lextide-reader').shadowRoot;return s.querySelector('#selection-result').textContent!=='翻译中…'&&s.querySelector('#selection-result').textContent!=='';},{},{timeout:30000});
 // Wait for the explicit request to settle, including failure UI.
 await page.waitForFunction(()=>{const s=document.querySelector('lextide-reader').shadowRoot;return /[\u3400-\u9fff]/.test(s.querySelector('#selection-result').textContent)&&!s.querySelector('#selection-result').textContent.includes('正在翻译');},{},{timeout:30000});
 report.selectionText=await page.locator('lextide-reader #selection-result').textContent();
 report.checks.push({name:'real selected sentence translation with webpage Origin',passed:/课程|课/.test(report.selectionText)&&report.requests.some(x=>x.url.endsWith('/userscript/translate')&&x.status===200)});
 await page.screenshot({path:'test-results/userscript-live-selection-mobile.png'});
 await page.evaluate(()=>{__menus['点击语境查词：连接检查']();__diagnostics.querySelector('#run').click();});
 await page.waitForFunction(()=>!__diagnostics.querySelector('#run').disabled,{},{timeout:35000});report.diagnostics=await page.evaluate(()=>JSON.parse(__diagnostics.querySelector('#report').value));
 report.checks.push({name:'explicit real builtin connection checks, no inference payload',passed:report.diagnostics.allReachable===true});
 await page.screenshot({path:'test-results/userscript-live-diagnostics-mobile.png'});
 report.status=report.checks.every(c=>c.passed)?'passed':'failed';
}catch(error){report.error=error.message;}finally{await browser.close();await writeFile('test-results/userscript-live-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
if(report.status!=='passed')process.exitCode=1;
