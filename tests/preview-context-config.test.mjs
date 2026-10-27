import {test} from 'node:test';import assert from 'node:assert/strict';
import {previewContextEndpoint,previewConnectOrigins,configurePreviewContextFiles,DEFAULT_PREVIEW_CONTEXT_ORIGIN} from '../scripts/preview-context-config.mjs';
import {createPreviewWorker} from '../scripts/preview-worker.mjs';
const endpoint='https://click-context-accuracy-145.aa1986884.workers.dev/meaning',origin=new URL(endpoint).origin;
test('test preview endpoints reject credentials, nonpublic hosts and CSP injection',()=>{
 assert.equal(previewContextEndpoint(endpoint),endpoint);assert.equal(previewContextEndpoint(undefined),null);
 for(const value of ['http://example.workers.dev/meaning','https://127.0.0.1/meaning','https://example.com/meaning','https://user:password@a.b.workers.dev/meaning',endpoint+'?secret=x',endpoint+'#x',origin+':8443/meaning',origin+'/translate',origin+"; connect-src *"] )assert.throws(()=>previewContextEndpoint(value));
 assert.throws(()=>previewConnectOrigins(origin+"; script-src *"));
});
test('independent preview configuration changes only page routing and displays the candidate version',()=>{
 const html='<html><head><meta http-equiv="Content-Security-Policy" content="connect-src '+DEFAULT_PREVIEW_CONTEXT_ORIGIN+'"></head><body>Article</body></html>';
 const files={'/index.html':{type:'text/html',base64:Buffer.from(html).toString('base64')},'/mobile-reader.html':{type:'text/html',base64:Buffer.from(html).toString('base64')},'/icon.png':{type:'image/png',base64:'AAE='}},binary=structuredClone(files['/icon.png']);
 const context=configurePreviewContextFiles(files,{endpoint,candidateVersion:'0.7.145'});assert.deepEqual(context,{contextOrigin:origin,contextEndpoint:endpoint});
 for(const name of ['/index.html','/mobile-reader.html']){const result=Buffer.from(files[name].base64,'base64').toString();assert.match(result,/click-context-endpoint/);assert.ok(result.includes('content="'+endpoint+'"'));assert.ok(result.includes('0.7.145（候选）'));assert.ok(result.includes(previewConnectOrigins(origin)));}
 assert.deepEqual(files['/icon.png'],binary);
});
test('normal preview builds keep their default routing',()=>{
 const files={'/index.html':{base64:'dGVzdA=='}},before=structuredClone(files);configurePreviewContextFiles(files,{candidateVersion:'0.7.145'});assert.deepEqual(files,before);assert.equal(previewConnectOrigins(),DEFAULT_PREVIEW_CONTEXT_ORIGIN);
});
test('the test preview response permits the isolated context origin without relaxing other CSP directives',async()=>{
 const worker=createPreviewWorker({'/index.html':{type:'text/html',base64:'dGVzdA=='}},{contextOrigin:origin});
 const response=await worker.fetch(new Request('https://123abc.lextide.pages.dev/')),policy=response.headers.get('Content-Security-Policy');
 assert.ok(policy.includes("connect-src 'self' "+DEFAULT_PREVIEW_CONTEXT_ORIGIN+' '+origin+';'));assert.ok(policy.includes("script-src 'self';"));assert.ok(policy.includes("frame-ancestors 'none';"));assert.ok(!policy.includes(' *'));
});
