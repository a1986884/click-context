import {scienceCases,assertScientificTranslation} from './science-cases.mjs';
import {sourceState} from '../../scripts/build-evidence.mjs';
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
  // This runner sends only fixed public science fixtures. Preserve their bounded
  // upstream text so a client rejection can be manually assessed, not mistaken
  // for a transport failure. Production diagnostics never capture reading text.
  try{const raw=execFileSync('curl',args,{input:details.data||'',maxBuffer:2*1024*1024}),split=raw.lastIndexOf(10),status=Number(raw.subarray(split+1).toString());let parsed;try{parsed=JSON.parse(raw.subarray(0,split).toString());}catch{}report.requests.push({url:details.url,status,ms:Date.now()-start,...(parsed?.code?{code:parsed.code,failureReason:parsed.failureReason,validationReason:parsed.validationReason,incompleteReason:parsed.incompleteReason}:{}),...(parsed?.ok?{model:parsed.data.model,...(typeof parsed.data.text==='string'?{upstreamText:parsed.data.text.slice(0,12000)}:{})}:{} )});return {status,base64:raw.subarray(0,split).toString('base64')};}
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
 await page.locator('lextide-reader #words').check();await page.locator('lextide-reader .panel .close').click();
 report.source=sourceState();report.kind='ordinary Chromium; actual userscript selection with simulated GM transport, real builtin translation; finite science/negation samples';report.samples=[];report.reviewRequired=true;
 for(const [index,{id,text}]of scienceCases.entries()){
  const sample={id,text,status:'failed'},start=Date.now(),before=report.requests.length;
  try{
   await page.evaluate(text=>{const p=document.createElement('p');p.id='sentence';p.textContent=text;document.querySelector('main').replaceChildren(p);const r=document.createRange();r.selectNodeContents(p);getSelection().removeAllRanges();getSelection().addRange(r);document.dispatchEvent(new Event('selectionchange'));},text);
   await page.locator('lextide-reader #translate-selection').click();await page.waitForFunction(()=>{const s=document.querySelector('lextide-reader').shadowRoot;return s.querySelector('#selection-result').textContent!=='正在翻译…';},{},{timeout:35000});sample.translation=await page.locator('lextide-reader #selection-result').textContent();sample.retryVisible=await page.locator('lextide-reader #retry-selection').isVisible();if(sample.retryVisible)throw Error('Translation service failed');assertScientificTranslation(sample.translation,index);sample.status='passed';
  }catch(error){sample.error=error.message;}
  sample.ms=Date.now()-start;sample.requests=report.requests.slice(before);report.samples.push(sample);console.log(JSON.stringify(sample));await page.locator('lextide-reader #close-selection').click();await writeFile('test-results/userscript-science-report.json',JSON.stringify(report,null,2));
 }
 report.passed=report.samples.filter(s=>s.status==='passed').length;report.failed=report.samples.length-report.passed;report.status=report.failed?'failed':'passed';
}catch(error){report.error=error.message;}finally{await browser.close();await writeFile('test-results/userscript-science-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,passed:report.passed,failed:report.failed}));}
if(report.status!=='passed')process.exitCode=1;
