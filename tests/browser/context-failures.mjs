// Shared reader/provider contracts, synthetic HTTP only; no installed extension.
import {chromium} from 'playwright';import {build} from 'esbuild';import assert from 'node:assert/strict';import {mkdir,writeFile} from 'node:fs/promises';
const code=await build({stdin:{resolveDir:process.cwd(),contents:`
 import {mountReader} from './src/reader.js';import {createStore,DEFAULT_PREFS} from './src/storage.js';import {createContextClient} from './src/context-meaning.js';import {cacheWordLookup} from './src/dictionary-cache.js';
 const data={prefs:{...DEFAULT_PREFS,words:true}},store=createStore({get:async k=>data[k],set:async(k,v)=>data[k]=structuredClone(v)});
 globalThis.__scenario='503';globalThis.__sources=0;globalThis.__contexts=0;
 const dictionary=cacheWordLookup(async word=>{__sources++;return {word,lemma:word,kind:'collins',source:'Synthetic failure fixture',senses:[{id:'bank',lemma:word,pos:'N',zh:'银行原义',definition:'Synthetic financial sense.'},{id:'river',lemma:word,pos:'N',zh:'河岸原义',definition:'Synthetic river sense.'}]};});
 const context=createContextClient({timeoutMs:30,fetcher:async(_url,{signal})=>{__contexts++;switch(__scenario){case '429':return new Response('Busy',{status:429});case '503':return Response.json({ok:false,error:'Synthetic upstream failure'},{status:503});case 'server-busy':return Response.json({ok:false,code:'CONTEXT_BUSY'},{status:503});case 'server-timeout':return Response.json({ok:false,code:'CONTEXT_TIMEOUT'},{status:503});case 'server-invalid':return Response.json({ok:false,code:'CONTEXT_INVALID_RESULT'},{status:503});case 'network':throw new TypeError('Failed to fetch');case 'invalid':return Response.json({ok:true,data:{senseId:'invented',zh:'错误候选'}});case 'timeout':return new Promise((_r,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));default:return Response.json({ok:true,data:{senseId:'river',zh:'本句河岸'}});}}});
 globalThis.__reader=mountReader({root:document.querySelector('main'),store,transport:(type,word,online,options)=>type==='context'?context(options.context,options):dictionary(word,{online,...options})});
`},bundle:true,format:'iife',write:false});
await mkdir('test-results',{recursive:true});const report={kind:'context failure category, source fallback and manual recovery',nativeExtensionInstalled:false,status:'failed',checks:[]};let browser;
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||'/usr/bin/chromium'});
 for(const width of [1000,390]){
  const page=await browser.newPage({viewport:{width,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setContent('<main><p id="target">The bank is here.</p></main>');await page.evaluate(code.outputFiles[0].text);await page.evaluate(()=>__reader.ready);
  let index=0;for(const [scenario,expected]of [['server-busy','繁忙'],['429','过于频繁'],['503','暂不可用'],['network','连接失败'],['invalid','未通过校验'],['timeout','超时'],['server-timeout','超时'],['server-invalid','未通过校验']]){
   await page.evaluate(({scenario,index})=>{__scenario=scenario;return __reader.show('bank',document.querySelector('#target'),'The bank is here. Example '+index+'.',4);},{scenario,index:index++});
   assert.match(await page.locator('lextide-reader .sense-status').textContent(),new RegExp(expected));assert.match(await page.locator('lextide-reader .sense-status').textContent(),/当前显示词典原义/);assert.equal(await page.locator('lextide-reader .zh').textContent(),'银行原义');assert.equal(await page.locator('lextide-reader #retry').isVisible(),true);assert.equal(await page.locator('lextide-reader #context-engine-settings').isVisible(),false,'native/shared reader without context configuration callback must not offer unsupported settings');
   const before=await page.evaluate(()=>__contexts);await page.evaluate(()=>__scenario='success');await page.locator('lextide-reader #retry').click();await page.locator('lextide-reader .zh').filter({hasText:'本句河岸'}).waitFor();assert.match(await page.locator('lextide-reader .sense-status').textContent(),/此处含义/);assert.equal(await page.locator('lextide-reader #retry').isVisible(),false);assert.equal(await page.evaluate(()=>__contexts),before+1);assert.equal(await page.evaluate(()=>__sources),1,'Manual retry reuses completed dictionary candidates');
   report.checks.push({width,scenario,status:'passed'});await page.keyboard.press('Escape');
  }
  assert.deepEqual(errors,[]);await page.close();
 }
 report.status='passed';console.log(JSON.stringify(report));
}catch(error){report.error=error.stack;throw error;}finally{await browser?.close();await writeFile('test-results/context-failures-report.json',JSON.stringify(report,null,2));}
