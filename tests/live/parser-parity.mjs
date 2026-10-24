// On-demand live provider acceptance. No downloaded HTML is saved or shipped.
// The production offscreen handler runs in an ordinary page with a messaging shim;
// this is not evidence that an extension was installed or chrome.offscreen ran.
import {chromium} from 'playwright';import {createServer} from 'node:http';import {readFile,mkdir,writeFile} from 'node:fs/promises';import assert from 'node:assert/strict';
import {lookupCollinsBilingual} from '../../src/collins-bilingual.js';import {youdaoTransport} from './youdao-transport.mjs';
await mkdir('test-results',{recursive:true});const report={kind:'live Youdao HTML: linkedom vs production DOMParser handler and full lookup result',nativeExtensionInstalled:false,published:false,status:'failed',queries:[],unexpectedNetwork:[]};
const server=createServer(async(req,res)=>{try{const file=req.url==='/offscreen.html'?'offscreen.html':req.url==='/offscreen.js'?'offscreen.js':null;if(!file){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',file.endsWith('.html')?'text/html':'application/javascript');res.end(await readFile('build/extension/'+file));}catch{res.writeHead(500);res.end();}}).listen(0,'127.0.0.1');await new Promise(resolve=>server.on('listening',resolve));let browser;
try{browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||'/usr/bin/chromium'});const page=await browser.newPage();const pageErrors=[];page.on('pageerror',e=>pageErrors.push(e.message));await page.addInitScript(()=>{globalThis.chrome={runtime:{id:'live-parity',onMessage:{addListener(fn){globalThis.__parseMessage=fn;}}}};});page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:'))report.unexpectedNetwork.push(r.url());});await page.goto('http://127.0.0.1:'+server.address().port+'/offscreen.html');await page.waitForFunction(()=>typeof __parseMessage==='function');
 for(const word of ['bank','available','listed','hugging','carry out']){
  const responses=new Map();let nativeParses=0;
  const fetcher=async(url,options)=>{options.signal?.throwIfAborted();if(!responses.has(url))responses.set(url,youdaoTransport(url,options).then(async r=>({status:r.status,html:await r.text()})));const data=await responses.get(url);options.signal?.throwIfAborted();return new Response(data.html,{status:data.status,headers:{'Content-Type':'text/html'}});};
  // Fetch each source at most once; both parser paths see identical bytes.
  const expected=await lookupCollinsBilingual(word,{online:true,fetcher});
  const actual=await lookupCollinsBilingual(word,{online:true,fetcher,parseHTML:async(html,kind,{phrase,signal}={})=>{signal?.throwIfAborted();nativeParses++;const result=await page.evaluate(message=>new Promise(resolve=>__parseMessage(message,{id:'live-parity'},resolve)),{type:'lextide:parse-html',html,kind,phrase});signal?.throwIfAborted();if(!result.ok)throw Object.assign(Error(result.error),{code:result.code});return result.data;}});
  assert.deepEqual(actual,expected,word+': full lookup results differ');assert.equal(actual.kind,'collins',word+': no usable Collins entry');assert.ok(actual.senses?.length,word+': missing senses');
  const partsOfSpeech=[...new Set(actual.senses.map(s=>s.pos))];if(word==='bank')assert.ok(partsOfSpeech.length>=2,'bank must cover multiple parts of speech');if(word==='carry out')assert.equal(actual.lemma,'carry out');
  report.queries.push({word,lemma:actual.lemma,senseCount:actual.senses.length,partsOfSpeech,sourceRequests:responses.size,nativeParses,equal:true});
 }
 assert.deepEqual(pageErrors,[]);assert.deepEqual(report.unexpectedNetwork,[]);report.status='passed';console.log(JSON.stringify(report));
}catch(error){report.error=error.stack;throw error;}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));await writeFile('test-results/live-parser-parity.json',JSON.stringify(report,null,2));}
