import {USERSCRIPT_VERSION} from '../../userscript/version.js';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import worker from '../../workers/context/index.js';
const code=await readFile('build/userscript/click-context.user.js','utf8');
const waitForStage=async stage=>{let timer;try{return await Promise.race([stage,new Promise((_resolve,reject)=>timer=setTimeout(()=>reject(Error('Fixture stage timed out')),5000))]);}finally{clearTimeout(timer);}};
const sentence='This class is co-taught by Anish, Jon, and Jose.';
const entry={word:'class',lemma:'class',kind:'collins',zh:'课程',source:'Synthetic Collins fixture',senses:[{id:'course',zh:'课程',definition:'A course of teaching in a particular subject.',pos:'N-COUNT',examples:[]}]};
assert.equal(code.match(/@version\s+(\S+)/)?.[1],USERSCRIPT_VERSION,'generated script version must match the current source');
const report={version:USERSCRIPT_VERSION,scriptSHA256:createHash('sha256').update(code).digest('hex'),kind:'ordinary Chromium; actual generated userscript, simulated GM/dictionary/AI; real local Worker origin validation',tampermonkeyInstalled:false,iPhoneTested:false,status:'failed',checks:[]};
await mkdir('test-results',{recursive:true});const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||'/usr/bin/chromium'});
try{
 for(const scenario of ['repeat-pending','retry-recovers','dictionary-denied','dictionary-limited','dictionary-network','denied-both-unavailable','missing-section','all-unavailable','both-unavailable']){
  let recovered=false,releaseSource,releaseAI,markSource,markAI;const sourceReady=new Promise(resolve=>markSource=resolve),aiReady=new Promise(resolve=>markAI=resolve);
  const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true}),calls=[];
  await page.route('https://course.example/**',r=>r.fulfill({contentType:'text/html',body:'<meta name="viewport" content="width=device-width, initial-scale=1"><main><p>This <b id="word">class</b> is co-taught by Anish, Jon, and Jose.</p></main>'}));
  await page.exposeBinding('__transport',async(_,d)=>{
   calls.push(d.url);
   if(d.url.includes('dict.youdao.com')){if(scenario==='repeat-pending'){markSource();await new Promise(resolve=>releaseSource=resolve);}if(scenario==='dictionary-network')throw Error('Synthetic network failure');return {status:scenario==='dictionary-limited'?429:scenario.startsWith('denied-')||scenario==='dictionary-denied'?403:200,body:'<html><p>Dictionary section unavailable</p></html>'};}
   if(d.url.includes('v04-preview'))return {status:200,body:JSON.stringify({ok:true,data:(['all-unavailable','both-unavailable'].includes(scenario)||scenario==='retry-recovers'&&!recovered)?{word:'class',lemma:'class',kind:'unavailable',senses:[],dictionaryError:'公开词条没有 Collins 栏目'}:entry})};
   if(scenario==='repeat-pending'){markAI();await new Promise(resolve=>releaseAI=resolve);}
   const input=JSON.parse(d.data);assert.equal(input.sentence,sentence);assert.equal(input.offset,5);
   const response=await worker.fetch(new Request(d.url,{method:d.method,headers:{...d.headers,Origin:'https://course.example'},body:d.data}),{AI:{run:async()=>{if(['both-unavailable','denied-both-unavailable'].includes(scenario)||scenario==='retry-recovers'&&!recovered)throw Error('Synthetic unavailable');return {response:JSON.stringify({senseId:input.senses.length?'course':null,zh:'课程'})};}},PER_IP:{limit:async()=>({success:true})},TOTAL:{limit:async()=>({success:true})}});
   return {status:response.status,body:await response.text()};
  });
  await page.goto('https://course.example/');
  await page.evaluate(()=>{const values={};window.__aborts=0;window.GM_getValue=(k,d)=>values[k]??d;window.GM_setValue=(k,v)=>values[k]=v;window.GM_xmlhttpRequest=d=>{let stopped=false;__transport({url:d.url,method:d.method,headers:d.headers,data:d.data}).then(r=>{if(!stopped)d.onload({status:r.status,finalUrl:d.url,response:r.body});},()=>d.onerror());return {abort(){window.__aborts++;stopped=true;d.onabort();}};};});
  await page.evaluate(code);await page.locator('lextide-reader .panel').waitFor();await page.locator('lextide-reader #words').check();await page.locator('lextide-reader .panel .close').click();await page.locator('#word').tap();
  const failedDictionary=['dictionary-denied','dictionary-limited','dictionary-network','denied-both-unavailable'].includes(scenario);
  if(scenario==='repeat-pending'){
   await waitForStage(sourceReady);await page.evaluate(()=>getSelection().removeAllRanges());await page.locator('#word').tap();await page.waitForTimeout(50);assert.equal(calls.length,1);assert.equal(await page.evaluate(()=>__aborts),0);releaseSource();await waitForStage(aiReady);await page.evaluate(()=>getSelection().removeAllRanges());await page.locator('#word').tap();await page.waitForTimeout(50);assert.equal(calls.length,3);assert.equal(await page.evaluate(()=>__aborts),0);releaseAI();await page.waitForFunction(()=>document.querySelector('lextide-reader').shadowRoot.querySelector('.zh').textContent==='课程');assert.equal(await page.locator('lextide-reader #sense-choice').inputValue(),'course');
  }else if(scenario==='retry-recovers'){
   await page.locator('lextide-reader #retry').waitFor();assert.equal(calls.length,3);recovered=true;await page.locator('lextide-reader #retry').click();await page.waitForFunction(()=>document.querySelector('lextide-reader').shadowRoot.querySelector('.zh').textContent==='课程');assert.equal(calls.length,6);assert.equal(await page.locator('lextide-reader #sense-choice').inputValue(),'course');assert.match(await page.locator('lextide-reader .dictionary-label').textContent(),/Collins/);
  }else if(['both-unavailable','denied-both-unavailable'].includes(scenario)){
   await page.locator('lextide-reader #retry').waitFor();assert.doesNotMatch(await page.locator('lextide-reader .dict').textContent(),/此演示条目|示例释义/);assert.match(await page.locator('lextide-reader .defs').textContent(),scenario==='both-unavailable'?/公开词条没有 Collins 栏目/:/拒绝/);
  }else{
   await page.waitForFunction(()=>document.querySelector('lextide-reader').shadowRoot.querySelector('.zh').textContent==='课程',{},{timeout:5000});
   assert.equal(calls.length,failedDictionary?2:3);assert.ok(calls.at(-1).endsWith('/userscript/meaning'));
   assert.doesNotMatch(await page.locator('lextide-reader .dict').textContent(),/此演示条目|示例释义/);
   if(scenario==='all-unavailable'||failedDictionary){
    assert.match(await page.locator('lextide-reader .dictionary-label').textContent(),/AI/);
    assert.match(await page.locator('lextide-reader .defs').textContent(),/Collins 词条读取失败/);
    assert.doesNotMatch(await page.locator('lextide-reader .source').textContent(),/下方词条仅供查阅/);
   }else assert.equal(await page.locator('lextide-reader #sense-choice').inputValue(),'course');
  }
  if(failedDictionary){assert.equal(calls.length,2);assert.ok(calls.at(-1).endsWith('/userscript/meaning'));assert.ok(!calls.some(url=>url.includes('v04-preview')));}
  report.checks.push({scenario,passed:true,requests:calls});await page.screenshot({path:'test-results/userscript-class-'+scenario+'.png'});await page.close();
 }
 report.status='passed';
}catch(e){report.error=e.stack;throw e;}finally{await browser.close();await writeFile('test-results/userscript-class-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
