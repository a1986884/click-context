import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeEngineSettings,publicEngineSettings,engineSettingsForUI} from '../src/engine-profiles.js';
import {createEngineRepository} from '../src/engine-vault.js';
import {executeEngineTranslation} from '../src/engine-executor.js';
const secret='synthetic-'+'r'.repeat(30),text='The value is 12.5.',translated='该值为12.5。';
const profile={id:'responses',preset:'openai-responses',protocol:'responses',label:'Responses fixture',endpoint:'https://api.example.test/v1/responses',model:'fixture-model',apiKey:secret};
const message=(content=[{type:'output_text',text:translated}],extra={})=>({type:'message',role:'assistant',status:'completed',content,...extra});
const payload=(output=[message()],extra={})=>({status:'completed',error:null,incomplete_details:null,output,...extra});
test('Responses preset independently routes body or selection with its own cache identity',()=>{
 const state=normalizeEngineSettings({body:'builtin',selection:'responses',profiles:[profile]});
 assert.equal(state.profiles[0].protocol,'responses');assert.equal(publicEngineSettings(state).selection.id,'responses');
 assert.equal(engineSettingsForUI(state).profiles[0].hasKey,true);assert.ok(!JSON.stringify(publicEngineSettings(state)).includes(secret));
 assert.throws(()=>normalizeEngineSettings({profiles:[{...profile,model:''}]}));
});
test('Responses sends one stateless bounded non-streaming request without conversation persistence',async()=>{
 let call;assert.equal(await executeEngineTranslation(profile,text,{fetcher:async(url,options)=>{call={url,options};return Response.json(payload());}}),translated);
 assert.equal(call.url,profile.endpoint);assert.equal(call.options.headers.Authorization,'Bearer '+secret);
 const body=JSON.parse(call.options.body);assert.equal(body.model,profile.model);assert.equal(body.store,false);assert.equal(body.stream,false);assert.equal(body.background,false);
 assert.match(body.instructions,/translat/i);assert.deepEqual(JSON.parse(body.input),{text});assert.ok(body.max_output_tokens>=1000&&body.max_output_tokens<=2600);
 for(const key of ['messages','max_tokens','max_completion_tokens','conversation','previous_response_id','tools'])assert.ok(!(key in body));
 assert.equal(call.options.redirect,'error');assert.equal(call.options.credentials,'omit');assert.ok(!call.url.includes(secret));
});
test('Responses reads assistant output blocks in order and never exposes reasoning',async()=>{
 const output=[{type:'reasoning',summary:[{type:'summary_text',text:'private reasoning'}]},message([{type:'output_text',text:'该值为'},{type:'output_text',text:'12.5。'}])];
 assert.equal(await executeEngineTranslation(profile,text,{fetcher:async()=>Response.json(payload(output))}),translated);
});
test('Responses refuses incomplete, failed, queued and missing completion states even with plausible output',async()=>{
 for(const status of ['incomplete','failed','queued','in_progress',null])await assert.rejects(executeEngineTranslation(profile,text,{fetcher:async()=>Response.json(payload(undefined,{status}))}),e=>e.code==='TRANSLATION_UNAVAILABLE');
 for(const extra of [{error:{message:secret}},{incomplete_details:{reason:'max_output_tokens'}}])await assert.rejects(executeEngineTranslation(profile,text,{fetcher:async()=>Response.json(payload(undefined,extra))}),e=>!e.message.includes(secret));
});
test('Responses rejects partial messages, refusals, tool calls and unexpected output without returning a fragment',async()=>{
 const bad=[[],[message(undefined,{status:'incomplete'})],[message(undefined,{role:'user'})],[message([{type:'refusal',refusal:secret}])],[message(),{type:'function_call',name:'unexpected'}],[message([{type:'output_text',text:translated},{type:'refusal',refusal:'No'}])],[{type:'reasoning',summary:[]}],[message([{type:'output_text',text:123}])]];
 for(const output of bad)await assert.rejects(executeEngineTranslation(profile,text,{fetcher:async()=>Response.json(payload(output))}),e=>e.code==='TRANSLATION_UNAVAILABLE'&&!e.message.includes(secret));
 await assert.rejects(executeEngineTranslation(profile,text,{fetcher:async()=>Response.json({status:'completed',output_text:translated})}));
});
test('Responses retains numeric, conditional and saved-key output guards',async()=>{
 for(const value of ['该值为13。',translated+secret])await assert.rejects(executeEngineTranslation(profile,text,{fetcher:async()=>Response.json(payload([message([{type:'output_text',text:value}])]))}));
 await assert.rejects(executeEngineTranslation(profile,'If the sensor is ready, the fan starts.',{fetcher:async()=>Response.json(payload([message([{type:'output_text',text:'只有传感器就绪，风扇才会启动。'}])]))}),e=>/条件方向/.test(e.message));
});
test('Responses later chunk failure remains atomic; no fallback or automatic retry',async()=>{
 let calls=0;await assert.rejects(executeEngineTranslation(profile,'A sentence. '.repeat(140),{fetcher:async()=>{calls++;return calls===1?Response.json(payload([message([{type:'output_text',text:'一段译文。'}])])):Response.json(payload(undefined,{status:'incomplete'}));}}));assert.equal(calls,2);
});
test('PLaMo preset uses its documented Chat endpoint, Bearer key and explicit bounded max_tokens',async()=>{
 const p=normalizeEngineSettings({profiles:[{id:'plamo',preset:'plamo',label:'PLaMo fixture',model:'fixture-model',apiKey:secret}]}).profiles[0];let call;
 assert.equal(await executeEngineTranslation(p,text,{fetcher:async(url,options)=>{call={url,options};return Response.json({choices:[{finish_reason:'stop',message:{content:translated,reasoning:'private reasoning',reasoning_content:'private reasoning'}}]});}}),translated);
 assert.equal(call.url,'https://api.platform.preferredai.jp/v1/chat/completions');assert.equal(call.options.headers.Authorization,'Bearer '+secret);
 const body=JSON.parse(call.options.body);assert.equal(body.stream,false);assert.ok(body.max_tokens>=1000&&body.max_tokens<=2600);assert.ok(!('max_completion_tokens' in body));
});
test('legacy 0.7.86 scalar profiles retain UUIDs and hidden keys across repeated repository reads and Responses addition',async()=>{
 const old={schema:1,body:'legacy',selection:'builtin',profiles:[{id:'legacy',preset:'openai',protocol:'openai',label:'Legacy fixture',endpoint:'https://api.example.test/v1/chat/completions',model:'fixture-model',region:'',apiKey:secret,tokenParameter:'max_completion_tokens',cacheRevision:'ec59f386-1514-457f-af99-9c02eb174e58'}]};
 let stored=structuredClone(old);const repo=createEngineRepository({get:async()=>stored,set:async value=>{stored=structuredClone(value);}});
 for(let i=0;i<2;i++)assert.deepEqual(await repo.read(),{...old,context:'builtin'});assert.deepEqual(stored,old,'legacy reads must not persist the in-memory context default');
 const next=await repo.save({...old,selection:'responses',profiles:[...engineSettingsForUI(old).profiles,profile]});
 assert.deepEqual(next.profiles[0],old.profiles[0]);assert.equal(publicEngineSettings(next).body.cacheKey,publicEngineSettings(old).body.cacheKey);
 const first=await repo.read(),second=await repo.read();assert.deepEqual(first,second);assert.deepEqual(first.profiles[0],old.profiles[0]);
});
