// Actual downloaded backup round-trip on a disposable origin. No provider calls.
import {chromium} from 'playwright';import {build} from 'esbuild';import assert from 'node:assert/strict';import {createServer} from 'node:http';import {readFile,mkdir,writeFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
const bundle=await build({stdin:{resolveDir:process.cwd(),contents:`import {mountVocabulary} from './src/vocabulary-view.js';import {demoStore} from './src/storage.js';globalThis.__store=demoStore();globalThis.__view=mountVocabulary({root:document.querySelector('section'),store:__store});`},bundle:true,format:'iife',write:false});
const server=createServer((_req,res)=>{res.writeHead(200,{'Content-Type':'text/html'});res.end('<section></section>');}).listen(0,'127.0.0.1');await new Promise(r=>server.on('listening',r));
const words=Array.from({length:1800},(_,i)=>({word:'study',lemma:'study',zh:'学习',sentence:`Example ${i}: `+'A'.repeat(1000),source:'Synthetic backup fixture',dictionarySource:'Youdao Collins',savedAt:'2026-10-21T00:00:00.000Z'}));
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
await mkdir('test-results',{recursive:true});const report={kind:'downloaded vocabulary backup round-trip',nativeExtensionInstalled:false,status:'failed',checks:[]};let browser;
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||'/usr/bin/chromium'});
 for(const width of [1000,390]){
  const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port);await page.evaluate(bundle.outputFiles[0].text);
  await page.evaluate(async words=>{await __store.importWords({version:2,words});await __view.refresh();},words);
  const downloading=page.waitForEvent('download');await page.locator('#export').click();const download=await downloading,buffer=await readFile(await download.path()),backup=JSON.parse(buffer);
  assert.equal(download.suggestedFilename(),'lextide-words.json');assert.ok(buffer.length>2*1024*1024);assert.equal(digest(backup.words),digest(words));
  await page.evaluate(async()=>{localStorage.removeItem('lextide:v2:words');await __store.saveWord({word:'ocean',lemma:'ocean',zh:'保留已有收藏',sentence:''});await __view.refresh();});
  const upload=()=>page.locator('#import-words').setInputFiles({name:download.suggestedFilename(),mimeType:'application/json',buffer});
  await upload();await page.locator('#vocab-status').filter({hasText:'新增 1800'}).waitFor({timeout:5000});
  const restored=await page.evaluate(()=>__store.words());assert.equal(restored.length,1801);assert.equal(restored[0].zh,'保留已有收藏');assert.equal(digest(restored.slice(1)),digest(words));
  await upload();await page.locator('#vocab-status').filter({hasText:'新增 0，保留已有 1800'}).waitFor();assert.equal((await page.evaluate(()=>__store.words())).length,1801);
  await page.locator('#import-words').setInputFiles({name:'broken.json',mimeType:'application/json',buffer:Buffer.from('{broken')});await page.locator('#vocab-status').filter({hasText:'导入失败'}).waitFor();assert.equal(digest(await page.evaluate(()=>__store.words())),digest(restored));assert.deepEqual(errors,[]);
  report.checks.push({width,downloadBytes:buffer.length,restored:1800,existingPreserved:true,repeatDeduplicated:true,malformedNonDestructive:true});await context.close();
 }
 report.status='passed';console.log(JSON.stringify(report));
}catch(error){report.error=error.stack;throw error;}finally{await browser?.close();await new Promise(r=>server.close(r));await writeFile('test-results/vocabulary-backup-report.json',JSON.stringify(report,null,2));}
