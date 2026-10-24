// Capture actual built UI with synthetic Chrome metadata. No extension install
// and no live dictionary/provider acceptance; existing browser suites verify behavior.
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium} from 'playwright';
import worker from '../build/pages-preview/_worker.js';
const root=resolve('build/extension'),version=JSON.parse(await readFile('package.json')).version;
const server=createServer(async(req,res)=>{try{
 if(req.url.startsWith('/extension/')){const file=resolve(root,req.url.slice('/extension/'.length));if(!file.startsWith(root+'/'))throw Error('invalid path');res.setHeader('Content-Type',{'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png'}[extname(file)]||'application/octet-stream');res.end(await readFile(file));return;}
 const r=await worker.fetch(new Request('http://localhost'+req.url));res.writeHead(r.status,Object.fromEntries(r.headers));res.end(Buffer.from(await r.arrayBuffer()));
}catch{res.writeHead(404);res.end();}}).listen(0,'127.0.0.1');await new Promise(r=>server.on('listening',r));
let browser;const report={version,kind:'UI captures with synthetic Chrome state; no installed extension or live provider verification',nativeExtensionInstalled:false,liveProviderRequests:0,checks:[]};
try{
 await mkdir('docs/images',{recursive:true});await mkdir('test-results',{recursive:true});browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||'/usr/bin/chromium'});const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.hostname!=='127.0.0.1'){report.liveProviderRequests++;return route.abort();}return route.continue();});
 await page.addInitScript(version=>{const event={addListener(){}};globalThis.chrome={runtime:{id:'ui-fixture',getManifest:()=>({version}),getURL:p=>location.origin+'/extension/'+p,sendMessage:async m=>({ok:true,data:m.type==='engines:get'?{schema:1,body:'builtin',selection:'builtin',profiles:[]}:{supported:true,running:true,authorized:true,hostname:'example.org · 界面示意',pattern:'https://example.org/*',remembered:false,paused:false,excluded:false,prefs:{enabled:false,mode:'original',words:true}}})},tabs:{query:async()=>[{id:1,url:'https://example.org/article'}],onActivated:event,onUpdated:event,create:async()=>{}},storage:{onChanged:event},permissions:{request:async()=>false}};},version);
 const origin='http://127.0.0.1:'+server.address().port;
 for(const [width,height,file] of [[1440,1000,'overview'],[390,1000,'overview-mobile']]){await page.setViewportSize({width,height});await page.goto(origin,{waitUntil:'networkidle'});if(!await page.locator('h1').filter({hasText:'点一下单词'}).count()||!await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))throw Error('home layout invalid');await page.screenshot({path:'docs/images/'+file+'.png'});report.checks.push(file);}
 await page.setViewportSize({width:352,height:900});await page.goto(origin+'/extension/popup.html');await page.waitForFunction(()=>!document.querySelector('#controls').disabled);await page.screenshot({path:'docs/images/toolbar.png',fullPage:true});await page.emulateMedia({colorScheme:'dark'});await page.screenshot({path:'test-results/toolbar-dark.png',fullPage:true});await page.emulateMedia({colorScheme:'light'});report.checks.push('toolbar light/dark with synthetic state');
 await page.setViewportSize({width:1100,height:900});await page.goto(origin+'/extension/engines.html');await page.waitForFunction(()=>!document.querySelector('#controls').disabled);await page.screenshot({path:'docs/images/engine-settings.png',fullPage:true});if(errors.length||report.liveProviderRequests)throw Error('unexpected browser error or external request');report.checks.push('engine settings with no configured credentials');report.status='passed';console.log(JSON.stringify(report));
}finally{await browser?.close();await new Promise(r=>server.close(r));await writeFile('test-results/ui-captures.json',JSON.stringify(report,null,2));}
