import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRuntimeConnection} from '../src/extension-connection.js';
test('invalidated context reports one actionable error and permanently stops calls to the old runtime',async()=>{
 let calls=0,expired=0;const api={runtime:{id:'live',sendMessage(){calls++;throw Error('Extension context invalidated.');}}};
 const c=createRuntimeConnection(api,{onInvalidated:()=>{expired++;}});
 for(let i=0;i<3;i++)await assert.rejects(c.send({type:'lookup'}),e=>e.code==='EXTENSION_CONTEXT_INVALIDATED'&&e.retryable===false&&/刷新当前网页/.test(e.message));
 assert.equal(calls,1);assert.equal(expired,1);assert.equal(c.check(),false);
});
test('rejected promises and missing runtime identity trigger cleanup; ordinary service errors do not expire the extension',async()=>{
 let expired=0;const api={runtime:{id:'live',sendMessage:async()=>{throw Error('temporary transport failure');}}};const c=createRuntimeConnection(api,{onInvalidated:()=>{expired++;}});
 await assert.rejects(c.send({}),/temporary/);assert.equal(expired,0);assert.equal(c.check(),true);
 api.runtime.sendMessage=async()=>{throw Error('Extension context invalidated.');};await assert.rejects(c.send({}),e=>e.code==='EXTENSION_CONTEXT_INVALIDATED');assert.equal(expired,1);
 const fresh=createRuntimeConnection({runtime:{id:undefined,sendMessage:()=>{throw Error('must not send');}}},{onInvalidated:()=>{expired++;}});assert.equal(fresh.check(),false);assert.equal(expired,2);
});
