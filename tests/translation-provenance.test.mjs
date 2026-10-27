import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {ParagraphTranslator} from '../src/translation.js';
const cases=[
 {name:'example-only',kinds:['example'],expected:['人工示例 1 段'],absent:['服务返回','本地缓存']},
 {name:'cache-only',kinds:['cache'],expected:['本地缓存（Cloudflare AI） 1 段'],absent:['服务返回','人工示例']},
 {name:'provider-only',kinds:['provider'],expected:['Cloudflare AI 服务返回 1 段'],absent:['本地缓存','人工示例']},
 {name:'mixed',kinds:['example','cache','provider'],expected:['人工示例 1 段','本地缓存（Cloudflare AI） 1 段','Cloudflare AI 服务返回 1 段']},
 {name:'provider named as example',kinds:['provider'],source:'人工示例模型',expected:['人工示例模型 服务返回 1 段'],absent:['人工示例 1 段']},
 {name:'provider named as cache',kinds:['provider'],source:'本地缓存模型',expected:['本地缓存模型 服务返回 1 段'],absent:['本地缓存（']}
];
for(const c of cases)test('translation status records actual provenance: '+c.name,async()=>{
 const {window}=parseHTML('<html><body><main></main></body></html>');globalThis.window=window;globalThis.document=window.document;const root=document.querySelector('main'),cache=new Map(),reports=[];let calls=0;
 for(const [i,kind] of c.kinds.entries()){const p=document.createElement('p');p.className='english';p.textContent='Public example number '+i+'.';if(kind==='example')p.dataset.translation='人工示例译文';if(kind==='cache')cache.set(p.textContent,'缓存中的译文');root.append(p);}
 const translator=new ParagraphTranslator({root,demo:true,interval:0,sourceName:c.source||'Cloudflare AI',store:{cacheGet:async text=>cache.get(text),cacheSet:async()=>{}},translate:async()=>{calls++;return '测试服务返回的译文';},report:text=>reports.push(text)});
 try{await translator.start('bilingual',true);const status=reports.at(-1);for(const text of c.expected)assert.ok(status.includes(text),status);for(const text of c.absent||[])assert.ok(!status.includes(text),status);assert.equal(calls,c.kinds.filter(k=>k==='provider').length);assert.equal(translator.records.filter(r=>r.state==='done').length,c.kinds.length);}finally{translator.stop();}
});
