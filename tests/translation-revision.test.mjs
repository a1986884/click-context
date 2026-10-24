import {TRANSLATION_CACHE_VERSION} from '../src/translation-service.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createStore,CACHE_BUCKETS} from '../src/storage.js';
import {createTranslationProvider} from '../src/providers.js';
import worker from '../workers/context/index.js';
const revision=TRANSLATION_CACHE_VERSION;
test('old condition translations are not reused after the prompt revision; vocabulary and preferences remain',async()=>{
 const text='The estimate is valid only if the observations are independent.',at=1000,legacy='cloudflare-ai:en-zh:v1|'+text,words=[{word:'bank',lemma:'bank',zh:'银行'}],prefs={enabled:false,mode:'original',words:true};
 const data=new Map([['words',structuredClone(words)],['prefs',structuredClone(prefs)]]);
 for(let i=0;i<CACHE_BUCKETS;i++)data.set('translation-cache:v3:'+i,{[legacy]:{at,value:'只要观察值独立，估计才是有效的。'},['cloudflare-ai:en-zh:v2|'+text]:{at,value:'上一修订译文'},['cloudflare-ai:en-zh:v3|'+text]:{at,value:'旧模型译文'}});
 const make=()=>createStore({get:async key=>data.get(key),set:async(key,value)=>data.set(key,structuredClone(value))},{now:()=>at});
 const store=make();assert.equal(await store.cacheGet(text),null);await store.cacheSet(text,'估计仅在观察值独立时有效。');assert.equal(await make().cacheGet(text),'估计仅在观察值独立时有效。');assert.deepEqual(data.get('words'),words);assert.deepEqual(data.get('prefs'),prefs);
});
for(const version of ['cloudflare-ai:en-zh:v1','cloudflare-ai:en-zh:v2','cloudflare-ai:en-zh:v3',undefined,'unrecognized'])test(`client rejects ${version??'missing'} revision before continuing chunks`,async()=>{
 let calls=0;const provider=createTranslationProvider({request:async()=>{calls++;return {ok:true,data:{text:'旧格式译文',...(version===undefined?{}:{version})}};}});
 await assert.rejects(provider.translate('A reliable observation supports the model. '.repeat(40)),error=>error.code==='TRANSLATION_UNAVAILABLE'&&error.retryable===false);assert.equal(calls,1);
});
test('client accepts the current service revision',async()=>{
 const provider=createTranslationProvider({request:async()=>({ok:true,data:{text:' 当前修订译文 ',version:revision}})});assert.equal(await provider.translate('A reliable observation.'),'当前修订译文');
});
test('service health advertises the current cache revision without changing the protocol version',async()=>{
 const response=await worker.fetch(new Request('https://fixture.test/health'),{}),body=await response.json();assert.equal(response.status,200);assert.equal(body.translation.version,'ai-translation-v1');assert.equal(body.translation.cacheVersion,revision);
});

test('a revision change between chunks cannot return a partial translation',async()=>{
 let calls=0;const provider=createTranslationProvider({request:async()=>({ok:true,data:{text:'不会作为部分结果返回',version:++calls===1?revision:'cloudflare-ai:en-zh:v1'}})});
 await assert.rejects(provider.translate('A reliable observation supports the model. '.repeat(90)),error=>error.code==='TRANSLATION_UNAVAILABLE'&&error.retryable===false);assert.equal(calls,2);
});
