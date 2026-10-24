import {test} from 'node:test';import assert from 'node:assert/strict';
import {createStore,CACHE_TTL,CACHE_BUCKETS,CACHE_BUCKET_LIMIT,CACHE_BUCKET_BYTES} from '../src/storage.js';
const setup=(now=Date.now)=>{const data=new Map();return {data,make:()=>createStore({get:async k=>data.get(k),set:async(k,v)=>data.set(k,structuredClone(v))},{now})};};
test('a long article keeps more than 400 sentence translations across new store instances',async()=>{
 const {make}=setup(),store=make();for(let i=0;i<650;i++)await store.cacheSet('Paper sentence '+i,'译文 '+i);
 const reopened=make();for(let i=0;i<650;i++)assert.equal(await reopened.cacheGet('Paper sentence '+i),'译文 '+i);
 await reopened.clearCache();assert.equal(await make().cacheGet('Paper sentence 0'),null);assert.equal(await make().cacheGet('Paper sentence 649'),null);
});
test('cache shards isolate the previous provider, expire values and bound stored bytes',async()=>{
 let time=10;const {data,make}=setup(()=>time),store=make();data.set('translations',{'mymemory:en-zh:v2|Old sentence':{at:time,value:'旧译文'}});assert.equal(await store.cacheGet('Old sentence'),null);
 for(let i=0;i<100;i++)await store.cacheSet('Large sentence '+i,'译文'.repeat(3000));
 for(const [key,value] of data)if(key.startsWith('translation-cache:')){assert.ok(Object.keys(value).length<=CACHE_BUCKET_LIMIT);assert.ok(Buffer.byteLength(JSON.stringify(value),'utf8')<=CACHE_BUCKET_BYTES);assert.ok(JSON.stringify(value).length*2<=CACHE_BUCKET_BYTES);}
 assert.ok([...data.keys()].filter(k=>k.startsWith('translation-cache:')).length<=CACHE_BUCKETS);
 time+=CACHE_TTL;assert.equal(await store.cacheGet('Old sentence'),null);assert.equal(await store.cacheGet('Large sentence 99'),null);await store.clearCache();assert.equal(data.get('translations')&&Object.keys(data.get('translations')).length,0);
});
