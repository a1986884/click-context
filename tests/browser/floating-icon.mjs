// Shared reader UI acceptance in Chromium; no native extension installation.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {chromium} from 'playwright';
import worker from '../../build/pages-preview/_worker.js';
const server=createServer(async(req,res)=>{const r=await worker.fetch(new Request('http://localhost'+req.url));res.writeHead(r.status,Object.fromEntries(r.headers));res.end(Buffer.from(await r.arrayBuffer()));}).listen(0,'127.0.0.1');
await new Promise(r=>server.on('listening',r));let browser;
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||'/usr/bin/chromium'});
 const page=await browser.newPage({viewport:{width:1100,height:800},hasTouch:true});let queries=0;const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/dictionary?*',r=>{queries++;return r.fulfill({json:{ok:true,data:{word:new URL(r.request().url()).searchParams.get('word'),lemma:new URL(r.request().url()).searchParams.get('word'),zh:'海洋',kind:'collins',definitions:['Synthetic fixture.']}}});});
 await page.goto(process.env.PREVIEW_URL||'http://127.0.0.1:'+server.address().port);
 const bubble=page.locator('lextide-reader .bubble'),panel=page.locator('lextide-reader .panel');await bubble.waitFor();
 const start=await bubble.boundingBox();await page.mouse.move(start.x+26,start.y+26);await page.mouse.down();await page.mouse.move(300,250,{steps:12});await page.mouse.up();
 assert.equal(await bubble.getAttribute('aria-pressed'),'true');assert.equal(await panel.isVisible(),false);
 let rect=await bubble.boundingBox();assert.ok(Math.abs(rect.x-274)<3&&Math.abs(rect.y-224)<3);
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('lextide:v2:prefs')).bubblePosition?.x>0);
 await page.reload();await bubble.waitFor();await page.waitForFunction(()=>document.querySelector('lextide-reader').style.left!=='');rect=await bubble.boundingBox();assert.ok(Math.abs(rect.x-274)<3&&Math.abs(rect.y-224)<3);
 await bubble.focus();await page.keyboard.press('ArrowRight');assert.ok((await bubble.boundingBox()).x>rect.x+8);
 await page.setViewportSize({width:390,height:844});rect=await bubble.boundingBox();assert.ok(rect.x>=12&&rect.x+rect.width<=378);
 // Chromium touch input creates real pointer capture and pointer cancellation.
 const cdp=await page.context().newCDPSession(page);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:rect.x+26,y:rect.y+26}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:1,y:100}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
 assert.equal(await bubble.getAttribute('aria-pressed'),'true');assert.ok((await bubble.boundingBox()).x>=12);
 await bubble.click({delay:620});assert.equal(await panel.isVisible(),true);await page.locator('lextide-reader .panel .close').click();
 await bubble.click();await page.waitForFunction(()=>document.querySelector('#article').dataset.lookupEnabled==='false');
 const word=page.locator('#article p [data-word]').filter({hasText:/^holds$/i}).last();await word.scrollIntoViewIfNeeded();
 assert.equal(await word.getAttribute('role'),null);assert.equal(await word.getAttribute('tabindex'),null);await word.hover();
 assert.equal(await word.evaluate(e=>getComputedStyle(e).backgroundColor),'rgba(0, 0, 0, 0)');assert.notEqual(await word.evaluate(e=>getComputedStyle(e).cursor),'pointer');
 await word.click();await word.dispatchEvent('keydown',{key:'Enter'});await word.dispatchEvent('keydown',{key:' '});assert.equal(queries,0);assert.equal(await page.locator('lextide-reader .dict').isVisible(),false);
 await page.locator('#article-select').selectOption('1');assert.equal(await page.locator('#article [data-word][role=button]').count(),0);
 await page.locator('#article-select').selectOption('0');await bubble.click();await page.waitForFunction(()=>document.querySelector('#article').dataset.lookupEnabled==='true');assert.equal(await word.getAttribute('role'),'button');await word.click();await page.locator('lextide-reader .zh').filter({hasText:'海洋'}).waitFor();assert.equal(queries,1);
 await page.keyboard.press('Escape');await bubble.click({delay:620});await page.locator('lextide-reader #reset-bubble').click();
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('lextide:v2:prefs')).bubblePosition===null);rect=await bubble.boundingBox();assert.ok(rect.x>300&&rect.y>750);
 assert.deepEqual(errors,[]);console.log('PASS: mouse/touch move, click suppression, long press, keyboard movement, persistence, viewport bounds, OFF words inert and ON restored (shared UI, fixture dictionary).');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
