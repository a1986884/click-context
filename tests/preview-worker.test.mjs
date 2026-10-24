import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createPreviewWorker} from '../scripts/preview-worker.mjs';

test('preview serves exact public files, binary data, HEAD and security headers',async()=>{
 const text='词汐 preview',bytes=Buffer.from([0,127,128,255]);
 const worker=createPreviewWorker({'/index.html':{type:'text/html; charset=utf-8',base64:Buffer.from(text).toString('base64')},'/icon.png':{type:'image/png',base64:bytes.toString('base64')}});
 const get=await worker.fetch(new Request('https://preview.test/?v=1'));
 assert.equal(await get.text(),text);assert.equal(get.headers.get('Content-Length'),String(Buffer.byteLength(text)));
 assert.match(get.headers.get('Content-Security-Policy'),/frame-ancestors 'none'/);
 assert.equal(get.headers.get('Content-Security-Policy').split(';').map(s=>s.trim()).find(s=>s.startsWith('connect-src ')),"connect-src 'self' https://lextide-context.aa1986884.workers.dev");
 assert.equal(get.headers.get('Cache-Control'),'no-store');assert.equal(get.headers.get('X-Content-Type-Options'),'nosniff');
 const head=await worker.fetch(new Request('https://preview.test/',{method:'HEAD'}));assert.equal(await head.text(),'');assert.equal(head.headers.get('Content-Length'),get.headers.get('Content-Length'));
 const image=await worker.fetch(new Request('https://preview.test/icon.png'));assert.deepEqual(Buffer.from(await image.arrayBuffer()),bytes);
 for(const path of ['/missing','/toString','/.git/config','/src/../.env'])assert.equal((await worker.fetch(new Request('https://preview.test'+path))).status,404);
 assert.equal((await worker.fetch(new Request('https://preview.test/%ZZ'))).status,400);
 const post=await worker.fetch(new Request('https://preview.test/',{method:'POST'}));assert.equal(post.status,405);assert.equal(post.headers.get('Allow'),'GET, HEAD');
});
