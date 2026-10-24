import {test} from 'node:test';
import assert from 'node:assert/strict';
import {lookupCollinsClient} from '../src/dictionary-client.js';
import {createPreviewWorker} from '../scripts/preview-worker.mjs';

test('preview preserves a real upstream rejection through its HTTP error response and reader client',async()=>{
 const worker=createPreviewWorker({},{dictionary:async()=>{throw Object.assign(Error('Collins 官网拒绝了当前查询连接（HTTP 403），请打开官网查看。'),{code:'COLLINS_ACCESS_DENIED',upstreamStatus:403});}});
 let requests=0;
 const fetcher=async path=>{requests++;return worker.fetch(new Request('https://preview.test'+path));};
 await assert.rejects(lookupCollinsClient('ocean',{online:true,fetcher}),error=>error.code==='COLLINS_ACCESS_DENIED'&&error.upstreamStatus===403&&/HTTP 403/.test(error.message)&&error.sourceUrls.length===3);
 assert.equal(requests,1);
});
test('dictionary client reads a successful real-shaped result and never requests without consent',async()=>{
 let requests=0;const data={word:'ocean',zh:'海洋',kind:'collins'};
 const fetcher=async()=>{requests++;return Response.json({ok:true,data});};
 await assert.rejects(lookupCollinsClient('ocean',{fetcher}),error=>error.code==='ONLINE_REQUIRED');
 assert.equal(requests,0);
 assert.deepEqual(await lookupCollinsClient('study',{online:true,fetcher}),data);
});
