// Ordinary-browser contract test with a deliberately invalidated runtime fixture.
// This is not a native installed-extension/update test.
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const source=await readFile('build/extension/content.js','utf8');
const server=createServer((req,res)=>{res.writeHead(200,{'Content-Type':'text/html'});res.end('<html><head><meta charset="utf-8"><title>Content lifecycle contract fixture</title></head><body><main><p id="text">Several words are <strong>available</strong> here.</p></main></body></html>');}).listen(0,'127.0.0.1');await new Promise(r=>server.on('listening',r));
let browser;const report={kind:'ordinary-browser runtime invalidation contract fixture',nativeExtensionInstalled:false,status:'failed',checks:[]};
await mkdir('test-results',{recursive:true});
try{
 browser=await chromium.launch(process.env.CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.CHROMIUM_EXECUTABLE_PATH}:{channel:'chromium'});
 for(const mode of ['reject-on-lookup','reject-on-translation','missing-runtime-id']){
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port);
  await page.evaluate(()=>{
   const state={authorized:true,prefs:{mode:'translated',enabled:true,words:true,online:true,side:'right'}};
   const listeners=new Set(),words=[];globalThis.__runtimeFixture={invalid:false,calls:0,listeners};
   globalThis.chrome={runtime:{get id(){return globalThis.__runtimeFixture.invalid?undefined:'runtime-fixture';},onMessage:{addListener:f=>listeners.add(f),removeListener:f=>listeners.delete(f)},async sendMessage(m){const f=globalThis.__runtimeFixture;f.calls++;if(f.invalid)throw Error('Extension context invalidated.');if(m.type==='bootstrap')return {ok:true,data:state};if(m.type==='store'){if(m.op==='prefs')return {ok:true,data:state.prefs};if(m.op==='cacheGet')return {ok:true,data:f.failTranslation?null:'已有的本地缓存译文'};if(m.op==='words')return {ok:true,data:words};return {ok:true,data:null};}if(m.type==='lookup'||m.type==='translate'){f.invalid=true;throw Error('Extension context invalidated.');}return {ok:true,data:null};}}};
  });
  await page.evaluate(source);await page.locator('.lextide-translation p').waitFor();assert.equal(await page.locator('#text').isHidden(),true);
  if(mode==='reject-on-lookup'){
   // The translated original is hidden; restore it via the reader's original-text button before clicking.
   await page.locator('.lextide-translation button').click();await page.locator('#text strong').click();
  }else if(mode==='reject-on-translation')await page.evaluate(()=>{globalThis.__runtimeFixture.failTranslation=true;const p=document.createElement('p');p.textContent='A fresh paragraph requires a translation request.';document.querySelector('main').append(p);});
  else await page.evaluate(()=>{globalThis.__runtimeFixture.invalid=true;});
  await page.locator('lextide-refresh-notice').waitFor();assert.equal(await page.locator('lextide-reader,.lextide-translation').count(),0);assert.equal(await page.locator('#text').isVisible(),true);assert.equal(await page.evaluate(()=>globalThis.__runtimeFixture.listeners.size),0);
  await page.locator('lextide-refresh-notice').getByRole('alert').filter({hasText:'刷新当前网页'}).waitFor();
  const calls=await page.evaluate(()=>globalThis.__runtimeFixture.calls);await page.waitForTimeout(1700);assert.equal(await page.evaluate(()=>globalThis.__runtimeFixture.calls),calls);assert.deepEqual(errors,[]);
  await page.screenshot({path:`test-results/reload-${mode}.png`});
  if(mode==='reject-on-lookup'){const navigation=page.waitForNavigation();await page.locator('lextide-refresh-notice #refresh').click();await navigation;assert.equal(await page.locator('lextide-refresh-notice').count(),0);}
  else{await page.locator('lextide-refresh-notice #dismiss').click();assert.equal(await page.locator('lextide-refresh-notice').count(),0);}
  report.checks.push({mode,status:'passed',tested:'restore original paragraphs, stop requests/listeners, one actionable notice, refresh/dismiss, no uncaught errors'});await page.close();
 }
 report.status='passed';console.log(JSON.stringify(report));
}catch(error){report.failure=error.stack;throw error;}
finally{await browser?.close();server.close();await writeFile('test-results/content-reload-report.json',JSON.stringify(report,null,2));}
