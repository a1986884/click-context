import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import worker from '../../build/pages-preview/_worker.js';

const server=createServer(async(req,res)=>{
 try{const response=await worker.fetch(new Request('http://localhost'+req.url,{method:req.method}));res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));}
 catch{res.writeHead(500);res.end('Preview failed');}
}).listen(0,'127.0.0.1');
await new Promise(resolve=>server.on('listening',resolve));
const oceanMeaning=process.env.LIVE_DICTIONARY==='1'?'大海':'海洋';
const origin=new URL(process.env.PREVIEW_URL||'http://127.0.0.1:'+server.address().port).origin;
let browser;
const report={url:origin,nativeExtensionInstalled:false,checks:[],status:'failed'};
await mkdir('test-results',{recursive:true});
try{
 browser=await chromium.launch(process.env.CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.CHROMIUM_EXECUTABLE_PATH}:{channel:'chromium'});
 report.browserVersion=browser.version();
 for(const viewport of [{width:1280,height:800},{width:390,height:844}]){
  const context=await browser.newContext({viewport});
  const page=await context.newPage(),errors=[],providerRequests=[];
  page.setDefaultTimeout(10000);
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',message=>{if(message.type()==='error')console.error('Browser console:',message.text());});
  page.on('requestfailed',request=>console.error('Request failed:',request.url(),request.failure()?.errorText));
  page.on('request',request=>{if(/lextide-context\.aa1986884\.workers\.dev\/translate|api\.dictionaryapi\.dev|\/api\/dictionary/.test(request.url()))providerRequests.push(request.url());});
  if(process.env.LIVE_DICTIONARY!=='1')await page.route('**/api/dictionary?*',route=>{const word=new URL(route.request().url()).searchParams.get('word');return route.fulfill({json:{ok:true,data:{word,lemma:word,zh:word==='ocean'?'海洋':'技术',definitions:['Synthetic browser test fixture.'],source:'Synthetic Collins contract fixture; not live data',kind:'collins',sourceUrls:[]}}});});
  await page.goto(origin,{waitUntil:'networkidle'});report.version=await page.evaluate(async()=>{const r=await fetch('/version.json');if(!r.ok)throw Error('Preview version endpoint unavailable');return r.json();});if(process.env.EXPECTED_PREVIEW_VERSION)assert.equal(report.version.version,process.env.EXPECTED_PREVIEW_VERSION);
  await page.locator('footer small').filter({hasText:/V0\./}).waitFor();
  assert.deepEqual(providerRequests,[]);
  assert.equal(await page.locator('lextide-reader #online').count(),0);assert.equal(await page.locator('lextide-reader #bilingual-toggle').count(),0);
  await page.locator('#article [data-word]').filter({hasText:/^ocean$/i}).first().click();
  await page.locator('lextide-reader .zh').filter({hasText:oceanMeaning}).waitFor().catch(async error=>{console.error('Dictionary diagnostic',JSON.stringify({text:await page.locator('lextide-reader .dict').textContent(),hidden:await page.locator('lextide-reader .dict').isHidden(),errors,providerRequests,prefs:await page.evaluate(()=>localStorage.getItem('lextide:v2:prefs'))}));throw error;});
  const lookupRequests=providerRequests.length;
  await page.keyboard.press('Escape');await page.locator('#article [data-word]').filter({hasText:/^ocean$/i}).first().click();
  await page.locator('lextide-reader .zh').filter({hasText:oceanMeaning}).waitFor();
  assert.equal(providerRequests.length,lookupRequests,'Repeating a completed word lookup must not send another request');
  await page.locator('lextide-reader #save').click();
  await page.locator('lextide-reader #save').filter({hasText:'已收藏'}).waitFor();
  await page.keyboard.press('Escape');
  await page.locator('lextide-reader .bubble').click({delay:620});await page.locator('lextide-reader #mode').selectOption('bilingual');await page.locator('lextide-reader .panel .close').click();
  await page.locator('.lextide-translation p').first().waitFor();
  await page.locator('lextide-reader .bubble').click({delay:620});await page.locator('lextide-reader #mode').selectOption('translated');await page.locator('lextide-reader .panel .close').click();
  await page.waitForFunction(()=>{const paragraphs=[...document.querySelectorAll('#article p.english')];return paragraphs.some(p=>p.hidden)&&paragraphs.filter(p=>p.querySelector('a')).every(p=>!p.hidden);});
  await page.locator('lextide-reader .bubble').click({delay:620});await page.locator('lextide-reader #mode').selectOption('original');await page.locator('lextide-reader .panel .close').click();
  await page.waitForFunction(()=>!document.querySelector('.lextide-translation'));
  await page.locator('#demo-vocabulary').click();
  await page.locator('lextide-reader #vocab-list').getByText('ocean',{exact:true}).first().waitFor();
  await page.locator('lextide-reader #vocab-search').fill('不存在的中文');await page.locator('lextide-reader #vocab-list').filter({hasText:'没有匹配'}).waitFor();
  await page.locator('lextide-reader #vocab-search').fill(oceanMeaning);await page.locator('lextide-reader #vocab-list').getByText('ocean',{exact:true}).first().waitFor();
  await page.locator('lextide-reader #vocab-search').fill('');await page.getByRole('button',{name:'删除 ocean',exact:true}).click();
  await page.locator('lextide-reader #vocab-list').filter({hasText:'还没有生词'}).waitFor();await page.locator('lextide-reader #vocab-undo').click();
  await page.locator('lextide-reader #vocab-list').getByText('ocean',{exact:true}).first().waitFor();
  await page.locator('lextide-reader #import-words').setInputFiles({name:'vocabulary.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({version:2,words:[{word:'spectrum',lemma:'spectrum',zh:'光谱',sentence:'Synthetic import fixture'},{word:'ocean',zh:'不覆盖'}]}))});
  await page.locator('lextide-reader #vocab-status').filter({hasText:'新增 2'}).waitFor();await page.locator('lextide-reader #vocab-list').getByText('spectrum',{exact:true}).waitFor();
  const download=page.waitForEvent('download');await page.locator('lextide-reader #export').click();
  const data=JSON.parse(await readFile(await (await download).path(),'utf8'));assert.ok(data.words.some(word=>word.lemma==='ocean'));
  await page.keyboard.press('Escape');
  await page.reload({waitUntil:'networkidle'});
  await page.locator('#demo-vocabulary').click();await page.locator('lextide-reader #vocab-list').getByText('ocean',{exact:true}).first().waitFor();
  await page.keyboard.press('Escape');
  await page.locator('#article-select').selectOption('1');
  await page.locator('#article [data-word]').filter({hasText:/^technology$/i}).first().click();
  await page.locator('lextide-reader .word').filter({hasText:/technology/i}).waitFor();
  await page.screenshot({path:`test-results/preview-${viewport.width}.png`,fullPage:true});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Preview overflows viewport');
  assert.deepEqual(errors,[]);assert.ok(providerRequests.every(url=>url.startsWith(origin+'/api/dictionary?')));
  report.checks.push({viewport,status:'passed',tested:'word lookup, vocabulary search/import/undo/persistence/export, all reading modes, article switch, consent isolation; '+(process.env.LIVE_DICTIONARY==='1'?'live Collins pages':'synthetic dictionary contract fixture')});
  const apiRequests=[];page.on('request',request=>{if(new URL(request.url()).origin!==origin)apiRequests.push(request.url());});
  await page.locator('a.api-link').click();await page.locator('#status').filter({hasText:'API 设置界面预览'}).waitFor();
  assert.equal(await page.locator('#api-key').isDisabled(),true);assert.equal(await page.locator('#save').isDisabled(),true);assert.equal(await page.locator('#test').isDisabled(),true);
  const stored=await page.evaluate(()=>JSON.stringify(Object.entries(localStorage)));
  await page.locator('#body-engine').selectOption('google');await page.locator('#context-engine').selectOption('deepseek');assert.equal(await page.locator('#body-engine').inputValue(),'google');assert.equal(await page.locator('#context-engine').inputValue(),'deepseek');
  await page.locator('#preset').selectOption('gemini');assert.equal(await page.locator('#model-label').isVisible(),true);assert.match(await page.locator('#endpoint').inputValue(),/generativelanguage/);await page.locator('#model').fill('public-example-model');await page.keyboard.press('Enter');assert.match(page.url(),/engines-preview\.html$/);assert.equal(await page.evaluate(()=>JSON.stringify(Object.entries(localStorage))),stored);assert.deepEqual(apiRequests,[]);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:`test-results/api-settings-preview-${viewport.width}.png`,fullPage:true});assert.deepEqual(errors,[]);
  report.apiSettingsPreview??=[];report.apiSettingsPreview.push({width:viewport.width,status:'passed',credentialEntryDisabled:true,externalRequests:0,configurationPersisted:false});
  console.log('PASS preview and API settings demo',viewport.width+'px');await context.close();
 }
 report.status='passed';
}catch(error){report.failure=error.stack;throw error;}
finally{await browser?.close();server.close();await writeFile('test-results/preview-report.json',JSON.stringify(report,null,2));}
