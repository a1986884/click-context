import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {cleanContext,contextPrompt,createContextClient,parseContextResult} from '../src/context-meaning.js';
const revision='ai-context-v4',input={word:'bank',sentence:'They sat on the bank.',offset:16,senses:[]};
test('explicit context v4 uses zero-temperature sampling while legacy defaults remain untouched',()=>{
 const current=cleanContext({...input,contextRevision:revision});assert.equal(current.contextRevision,revision);assert.equal(contextPrompt(current).temperature,0);assert.equal(contextPrompt(cleanContext(input)).temperature,undefined);assert.throws(()=>cleanContext({...input,contextRevision:'unknown'}));
});
test('current context client explicitly sends its revision and rejects a mismatched old response',async()=>{
 let sent;const client=createContextClient({revision,fetcher:async(_url,o)=>{sent=JSON.parse(o.body);return Response.json({ok:true,data:{senseId:null,zh:'河岸',method:'ai-context-v3'}});}});await assert.rejects(client(input),e=>e.code==='CONTEXT_INVALID_RESULT');assert.equal(sent.contextRevision,revision);
});
test('legacy context prompt bytes stay frozen',()=>assert.equal(createHash('sha256').update(JSON.stringify(contextPrompt(cleanContext(input)))).digest('hex'),'d137797102db252460820e143ee76a46924fa31583a8a55cce180fba79944ac1'));
test('context revision is isolated in the client cache and success method',async()=>{
 let calls=0;const client=createContextClient({revision,fetcher:async()=>{calls++;return Response.json({ok:true,data:{senseId:null,zh:'河岸',method:revision}});}});const r=await client(input);assert.equal(r.method,revision);await client(input);assert.equal(calls,1);assert.equal(parseContextResult({senseId:null,zh:'河岸'},input).method,'ai-context-v3');
});
test('current context constrains compound modifiers by contribution without embedding regression sentences',()=>{
 const prompt=contextPrompt(cleanContext({...input,contextRevision:revision}));assert.match(prompt.instructions,/single marked word used as a compound modifier/);assert.match(prompt.instructions,/Never translate the unmarked head noun/);assert.doesNotMatch(prompt.instructions,/bass speaker|co-taught|Anish|laser printer|power button/);
});
test('new context capacity rejection is distinct and not cached by the client',async()=>{
 let calls=0;const client=createContextClient({revision,fetcher:async()=>++calls===1?Response.json({ok:false,code:'CONTEXT_BUSY',error:'语境服务繁忙，请稍后重试'},{status:503}):Response.json({ok:true,data:{senseId:null,zh:'河岸',method:revision}})});await assert.rejects(client(input),e=>e.code==='CONTEXT_BUSY');assert.equal((await client(input)).zh,'河岸');assert.equal(calls,2);
});
