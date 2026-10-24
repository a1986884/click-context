import {test} from 'node:test';import assert from 'node:assert/strict';
import {createEngineRepository} from '../src/engine-vault.js';
const configuration=()=>({body:'my-api',selection:'builtin',profiles:[{id:'my-api',preset:'custom',label:'Fixture',model:'fixture',endpoint:'https://example.test/v1/chat/completions',apiKey:'synthetic-'+'k'.repeat(30)}]});
test('engine settings persist independently from reader preferences and vocabulary',async()=>{
 let value=null;const adapter={get:async()=>value,set:async next=>{value=next;}};const first=createEngineRepository(adapter);assert.equal((await first.read()).body,'builtin');await first.save(configuration());assert.equal((await createEngineRepository(adapter).read()).body,'my-api');
});
test('failed reads do not replace existing credentials with defaults',async()=>{
 let writes=0;const repository=createEngineRepository({get:async()=>{throw Error('private detail');},set:async()=>writes++});await assert.rejects(repository.save(configuration()),e=>e.code==='ENGINE_STORAGE'&&!e.message.includes('private detail'));assert.equal(writes,0);
});
test('invalid stored schemas fail closed rather than resetting to builtin',async()=>{
 const repository=createEngineRepository({get:async()=>({schema:99,profiles:[]}),set:async()=>assert.fail('must not write')});await assert.rejects(repository.read(),e=>e.code==='ENGINE_STORAGE');
});
test('a failed save does not block a later explicit recovery',async()=>{
 let value=null,failed=true;const repository=createEngineRepository({get:async()=>value,set:async next=>{if(failed)throw Error('private detail');value=next;}});await assert.rejects(repository.save(configuration()),e=>e.code==='ENGINE_STORAGE');failed=false;await repository.save(configuration());assert.equal((await repository.read()).body,'my-api');
});
test('serial saves retain the hidden key when a following UI update omits it',async()=>{
 let value=null;const repository=createEngineRepository({get:async()=>value,set:async next=>{await new Promise(r=>setTimeout(r,5));value=next;}});
 const first=configuration(),second=configuration();delete second.profiles[0].apiKey;second.selection='my-api';await Promise.all([repository.save(first),repository.save(second)]);assert.equal((await repository.read()).selection,'my-api');assert.equal(value.profiles[0].apiKey,first.profiles[0].apiKey);
});
test('concurrent saves notify routing with the actual committed previous configuration',async()=>{
 let value=null;const repository=createEngineRepository({get:async()=>value,set:async next=>{await new Promise(r=>setTimeout(r,5));value=next;}}),changes=[];
 const first=configuration(),second=configuration();second.body='builtin';second.selection='my-api';const onCommit=(after,before)=>{assert.equal(value,after);changes.push([before.body,after.body]);};await Promise.all([repository.save(first,{onCommit}),repository.save(second,{onCommit})]);assert.deepEqual(changes,[['builtin','my-api'],['my-api','builtin']]);
});
test('reading an existing 0.7.85 profile preserves keys and its stable stored revision',async()=>{
 const old={schema:1,body:'my-api',selection:'builtin',profiles:[{...configuration().profiles[0],protocol:'openai',region:'',tokenParameter:'max_tokens',cacheRevision:'01234567-89ab-cdef-0123-456789abcdef'}]};let writes=0;
 const repository=createEngineRepository({get:async()=>structuredClone(old),set:async()=>writes++});const first=await repository.read(),second=await repository.read();assert.equal(first.profiles[0].cacheRevision,old.profiles[0].cacheRevision);assert.equal(second.profiles[0].cacheRevision,first.profiles[0].cacheRevision);assert.equal(second.profiles[0].apiKey,old.profiles[0].apiKey);assert.equal(writes,0);
});
