// Local shared reader + real Youdao source via a test-only Python bridge +
// real Workers AI using native browser fetch. No installed-extension evidence.
import {chromium} from 'playwright';
import {build} from 'esbuild';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {lookupCollinsBilingual} from '../../src/collins-bilingual.js';
import {sourceState} from '../../scripts/build-evidence.mjs';
import {youdaoTransport} from './youdao-transport.mjs';
import {fileURLToPath} from 'node:url';
import {contextSamples as samples,assertContextGloss} from './context-gloss-cases.mjs';
import {CONTEXT_VALIDATION_REASONS} from '../../src/context-meaning.js';
await mkdir('test-results',{recursive:true});
const sourceRoot=fileURLToPath(new URL('../..',import.meta.url)),pkg=JSON.parse(await readFile(new URL('../../package.json',import.meta.url)));
const optionalDictionary=new Set(samples.filter(s=>s[4]==='optional').map(s=>s[0]));
const report={startedAt:new Date().toISOString(),activePhase:'browser-launch',kind:'candidate shared reader with real Collins source and real browser AI requests',nativeExtensionInstalled:false,published:false,version:pkg.version,source:sourceState({cwd:sourceRoot}),dictionaryTransport:'test-only Python bridge; product transport is unchanged',dictionaryMemoization:'complete Collins entries only; missing/partial entries are fetched again, not cached',status:'failed',samples:[],dictionaryEntries:[],dictionaryResponses:[],contextInputs:[],contextResponses:[],contextNetworkFailures:[]};
let browser;const responseJobs=[];
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||'/usr/bin/chromium'});
 report.activePhase='reader-build';
 const code=await build({stdin:{resolveDir:sourceRoot,contents:`import {mountReader} from './src/reader.js';import {createStore,DEFAULT_PREFS} from './src/storage.js';import {createContextClient} from './src/context-meaning.js';const data={prefs:{...DEFAULT_PREFS,enabled:false,mode:'original',words:true}},store=createStore({get:async k=>data[k],set:async(k,v)=>data[k]=structuredClone(v)}),context=createContextClient();globalThis.__store=store;globalThis.__reader=mountReader({root:document.querySelector('main'),store,transport:async(type,word,_online,options)=>{if(type==='context')return context(options.context,options);options.signal?.throwIfAborted();const result=await __dictionary(word);options.signal?.throwIfAborted();return result;}});`},bundle:true,format:'iife',write:false});
 const page=await browser.newPage({viewport:{width:1100,height:850}}),errors=[],entries=new Map();let contextRequests=0;
 page.on('request',r=>{if(r.url().endsWith('/meaning')&&r.method()==='POST'){contextRequests++;const data=r.postDataJSON();report.contextInputs.push({word:data.word,sentence:data.sentence,offset:data.offset,candidateCount:data.senses.length});}});
 page.on('pageerror',e=>errors.push(e.message));
 page.on('requestfailed',r=>{if(r.url().endsWith('/meaning'))report.contextNetworkFailures.push(r.failure()?.errorText||'unknown');});
 page.on('response',response=>{
  if(!response.url().endsWith('/meaning')||response.request().method()!=='POST')return;
  const record={httpStatus:response.status()};report.contextResponses.push(record);
  responseJobs.push(response.json().then(body=>Object.assign(record,{ok:body.ok,error:body.error,code:body.code,...(body.code==='CONTEXT_INVALID_RESULT'?{validationReason:CONTEXT_VALIDATION_REASONS.includes(body.validationReason)?body.validationReason:'unknown'}:{})})).catch(error=>{record.readError=error.message;}));
 });
 page.setDefaultTimeout(25000);
 await page.exposeFunction('__dictionary',async word=>{
  if(!entries.has(word))entries.set(word,lookupCollinsBilingual(word,{online:true,fetcher:async(url,options)=>{
   const response=await youdaoTransport(url,options),html=await response.clone().text();report.dictionaryResponses.push({word,url,status:response.status,collinsSectionPresent:html.includes('collinsResult')});return response;
  }}).then(result=>{report.dictionaryEntries.push({word,kind:result.kind,senses:result.senses?.length||0,partial:result.partial===true});if(result.kind!=='collins'||result.partial)entries.delete(word);return result;}).catch(error=>{entries.delete(word);throw error;}));
  const result=await entries.get(word);
  if(optionalDictionary.has(word)&&result.kind==='unavailable'){
   const responses=report.dictionaryResponses.filter(r=>r.word===word);assert.ok(responses.length&&responses.every(r=>r.status===200&&!r.collinsSectionPresent),'AI-only coverage needs confirmed source absence, not a network failure');assert.deepEqual(result.senses,[]);
  }else assert.equal(result.kind,'collins',word+': live source has no usable Collins entry');return result;
 });
 // Load the allowed origin but evaluate local candidate code, not the published app.
 report.activePhase='published-origin';
 await page.route('**/*.js',route=>route.abort());
 await page.goto('https://v04-preview.lextide.pages.dev/',{waitUntil:'domcontentloaded'});
 await page.setContent('<main style="padding:60px;font:22px/2 Georgia"></main>');
 await page.evaluate(code.outputFiles[0].text);await page.evaluate(()=>__reader.ready);
 report.activePhase='live-samples';
 const card=()=>page.evaluate(()=>({zh:__reader.shadow.querySelector('.zh').textContent,status:__reader.shadow.querySelector('.sense-status').textContent,label:__reader.shadow.querySelector('.dictionary-label').textContent,source:__reader.shadow.querySelector('.zh-source').textContent,retryVisible:!__reader.shadow.querySelector('#retry').hidden}));
 for(const [word,sentence,expected,occurrence=0,_dictionary,forbidden]of samples){
  let at=-1;for(let i=0;i<=occurrence;i++)at=sentence.indexOf(word,at+1);
  const started=Date.now(),sample={word,sentence,occurrence,expectedOffset:at,passed:false};report.samples.push(sample);
  try{
   assert.ok(at>=0,'test target occurrence must exist');const before=contextRequests;
   await page.evaluate(({word,sentence,at})=>{const p=document.createElement('p'),b=document.createElement('b');b.id='sample-word';b.textContent=word;p.append(sentence.slice(0,at),b,sentence.slice(at+word.length));document.querySelector('main').replaceChildren(p);},{word,sentence,at});
   await page.locator('#sample-word').click();
   await page.waitForFunction(()=>__reader.shadow.querySelector('.sense-status').textContent.startsWith('此处含义')||__reader.shadow.querySelector('.sense-status').textContent==='按原句匹配的词典义项'||!__reader.shadow.querySelector('#retry').hidden,{},{timeout:24000});
   Object.assign(sample,await card());
   sample.initialElapsedMs=Date.now()-started;
   assert.ok(sample.status.startsWith('此处含义')||sample.status==='按原句匹配的词典义项',word+': contextual analysis did not succeed');if(sample.status==='按原句匹配的词典义项'){assert.match(sample.label,/Collins/);assert.match(sample.source,/^Collins 词典原义；AI/);assert.ok(await page.locator('lextide-reader #sense-choice').inputValue());}
   assertContextGloss(sample.zh,{expected,forbidden});assert.match(sample.source,/AI/);
   assert.equal(contextRequests,before+1,'a new occurrence needs its own context request');const input=report.contextInputs.at(-1);assert.deepEqual({word:input.word,sentence:input.sentence,offset:input.offset},{word,sentence,offset:at});sample.exactOccurrenceVerified=true;
   sample.dictionaryKind=report.dictionaryEntries.find(entry=>entry.word===word).kind;
   if(sample.dictionaryKind==='unavailable'){assert.equal(input.candidateCount,0);assert.match(sample.label,/^AI · 语境释义$/);assert.match(sample.source,/^Collins 暂无可用义项；此处由 AI/);sample.aiOnlyCorrectlyLabeled=true;}
   await page.locator('lextide-reader #save').click();await page.waitForFunction(()=>__reader.shadow.querySelector('#save').textContent==='已收藏');
   const repeatStarted=Date.now();
   await page.keyboard.press('Escape');await page.locator('#sample-word').click();await page.waitForFunction(()=>__reader.shadow.querySelector('.sense-status').textContent.startsWith('此处含义')||__reader.shadow.querySelector('.sense-status').textContent==='按原句匹配的词典义项');
   assert.equal(contextRequests,before+1,'repeating this exact occurrence must use context cache');assert.equal((await card()).zh,sample.zh);await page.waitForFunction(()=>__reader.shadow.querySelector('#save').textContent==='已收藏');sample.repeatUsedContextCache=true;sample.repeatElapsedMs=Date.now()-repeatStarted;
   assert.equal(await page.locator('main').textContent(),sentence);sample.passed=true;
  }catch(error){sample.error=error.message;Object.assign(sample,await card());}
  sample.elapsedMs=Date.now()-started;console.log(JSON.stringify(sample));
  await page.keyboard.press('Escape');await writeFile('test-results/live-reader-context.json',JSON.stringify(report,null,2));
 }
 report.contextRequests=contextRequests;report.savedUses=(await page.evaluate(()=>__store.words())).length;
 assert.equal(report.samples.filter(s=>s.passed).length,samples.length,'Every live sample must pass; individual failures remain recorded');
 await page.locator('#sample-word').click();await page.waitForFunction(()=>__reader.shadow.querySelector('.sense-status').textContent.startsWith('此处含义')||__reader.shadow.querySelector('.sense-status').textContent==='按原句匹配的词典义项');
 assert.equal(contextRequests,samples.length,'Same context repeat must not send another AI request');assert.equal(await page.locator('lextide-reader #save').textContent(),'已收藏');report.repeatUsedContextCache=true;
 const words=await page.evaluate(()=>__store.words());assert.equal(words.length,samples.length);assert.equal(words.filter(w=>w.lemma==='bank').length,2);assert.equal(words.filter(w=>w.word==='hugging').length,1);
 for(const word of ['wound','tear','bass'])assert.equal(words.filter(w=>w.word===word).length,samples.filter(s=>s[0]===word).length,'distinct same-sentence meanings must remain separate favorites');
 for(const w of words){const sample=report.samples.find(s=>s.word===w.word&&s.sentence===w.sentence&&s.zh===w.zh);assert.ok(sample);if(sample.status==='按原句匹配的词典义项')assert.match(w.dictionarySource,/Collins/);else assert.ok(w.dictionarySource.startsWith('AI 语境释义'));}assert.deepEqual(errors,[]);
 report.status='passed';report.activePhase='complete';console.log(JSON.stringify({status:report.status,samples:report.samples.length,nativeExtensionInstalled:false}));
}catch(error){report.error=error.stack;throw error;}
finally{await Promise.allSettled(responseJobs);try{await browser?.close();}catch(error){report.cleanupError=error.message;report.status='failed';process.exitCode=1;}report.finishedAt=new Date().toISOString();await writeFile('test-results/live-reader-context.json',JSON.stringify(report,null,2));}
