import {TRANSLATION_CACHE_VERSION} from '../src/translation-service.js';
import {test} from 'node:test';import assert from 'node:assert/strict';
import worker from '../workers/context/index.js';import {cleanTranslation,translationPrompt,parseTranslationResult,TRANSLATION_MODEL} from '../src/translation-service.js';import {createTranslationProvider} from '../src/providers.js';
const text='The difference was not statistically significant (p = 0.08); see Fig. 2.';
const request=(body={text},extra={})=>new Request('https://service.test/translate',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://v04-preview.lextide.pages.dev',...extra},body:JSON.stringify(body)});
const limits=()=>({limit:async()=>({success:true})});
const env=(run=async()=>({output:[{type:'reasoning',content:[{type:'reasoning_text',text:'HIDDEN_REASONING'}]},{type:'message',content:[{type:'output_text',text:'差异在统计学上并不显著（p = 0.08）；参见图2。'}]}]}))=>({AI:{run},TRANSLATION_IP:limits(),TRANSLATION_TOTAL:limits()});
test('translation prompt treats webpage text as data; only complete final output is accepted',()=>{
 assert.throws(()=>cleanTranslation({text:'a'.repeat(1801)}));assert.throws(()=>cleanTranslation({text:''}));const input=cleanTranslation({text});assert.equal(JSON.parse(translationPrompt(input).input).text,text);
 const parsed=parseTranslationResult({output:[{type:'reasoning',content:[{type:'reasoning_text',text:'秘密推理'}]},{type:'message',content:[{type:'output_text',text:'差异在统计学上并不显著（p = 0.08）；参见图2。'}]}]},input);assert.equal(parsed.model,TRANSLATION_MODEL);assert.doesNotMatch(parsed.text,/推理/);
 assert.throws(()=>parseTranslationResult({response:'差异显著，p = 0.8，参见图2。'},input));assert.throws(()=>parseTranslationResult({status:'incomplete',response:'差异不显著（p = 0.08），图2。'},input));assert.throws(()=>parseTranslationResult({response:'No translation.'},input));
 assert.equal(parseTranslationResult({response:'从12.5%降至8.0%。'},{text:'Reduced from 12.5% to 8.0%.'}).text,'从12.5%降至8.0%。');assert.throws(()=>parseTranslationResult({response:'从12,5%降至8.0%。'},{text:'Reduced from 12.5% to 8.0%.'}));
});
test('worker translation uses independent limits, forwards cancellation and never returns model reasoning',async()=>{
 let calls=0;const e=env(async(model,input,options)=>{calls++;assert.equal(model,TRANSLATION_MODEL);assert.ok(options.signal instanceof AbortSignal);assert.equal(JSON.parse(input.input).text,text);return {response:'差异在统计学上并不显著（p = 0.08）；参见图2。'};});const response=await worker.fetch(request(),e);assert.equal(response.status,200);assert.equal((await response.json()).data.provider,'cloudflare-ai');assert.equal(calls,1);
 e.TRANSLATION_IP={limit:async()=>({success:false})};const limited=await worker.fetch(request(),e);assert.equal(limited.status,429);assert.equal((await limited.json()).code,'RATE_LIMITED');assert.equal(calls,1);
 assert.equal((await worker.fetch(request({text}, {Origin:'https://evil.test'}),e)).status,403);assert.equal((await worker.fetch(request({text:'x'.repeat(1801)}),e)).status,400);
});
test('worker retries invalid model output at most once and fails without a fabricated translation',async()=>{
 let calls=0;const response=await worker.fetch(request(),env(async()=>{calls++;return {response:'错误的数字 p = 0.8。'};}));assert.equal(response.status,503);assert.equal(calls,2);const body=await response.json();assert.equal(body.code,'TRANSLATION_UNAVAILABLE');assert.equal(body.retryable,false);assert.equal(body.data,undefined);
 const c=new AbortController();c.abort();const aborted=new Request('https://service.test/translate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text}),signal:c.signal});calls=0;assert.equal((await worker.fetch(aborted,env(async()=>{calls++;}))).status,503);assert.equal(calls,0);
});
test('client preserves sentence boundaries in chunks, posts plain text and stops on service rate limit',async()=>{
 const calls=[],provider=createTranslationProvider({request:async(url,fetcher,options)=>{calls.push({url,...options});return {ok:true,data:{text:'中文译文',version:TRANSLATION_CACHE_VERSION}};}});const source='The estimate follows Eq. (3). '+('A careful observation supports the result. '.repeat(40));assert.match(await provider.translate(source),/中文译文/);assert.ok(calls.length>1);assert.ok(calls.every(c=>JSON.parse(c.body).text.length<=1200&&c.method==='POST'));assert.ok(JSON.parse(calls[0].body).text.includes('Eq. (3).'));
 let count=0;const limited=createTranslationProvider({request:async()=>{count++;return {ok:false,error:'请求过于频繁',code:'RATE_LIMITED',retryable:false};}});await assert.rejects(limited.translate(source),e=>e.code==='RATE_LIMITED'&&e.retryable===false);assert.equal(count,1);
});
