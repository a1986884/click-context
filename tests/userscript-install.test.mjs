import test from 'node:test';
import assert from 'node:assert/strict';
import {createUserscriptInstallWorker} from '../scripts/userscript-install-worker.mjs';
const script='// ==UserScript==\n// @name         点击语境查词\n// @version      0.7.104\n// ==/UserScript==\nconsole.log("synthetic code");\n';
const worker=()=>createUserscriptInstallWorker({script,license:'Synthetic MIT fixture',release:{version:'0.7.104',scriptSHA256:'fixture',iPhoneAcceptancePassed:false}});
test('installer serves exact script/metadata with stable version and no-store headers',async()=>{
 const w=worker();const response=await w.fetch(new Request('https://install.test/click-context.user.js?check=1'));assert.equal(await response.text(),script);assert.match(response.headers.get('Content-Type'),/javascript/);assert.equal(response.headers.get('Cache-Control'),'no-store');assert.equal(response.headers.get('X-Click-Context-Version'),'0.7.104');
 const meta=await w.fetch(new Request('https://install.test/click-context.meta.js'));const text=await meta.text();assert.match(text,/@version\s+0\.7\.104/);assert.doesNotMatch(text,/console\.log/);assert.equal((await w.fetch(new Request('https://install.test/release.json'))).status,200);
});
test('installer homepage has no credential form, executable page script or external assets',async()=>{
 const response=await worker().fetch(new Request('https://install.test/'));const text=await response.text();assert.match(text,/安装用户脚本/);assert.doesNotMatch(text,/<(?:script|input|form|iframe|img)\b/i);assert.match(response.headers.get('Content-Security-Policy'),/default-src 'none'/);assert.match(text,/href="\/click-context\.user\.js"/);
});
test('installer handles HEAD, missing paths and unsupported methods without echoing input',async()=>{
 const w=worker(),head=await w.fetch(new Request('https://install.test/click-context.user.js',{method:'HEAD'}));assert.equal(await head.text(),'');assert.equal(Number(head.headers.get('Content-Length')),new TextEncoder().encode(script).byteLength);assert.equal((await w.fetch(new Request('https://install.test/private'))).status,404);assert.equal((await w.fetch(new Request('https://install.test/',{method:'POST',body:'PRIVATE_KEY'}))).status,405);
});
