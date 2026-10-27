// Local real-Chromium reload/close/reopen regression. Synthetic vocabulary; no AI requests.
import {chromium} from 'playwright';
import {build} from 'esbuild';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const bundle=await build({stdin:{resolveDir:process.cwd(),contents:`import {mountVocabulary} from './src/vocabulary-view.js';import {demoStore} from './src/storage.js';globalThis.__store=demoStore();globalThis.__view=mountVocabulary({root:document.querySelector('section'),store:__store});__view.refresh();`},bundle:true,write:false,format:'iife'});
const js=bundle.outputFiles[0].text,css=await readFile('extension/popup.css','utf8');
const server=createServer((req,res)=>{if(req.url==='/app.js'){res.setHeader('Content-Type','text/javascript');res.end(js);}else{res.setHeader('Content-Type','text/html');res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style><body class="vocabulary-page"><section></section><script src="/app.js"></script>');}}).listen(0,'127.0.0.1');await new Promise(r=>server.on('listening',r));
const report={kind:'real Chromium local draft persistence regression',syntheticVocabulary:true,realAI:false,iPhoneTest:false,checks:[]};let browser;
await mkdir('test-results',{recursive:true});
try{
 browser=await chromium.launch({...(process.env.CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.CHROMIUM_EXECUTABLE_PATH}:{})});
 for(const width of [1000,390]){
  const context=await browser.newContext({viewport:{width,height:844}});let page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));const url='http://127.0.0.1:'+server.address().port;
  await page.goto(url);await page.evaluate(async()=>{await __store.saveWord({word:'terminal',lemma:'terminal',zh:'终端',sentence:'The terminal is closed.',source:'Synthetic browser fixture'});await __view.refresh();});
  await page.getByRole('button',{name:'修改释义 terminal',exact:true}).click();await page.locator('.vocab-editor textarea').fill('这是刷新后要恢复的草稿');await page.locator('.vocab-draft-status').filter({hasText:'草稿已暂存'}).waitFor();
  await page.reload();await page.getByRole('button',{name:'恢复编辑',exact:true}).waitFor();assert.equal(await page.locator('.vocab-editor').count(),0);assert.equal(await page.locator('#vocab-draft-recovery textarea').inputValue(),'这是刷新后要恢复的草稿');
  await page.getByRole('button',{name:'恢复编辑',exact:true}).click();assert.equal(await page.locator('.vocab-editor textarea').inputValue(),'这是刷新后要恢复的草稿');await page.close();
  page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(url);await page.getByRole('button',{name:'恢复编辑',exact:true}).click();await page.getByRole('button',{name:'保存修改',exact:true}).click();await page.locator('#vocab-status').filter({hasText:'已保存释义修改'}).waitFor();await page.reload();await page.locator('.word-row').waitFor();assert.equal(await page.locator('#vocab-draft-recovery').isVisible(),false);assert.match(await page.locator('.word-row').innerText(),/这是刷新后要恢复的草稿/);
  await page.getByRole('button',{name:'修改释义 terminal',exact:true}).click();await page.locator('.vocab-editor textarea').fill('取消后不能复活的草稿');await page.locator('.vocab-draft-status').filter({hasText:'草稿已暂存'}).waitFor();await page.getByRole('button',{name:'取消修改',exact:true}).click();await page.locator('#vocab-status').filter({hasText:'已取消'}).waitFor();await page.reload();await page.locator('.word-row').waitFor();assert.equal(await page.locator('#vocab-draft-recovery').isVisible(),false);
  await page.getByRole('button',{name:'修改释义 terminal',exact:true}).click();await page.locator('.vocab-editor textarea').fill('原记录删除后保留的草稿');await page.locator('.vocab-draft-status').filter({hasText:'草稿已暂存'}).waitFor();await page.evaluate(async()=>{const [item]=await __store.words();await __store.removeWord(JSON.stringify([item.lemma,item.zh,item.sentence]));});await page.reload();await page.locator('#vocab-draft-recovery').filter({hasText:'已变化或删除'}).waitFor();assert.equal(await page.getByRole('button',{name:'恢复编辑',exact:true}).isVisible(),false);assert.equal(await page.locator('#vocab-draft-recovery textarea').inputValue(),'原记录删除后保留的草稿');assert.equal(await page.locator('.word-row').count(),0);
  assert.deepEqual(errors,[]);report.checks.push({width,reloadRestores:true,closeReopenRestores:true,saveCleans:true,cancelCleans:true,orphanNeverResurrects:true});await context.close();
 }
 report.status='passed';console.log(JSON.stringify(report));
}finally{await browser?.close();await new Promise(r=>server.close(r));await writeFile('test-results/vocabulary-drafts-browser-report.json',JSON.stringify(report,null,2));}
