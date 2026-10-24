// Real shared UI + real Youdao relay + real Workers AI; not native-extension evidence.
import {chromium} from 'playwright';
import {writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const url=process.env.PREVIEW_URL||'https://v04-preview.lextide.pages.dev/';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||'/usr/bin/chromium'});
const report={kind:'published shared reader with live dictionary and context API',nativeExtensionInstalled:false,url,status:'failed',results:[]};
await mkdir('test-results',{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:1100,height:850}});const errors=[],responses=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.url().includes('/meaning'))responses.push({status:r.status()});});
 await page.goto(url);report.version=await page.evaluate(async()=>await(await fetch('/version.json')).json());
 await page.locator('#custom').click();await page.locator('#custom-text').fill('She deposited her salary at the bank.\nThey sat on the bank beside the river.\nTickets are available online from Monday.\nAre you available for a meeting tomorrow?');await page.locator('#load-custom').click();
 for(const [index,word,expected]of [[0,'bank',/银行/],[1,'bank',/岸/],[2,'available',/购买|售|获得|获取|领取/],[3,'available',/有空|时间/]]){
  const started=Date.now();await page.locator('#article p.english').nth(index).locator('[data-word="'+word+'"]').click();
  await page.waitForFunction(()=>document.querySelector('lextide-reader').shadowRoot.querySelector('.sense-status').textContent.includes('AI 结合原句分析'),{},{timeout:35000});
  const zh=await page.locator('lextide-reader .zh').textContent();assert.match(zh,expected);assert.match(await page.locator('lextide-reader .zh-source').textContent(),/对应 Collins 原义/);report.results.push({word,zh,elapsedMs:Date.now()-started});await page.keyboard.press('Escape');
 }
 await page.setViewportSize({width:390,height:844});await page.locator('#article p.english').nth(3).locator('[data-word="available"]').click();await page.locator('lextide-reader .sense-status').filter({hasText:'AI 结合原句分析'}).waitFor();
 await page.screenshot({path:'test-results/live-context-mobile.png'});const bounds=await page.locator('lextide-reader .dict').boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=391);
 assert.equal(responses.length,4,'same-context repeat should use context memory cache');assert.ok(responses.every(r=>r.status===200));assert.deepEqual(errors,[]);report.status='passed';report.contextRequests=responses.length;
}finally{await browser.close();await writeFile('test-results/live-preview-context.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
