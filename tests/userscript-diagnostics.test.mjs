import {DOMParser} from 'linkedom';
import {dictionaryFixtures} from './fixtures/dictionary-html.mjs';
globalThis.DOMParser=DOMParser;
const sourceHTML=dictionaryFixtures[0].html.replaceAll('bank','class');
import test from 'node:test';
import assert from 'node:assert/strict';
import {createConnectionDiagnostics,diagnosticCapabilities} from '../userscript/diagnostics.js';
test('diagnostic capabilities expose a whitelist, not manager or page secrets',()=>{
 const report=diagnosticCapabilities({scriptHandler:'Tampermonkey',version:'5.6.6239',apiKey:'private-key',script:{textContent:'private-original'},url:'https://private.example/?token=secret'});assert.equal(report.customAPIRedirectSupported,true);assert.doesNotMatch(JSON.stringify(report),/private|secret/);assert.equal(diagnosticCapabilities({scriptHandler:'private-manager-secret',version:'private-key'}).manager,'unknown');
});
test('diagnostics make only four explicit fixed public checks, no inference or user API request',async()=>{
 const calls=[];const diagnostics=createConnectionDiagnostics({info:{scriptHandler:'Tampermonkey',version:'5.6.6239'},now:()=> 'fixed-test-time',fetcher:async(url,options)=>{calls.push({url,options});return url.includes('dict.youdao.com')?new Response(sourceHTML):url.includes('/api/dictionary')?Response.json({ok:true,data:{senses:[{},{}]}}):new Response('{}',{status:400});}});
 assert.equal(calls.length,0);diagnostics.capabilities();assert.equal(calls.length,0);const report=await diagnostics.run();assert.equal(calls.length,4);assert.equal(report.allReachable,true);assert.equal(report.checkedAt,'fixed-test-time');for(const c of calls){assert.match(c.url,/^https:\/\/(?:dict\.youdao\.com|lextide-context\.aa1986884\.workers\.dev|v04-preview\.lextide\.pages\.dev)\//);assert.equal(c.options.headers?.Authorization,undefined);if(c.options.method==='POST')assert.equal(c.options.body,'{}');}assert.equal(report.checks[3].dictionarySenses,2);
});
test('diagnostics classify denied, rate limit, missing dictionary without copying raw service output',async()=>{
 const diagnostics=createConnectionDiagnostics({fetcher:async url=>url.endsWith('/meaning')?new Response('private-key',{status:403}):url.endsWith('/translate')?new Response('private-original',{status:429}):Response.json({ok:false,error:'private-key'})});const report=await diagnostics.run();assert.equal(report.allReachable,false);assert.deepEqual(report.checks.map(r=>r.status),['denied','rate-limited','dictionary-unavailable','dictionary-unavailable']);assert.doesNotMatch(JSON.stringify(report),/private/);
});
test('diagnostics sanitize network errors and abort without returning a stale result',async()=>{
 const diagnostics=createConnectionDiagnostics({fetcher:async()=>{throw Error('private-host/path?key=secret');}});const report=await diagnostics.run();assert.ok(report.checks.every(c=>c.status==='network-error'));assert.doesNotMatch(JSON.stringify(report),/private|secret/);const controller=new AbortController();controller.abort();await assert.rejects(diagnostics.run({signal:controller.signal}),{name:'AbortError'});
});
test('a successful preview cannot hide a rejected direct dictionary source',async()=>{
 const calls=[];const diagnostics=createConnectionDiagnostics({fetcher:async url=>{calls.push(url);if(url.includes('dict.youdao.com'))return new Response('PRIVATE_SOURCE_RESPONSE',{status:403});return url.includes('/api/dictionary')?Response.json({ok:true,data:{senses:[{}]}}):new Response('{}',{status:400});}});
 const report=await diagnostics.run();assert.equal(report.allReachable,false);assert.equal(calls.length,4);assert.equal(report.checks.find(c=>c.name==='dictionary-source').status,'denied');assert.equal(report.checks.find(c=>c.name==='dictionary').status,'reachable');assert.doesNotMatch(JSON.stringify(report),/PRIVATE_SOURCE_RESPONSE/);
});

test('direct source HTTP 200 requires readable Collins senses for the fixed word',async()=>{
 for(const [html,expected]of [[sourceHTML,'reachable'],['<h1>Verification required</h1>','dictionary-unavailable'],[dictionaryFixtures[0].html,'dictionary-unavailable']]){
  const diagnostics=createConnectionDiagnostics({fetcher:async url=>url.includes('dict.youdao.com')?new Response(html):url.includes('/api/dictionary')?Response.json({ok:true,data:{senses:[{}]}}):new Response('{}',{status:400})});const report=await diagnostics.run();const direct=report.checks.find(c=>c.name==='dictionary-source');assert.equal(direct.status,expected);assert.equal(report.allReachable,expected==='reachable');assert.doesNotMatch(JSON.stringify(report),/Verification|required|fictional/);
 }
});
test('local request deadlines are reported as timeout without copying the manager error',async()=>{
 const diagnostics=createConnectionDiagnostics({fetcher:async()=>{throw Object.assign(Error('PRIVATE_MANAGER_ERROR'),{code:'REQUEST_TIMEOUT'});}});const report=await diagnostics.run();assert.equal(report.allReachable,false);assert.ok(report.checks.every(c=>c.status==='timeout'));assert.doesNotMatch(JSON.stringify(report),/PRIVATE_MANAGER_ERROR/);
});
