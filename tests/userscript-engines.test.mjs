import test from 'node:test';
import assert from 'node:assert/strict';
import {createUserscriptEngines,supportsSafeAPIRedirect} from '../userscript/engines.js';
import {createGMFetch} from '../userscript/gm-adapter.js';
const key='synthetic-test-key-only';
const input=()=>({body:'api',selection:'builtin',profiles:[{id:'api',preset:'custom',label:'My API',endpoint:'https://custom.example/v1/chat/completions',model:'test-model',apiKey:key}]});
function setup({info={scriptHandler:'Tampermonkey',version:'5.6.6239'},status=200}={}){const values=new Map(),calls=[];let builtins=0;const api=createUserscriptEngines({getValue:async(k,d)=>values.get(k)??d,setValue:async(k,v)=>values.set(k,structuredClone(v)),info,builtin:{translate:async()=>{builtins++;return '内置译文';}},request:d=>{calls.push(d);queueMicrotask(()=>d.onload({status,response:JSON.stringify(status===200?{choices:[{finish_reason:'stop',message:{content:'河流很安静。'}}]}:{error:{message:key}})}));return {abort(){}};}});return {api,values,calls,get builtins(){return builtins;}};}
test('userscript custom API requires documented redirect capability',()=>{
 for(const version of ['5.6.6239','5.4.6180','6.0.0'])assert.equal(supportsSafeAPIRedirect({scriptHandler:'Tampermonkey',version}),true);
 for(const info of [null,{scriptHandler:'Other',version:'6.0'},{scriptHandler:'Tampermonkey',version:'5.4.6179'}])assert.equal(supportsSafeAPIRedirect(info),false);
});
test('userscript API save requires host confirmation and never sends a test implicitly',async()=>{
 const s=setup();await s.api.read();await assert.rejects(s.api.save(input()));assert.equal(s.values.size,0);
 let confirmed;const ui=await s.api.save(input(),{authorize:origins=>{confirmed=origins;return true;}});assert.deepEqual(confirmed,['https://custom.example']);assert.equal(s.calls.length,0);assert.equal(JSON.stringify(ui).includes(key),false);assert.equal(ui.profiles[0].hasKey,true);assert.equal(s.values.get('click-context:v1:engines').profiles[0].apiKey,key);
});
test('body and selection route independently; auth is privileged and redirect-error is preserved',async()=>{
 const s=setup();await s.api.save(input(),{authorize:()=>true});assert.equal(await s.api.translate('selection','The river is quiet.'),'内置译文');assert.equal(await s.api.translate('body','The river is quiet.'),'河流很安静。');assert.equal(s.calls.length,1);assert.equal(s.calls[0].url,'https://custom.example/v1/chat/completions');assert.equal(s.calls[0].headers.Authorization,'Bearer '+key);assert.equal(s.calls[0].redirect,'error');assert.equal(s.calls[0].anonymous,true);
});
test('unknown managers keep builtin usable and cannot persist or call custom APIs',async()=>{
 const s=setup({info:{scriptHandler:'Other',version:'1.0'}});await assert.rejects(s.api.save(input(),{authorize:()=>true}));assert.equal(s.values.size,0);assert.equal(await s.api.translate('body','The river is quiet.'),'内置译文');assert.equal(s.calls.length,0);
});
test('API 401 is sanitized and never silently falls back',async()=>{
 const s=setup({status:401});await s.api.save(input(),{authorize:()=>true});await assert.rejects(s.api.translate('body','The river is quiet.'),e=>e.code==='ENGINE_AUTH'&&!e.message.includes(key));assert.equal(s.calls.length,1);assert.equal(s.builtins,0);
});
test('corrupt API storage fails closed without replacing settings or using builtin translation',async()=>{
 const s=setup();s.values.set('click-context:v1:engines',{schema:99,profiles:[]});await assert.rejects(s.api.read());await assert.rejects(s.api.translate('body','The river is quiet.'));await assert.rejects(s.api.save(input(),{authorize:()=>true}));assert.equal(s.values.get('click-context:v1:engines').schema,99);assert.equal(s.builtins,0);
});
test('changing API origin requires a new key and invalidates old routing cache keys',async()=>{
 const s=setup();await s.api.save(input(),{authorize:()=>true});const old=s.api.publicSettings().body.cacheKey;const ui=await s.api.read();ui.profiles[0].endpoint='https://another.example/v1/chat/completions';await assert.rejects(s.api.save(ui,{authorize:()=>true}));ui.profiles[0].apiKey='synthetic-new-key';await s.api.save(ui,{authorize:()=>true});await assert.rejects(s.api.translate('body','The river is quiet.',{engineKey:old}));assert.equal(s.calls.length,0);
});
test('secrets cannot become public model fields or page-visible settings',async()=>{
 const s=setup(),value=input();value.profiles[0].model=key;await assert.rejects(s.api.save(value,{authorize:()=>true}));assert.equal(s.values.size,0);
});
test('dynamic transport only permits the exact approved API origin with redirect-error',async()=>{
 let calls=0;const fetcher=createGMFetch(()=>calls++,{allowedOrigins:['https://custom.example']});await assert.rejects(fetcher('https://custom.example/'));await assert.rejects(fetcher('https://other.example/',{redirect:'error'}));await assert.rejects(fetcher('https://custom.example:8443/',{redirect:'error'}));assert.equal(calls,0);
});
test('switching scopes on an already confirmed host does not ask for host confirmation again',async()=>{
 const s=setup();let confirmations=0;await s.api.save(input(),{authorize:()=>{confirmations++;return true;}});const ui=await s.api.read();ui.body='builtin';ui.selection='api';await s.api.save(ui,{authorize:()=>{assert.fail('host already approved');}});assert.equal(confirmations,1);assert.equal(s.api.publicSettings().selection.id,'api');
});
test('stale API settings cannot overwrite a newer saved configuration',async()=>{
 const s=setup();await s.api.save(input(),{authorize:()=>true});const stale=await s.api.read(),fresh=structuredClone(stale);fresh.selection='api';await s.api.save(fresh);await assert.rejects(s.api.save(stale),/其他页面修改/);assert.equal(s.values.get('click-context:v1:engines').selection,'api');assert.equal(s.values.get('click-context:v1:engines').profiles[0].apiKey,key);
});
test('changing selection does not cancel an unrelated body API request',async()=>{
 let value=null,pending,aborts=0;const api=createUserscriptEngines({getValue:async()=>value,setValue:async(k,next)=>value=structuredClone(next),info:{scriptHandler:'Tampermonkey',version:'5.6.6239'},builtin:{translate:async()=> '内置译文'},request:d=>{pending=d;return {abort(){aborts++;d.onabort();}};}});await api.save(input(),{authorize:()=>true});const result=api.translate('body','The river is quiet.');await new Promise(resolve=>setTimeout(resolve,0));const ui=await api.read();ui.selection='api';await api.save(ui);assert.equal(aborts,0);pending.onload({status:200,response:JSON.stringify({choices:[{finish_reason:'stop',message:{content:'河流很安静。'}}]})});assert.equal(await result,'河流很安静。');
});
test('changing the body engine cancels its old request and rejects late results',async()=>{
 let value=null,pending,aborts=0;const api=createUserscriptEngines({getValue:async()=>value,setValue:async(k,next)=>value=structuredClone(next),info:{scriptHandler:'Tampermonkey',version:'5.6.6239'},builtin:{translate:async()=> '内置译文'},request:d=>{pending=d;return {abort(){aborts++;d.onabort();}};}});await api.save(input(),{authorize:()=>true});const old=api.translate('body','The river is quiet.');const rejected=assert.rejects(old,{name:'AbortError'});await new Promise(resolve=>setTimeout(resolve,0));const ui=await api.read();ui.body='builtin';await api.save(ui);await rejected;assert.equal(aborts,1);pending.onload({status:200,response:'{}'});assert.equal(await api.translate('body','The river is quiet.'),'内置译文');
});
test('an unresponsive engine-config read fails closed and allows a fresh read without a late overwrite',async()=>{
 const seeded=setup();await seeded.api.save(input(),{authorize:()=>true});const old=structuredClone(seeded.values.get('click-context:v1:engines'));let finish,calls=0,writes=0,builtins=0,timer;const api=createUserscriptEngines({getValue:()=>++calls===1?new Promise(resolve=>finish=resolve):null,setValue:()=>writes++,builtin:{translate:async()=>{builtins++;return '译文';}},readTimeoutMs:5});
 try{await assert.rejects(Promise.race([api.read(),new Promise(resolve=>timer=setTimeout(()=>resolve('still pending'),60))]),e=>e.code==='ENGINE_STORAGE');assert.equal(api.publicSettings().body.id,'unreadable');await assert.rejects(api.translate('body','A class.'));assert.equal(builtins,0);assert.equal(writes,0);await api.read();assert.equal(api.publicSettings().body.id,'builtin');finish(old);await new Promise(setImmediate);assert.equal(api.publicSettings().body.id,'builtin');assert.equal(writes,0);}finally{clearTimeout(timer);finish?.(old);}
});
test('a timed-out pre-save read neither authorizes hosts nor writes over existing profiles',async()=>{
 let finish,writes=0,authorized=0;const api=createUserscriptEngines({getValue:()=>new Promise(resolve=>finish=resolve),setValue:()=>writes++,readTimeoutMs:5,info:{scriptHandler:'Tampermonkey',version:'5.6.6239'}});await assert.rejects(api.save(input(),{authorize:()=>{authorized++;return true;}}),e=>e.code==='ENGINE_STORAGE');assert.equal(writes,0);assert.equal(authorized,0);finish(null);await new Promise(setImmediate);assert.equal(api.publicSettings().body.id,'unreadable');
});
