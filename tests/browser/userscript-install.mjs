import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {USERSCRIPT_VERSION} from '../../userscript/version.js';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const {default:worker}=await import('../../build/userscript-install/worker.mjs');
const script=await readFile('build/userscript/click-context.user.js'),sha=createHash('sha256').update(script).digest('hex');
const published=process.env.USERSCRIPT_INSTALL_ORIGIN;
if(published&&published!=='https://click-context-install.aa1986884.workers.dev')throw Error('Unexpected public installer origin');
const report={version:USERSCRIPT_VERSION,kind:'ordinary browser installer page and exact download; no script manager or extension installed',location:published?'published':'local',scriptSHA256:sha,tampermonkeyInstalled:false,iPhoneTested:false,status:'failed',checks:[]};
const server=createServer(async(req,res)=>{try{const response=await worker.fetch(new Request('http://127.0.0.1'+req.url,{method:req.method}));res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));}catch{res.writeHead(500);res.end();}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin=published||'http://127.0.0.1:'+server.address().port;
await mkdir('test-results',{recursive:true});const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||'/usr/bin/chromium'});
try{
 for(const width of [390,1280]){const page=await browser.newPage({viewport:{width,height:900}}),errors=[],external=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(new URL(r.url()).origin!==origin)external.push(r.url());});const response=await page.goto(origin,{timeout:20000});assert.equal(response.status(),200);assert.match(await page.locator('header').textContent(),new RegExp(USERSCRIPT_VERSION.replaceAll('.','\\.')));assert.equal(await page.locator('a.button').getAttribute('href'),'/click-context.user.js');assert.equal(await page.locator('input,form,script').count(),0);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(external,[]);assert.deepEqual(errors,[]);await page.screenshot({path:`test-results/userscript-installer-${published?'published-':''}${width}.png`,fullPage:true});await page.close();report.checks.push({width,passed:true,externalRequests:0});}
 if(published){
  const run=promisify(execFile),get=async path=>{const {stdout}=await run('curl',['--silent','--show-error','--max-time','20',origin+path],{maxBuffer:4*1024*1024});return stdout;};
  assert.equal(createHash('sha256').update(await get('/click-context.user.js')).digest('hex'),sha);const text=await get('/click-context.meta.js');assert.match(text,/@updateURL\s+https:\/\/click-context-install\.aa1986884\.workers\.dev\/click-context\.meta\.js/);assert.doesNotMatch(text,/function mountReader/);const release=JSON.parse(await get('/release.json'));assert.equal(release.version,USERSCRIPT_VERSION);assert.equal(release.scriptSHA256,sha);report.downloadTransport='curl public HTTP';
  const {stdout:headers}=await run('curl',['--silent','--show-error','--head','--max-time','20',origin+'/click-context.user.js']);assert.match(headers,/content-type:\s*application\/javascript/i);assert.match(headers,/cache-control:\s*no-store/i);assert.ok(headers.toLowerCase().includes('x-click-context-version: '+USERSCRIPT_VERSION));
 }else{
  const context=await browser.newContext();const response=await context.request.get(origin+'/click-context.user.js');assert.equal(createHash('sha256').update(await response.body()).digest('hex'),sha);assert.match(response.headers()['content-type'],/javascript/);assert.equal(response.headers()['cache-control'],'no-store');const meta=await context.request.get(origin+'/click-context.meta.js');assert.match(await meta.text(),/@updateURL\s+https:\/\/click-context-install\.aa1986884\.workers\.dev\/click-context\.meta\.js/);assert.doesNotMatch(await meta.text(),/function mountReader/);await context.close();
 }
 report.checks.push('download bytes match generated artifact; metadata-only update route and correct headers');report.status='passed';
}catch(e){report.error=e.stack;throw e;}finally{await browser.close();await new Promise(resolve=>server.close(resolve));await writeFile('test-results/userscript-install-'+(published?'published-':'')+'report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
