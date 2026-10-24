import {test} from 'node:test';
import assert from 'node:assert/strict';
import {lookupCollins,parseCollinsPage,collinsSources} from '../src/collins.js';
const zh='<div class="dictionary biling"><span class="orth">unit</span><span class="pos">noun</span><span class="pron">test</span><span class="cit type-translation"><span class="quote">单位</span></span><script>bad()</script></div>';
const en='<div class="dictentry"><span class="orth">unit</span><span class="pos">noun</span><div class="def">A synthetic test definition for a single thing.</div><span class="cit type-example"><span class="quote">This sentence is an invented parser fixture.</span></span></div>';
test('Collins parser scopes public word entries and returns bounded text excerpts without executable markup',()=>{
 assert.equal(parseCollinsPage('<nav><span class="quote">wrong</span></nav>'+zh,'zh').zh,'单位');
 const result=parseCollinsPage(en,'en');assert.equal(result.definition,'A synthetic test definition for a single thing.');
 assert.ok((result.definition+' '+result.example).split(/\s+/).length<=25);
 assert.throws(()=>parseCollinsPage('<h1>Please sign in</h1>','en'),/官网/);
 assert.throws(()=>collinsSources('https://other.test/private'));
 assert.ok(collinsSources('studying').every(url=>url.endsWith('/study')));
});
test('Collins provider requires consent, makes only the two exact word requests, and labels both sources',async()=>{
 const calls=[];const fetcher=async(url,options)=>{calls.push({url,options});return new Response(url.includes('english-chinese')?zh:en);};
 await assert.rejects(lookupCollins('unit',{fetcher}),e=>e.code==='ONLINE_REQUIRED');assert.equal(calls.length,0);
 const result=await lookupCollins('unit',{online:true,fetcher});assert.equal(result.zh,'单位');assert.equal(result.kind,'collins');assert.equal(calls.length,2);assert.ok(result.sourceUrls.every(url=>url.startsWith('https://www.collinsdictionary.com/dictionary/')));
 assert.ok(calls.every(c=>c.options.credentials==='omit'&&c.options.referrerPolicy==='no-referrer'));
});
test('Collins access restrictions stop requests and retain official source links',async()=>{
 let calls=0;await assert.rejects(lookupCollins('unit',{online:true,fetcher:async()=>{calls++;return new Response('Access denied',{status:403});}}),e=>e.code==='COLLINS_ACCESS_DENIED'&&e.upstreamStatus===403&&e.sourceUrls.length===2);assert.equal(calls,1);
});
test('a missing English page preserves the Collins Chinese excerpt with an explicit partial result',async()=>{
 const result=await lookupCollins('unit',{online:true,fetcher:async url=>url.includes('english-chinese')?new Response(zh):new Response('',{status:503})});
 assert.equal(result.zh,'单位');assert.deepEqual(result.definitions,[]);assert.match(result.source,/英文解释暂不可用/);
 assert.equal(result.partial,true);assert.equal(result.englishError.upstreamStatus,503);assert.match(result.englishError.message,/503/);
});
test('Collins timeout remains bounded through body reading and oversized pages are rejected',async()=>{
 await assert.rejects(lookupCollins('unit',{online:true,timeoutMs:10,fetcher:async()=>new Response(new ReadableStream({start(){}}))}),/超时/);
 await assert.rejects(lookupCollins('unit',{online:true,fetcher:async()=>new Response('x',{headers:{'content-length':String(1024*1024+1)}})}),/响应过大/);
});
test('Collins cookies are opt-in and only included for official-origin requests',async()=>{
 const calls=[];const fetcher=async(url,options)=>{calls.push({url,options});return new Response(url.includes('english-chinese')?zh:en);};
 await lookupCollins('unit',{online:true,useSession:true,fetcher});
 assert.equal(calls.length,2);assert.ok(calls.every(c=>c.options.credentials==='include'&&new URL(c.url).origin==='https://www.collinsdictionary.com'));
 const {readPage}=await import('../src/collins.js');let mode;
 await readPage('https://dict.youdao.com/w/eng/unit/',{useSession:true,fetcher:async(url,options)=>{mode=options.credentials;return new Response('test');}});assert.equal(mode,'omit');
 let count=0;await assert.rejects(lookupCollins('unit',{online:true,fetcher:async()=>{count++;return new Response('',{status:403});}}),e=>e.code==='COLLINS_ACCESS_DENIED');assert.equal(count,1);
});
test('official Chinese redirects determine the English headword so listed and list are never mixed',async()=>{
 const calls=[];const fetcher=async url=>{calls.push(url);if(url.includes('english-chinese'))return new Response(zh.replace('>unit<','>list<'));assert.ok(url.endsWith('/english/list'));return new Response(en.replace('>unit<','>list<'));};
 const result=await lookupCollins('listed',{online:true,fetcher});assert.equal(result.word,'list');assert.equal(result.lemma,'list');assert.equal(result.original,'listed');assert.match(result.morphology,/listed.*list/);assert.equal(calls.length,2);assert.ok(result.sourceUrls[1].endsWith('/english/list'));
 const mismatch=await lookupCollins('unit',{online:true,fetcher:async url=>new Response(url.includes('english-chinese')?zh:en.replace('>unit<','>different<'))});assert.deepEqual(mismatch.definitions,[]);assert.equal(mismatch.englishError.code,'COLLINS_HEADWORD_MISMATCH');
});
test('an English-page access denial remains visible without discarding the available Chinese entry or retrying the denial',async()=>{
 const calls=[];const result=await lookupCollins('unit',{online:true,fetcher:async url=>{calls.push(url);return url.includes('english-chinese')?new Response(zh):new Response('',{status:403});}});
 assert.equal(calls.length,2);assert.equal(result.zh,'单位');assert.equal(result.partial,true);assert.equal(result.englishError.code,'COLLINS_ACCESS_DENIED');assert.equal(result.englishError.upstreamStatus,403);
});
