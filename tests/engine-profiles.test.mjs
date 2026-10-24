import {TRANSLATION_CACHE_VERSION} from '../src/translation-service.js';
import {CLIENT_TRANSLATION_CACHE_VERSION} from '../src/translation-client-validation.js';
import {test} from 'node:test';import assert from 'node:assert/strict';
import {normalizeEngineSettings,publicEngineSettings,engineSettingsForUI,DEFAULT_ENGINE_SETTINGS} from '../src/engine-profiles.js';
const secret='synthetic-'+'s'.repeat(30);
const profile=(overrides={})=>({id:'my-model',preset:'openai',label:'My model',endpoint:'https://api.example.test/v1/chat/completions',model:'fixture-model',apiKey:secret,...overrides});
test('body and selection independently select profiles; client cache is separate from the server revision',()=>{
 const state=normalizeEngineSettings({body:'my-model',selection:'builtin',profiles:[profile()]});const pub=publicEngineSettings(state);
 assert.equal(pub.body.id,'my-model');assert.equal(pub.selection.id,'builtin');assert.equal(pub.selection.cacheKey,CLIENT_TRANSLATION_CACHE_VERSION);assert.notEqual(pub.selection.cacheKey,TRANSLATION_CACHE_VERSION);assert.equal(TRANSLATION_CACHE_VERSION,'cloudflare-ai:en-zh:v5');assert.ok(!JSON.stringify(pub).includes(secret));
});
test('engine profiles never reveal saved credentials to settings UI',()=>{
 const state=normalizeEngineSettings({profiles:[profile()]});const ui=engineSettingsForUI(state);assert.equal(ui.profiles[0].hasKey,true);assert.ok(!('apiKey' in ui.profiles[0]));assert.ok(!JSON.stringify(ui).includes(secret));
});
test('client validation revision bypasses previous external caches without changing settings or builtin identity',()=>{
 const state=normalizeEngineSettings({body:'my-model',selection:'builtin',profiles:[profile()]});const revision=state.profiles[0].cacheRevision,pub=publicEngineSettings(state);
 assert.equal(pub.body.cacheKey,'engine:my-model:'+revision+':en-zh:v6');assert.notEqual(pub.body.cacheKey,'engine:my-model:'+revision+':en-zh:v5');assert.equal(pub.selection.cacheKey,CLIENT_TRANSLATION_CACHE_VERSION);assert.equal(state.profiles[0].cacheRevision,revision);assert.equal(state.profiles[0].apiKey,secret);
});
test('saving an unchanged profile preserves its cache identity and hidden credential',()=>{
 const first=normalizeEngineSettings({profiles:[profile()]});const next=normalizeEngineSettings({profiles:[profile({apiKey:undefined})]},first);
 assert.equal(next.profiles[0].cacheRevision,first.profiles[0].cacheRevision);assert.equal(next.profiles[0].apiKey,secret);
});
test('model and credential changes invalidate only the changed profile cache',()=>{
 const first=normalizeEngineSettings({profiles:[profile(),profile({id:'other'})]});const next=normalizeEngineSettings({profiles:[profile({model:'another-model'}),profile({id:'other'})]},first);
 assert.notEqual(next.profiles[0].cacheRevision,first.profiles[0].cacheRevision);assert.equal(next.profiles[1].cacheRevision,first.profiles[1].cacheRevision);
 const rekeyed=normalizeEngineSettings({profiles:[profile({apiKey:'new-'+secret}),profile({id:'other'})]},first);assert.notEqual(rekeyed.profiles[0].cacheRevision,first.profiles[0].cacheRevision);
});
test('switching a scope does not invalidate the other scope cache',()=>{
 const first=normalizeEngineSettings({body:'my-model',selection:'builtin',profiles:[profile()]});const next=normalizeEngineSettings({body:'my-model',selection:'my-model',profiles:[profile()]},first);
 assert.equal(publicEngineSettings(first).body.cacheKey,publicEngineSettings(next).body.cacheKey);
});
test('moving an endpoint to another origin requires a newly supplied credential',()=>{
 const first=normalizeEngineSettings({profiles:[profile()]});assert.throws(()=>normalizeEngineSettings({profiles:[profile({endpoint:'https://another.example.test/v1/chat/completions',apiKey:undefined})]},first),/重新填写/);
});
test('endpoint validation rejects URL credentials, query secrets, fragments and remote cleartext',()=>{
 for(const endpoint of ['https://user:pass@example.test/v1','https://example.test/v1?key=private','https://example.test/v1#private','http://remote.example.test/v1','file:///private','javascript:alert(1)'])assert.throws(()=>normalizeEngineSettings({profiles:[profile({endpoint})]}));
});
test('loopback HTTP is explicitly supported for local model APIs',()=>{
 for(const endpoint of ['http://127.0.0.1:11434/v1/chat/completions','http://localhost:11434/v1/chat/completions','http://[::1]:11434/v1/chat/completions'])assert.equal(normalizeEngineSettings({profiles:[profile({preset:'ollama',endpoint,apiKey:''})]}).profiles[0].endpoint,endpoint);
});
test('configuration rejects dangling selections, duplicate IDs and reserved builtin replacement',()=>{
 assert.throws(()=>normalizeEngineSettings({body:'missing',profiles:[]}));assert.throws(()=>normalizeEngineSettings({profiles:[profile(),profile()]}));assert.throws(()=>normalizeEngineSettings({profiles:[profile({id:'builtin'})]}));
});
test('preset protocol cannot silently change; AI model IDs are required',()=>{
 assert.throws(()=>normalizeEngineSettings({profiles:[profile({protocol:'anthropic'})]}));assert.throws(()=>normalizeEngineSettings({profiles:[profile({model:''})]}));
});
test('credentials cannot leak through labels and cannot contain header newlines',()=>{
 assert.throws(()=>normalizeEngineSettings({profiles:[profile({label:secret})]}));assert.throws(()=>normalizeEngineSettings({profiles:[profile({apiKey:'bad\nheader'})]}));
});
test('clearing a credential is explicit and never alters the builtin service',()=>{
 const first=normalizeEngineSettings({profiles:[profile()]});const next=normalizeEngineSettings({profiles:[profile({apiKey:undefined,clearKey:true})]},first);assert.equal(next.profiles[0].apiKey,'');assert.equal(publicEngineSettings(DEFAULT_ENGINE_SETTINGS).body.id,'builtin');
});
test('a key pasted into an endpoint path cannot become part of a request URL',()=>{
 assert.throws(()=>normalizeEngineSettings({profiles:[profile({endpoint:'https://api.example.test/'+secret+'/chat'})]}),/不能包含密钥/);
});
