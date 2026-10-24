import {test} from 'node:test';import assert from 'node:assert/strict';
import {executeEngineTranslation} from '../src/engine-executor.js';
const secret='synthetic-'+'k'.repeat(30),text='The value is 12.5.',translated='该值为12.5。';
const profile=protocol=>({protocol,preset:protocol,label:'Fixture engine',endpoint:'https://api.example.test/translate',model:'fixture-model',region:'eastasia',apiKey:secret});
const payloads={openai:{choices:[{finish_reason:'stop',message:{content:translated}}]},anthropic:{stop_reason:'end_turn',content:[{type:'text',text:translated}]},gemini:{candidates:[{finishReason:'STOP',content:{parts:[{text:translated}]}}]},google:{data:{translations:[{translatedText:translated}]}},microsoft:[{translations:[{text:translated,to:'zh-Hans'}]}],deepl:{translations:[{text:translated}]}};
for(const protocol of Object.keys(payloads))test(protocol+' uses its native API and keeps credentials out of URLs',async()=>{
 let call;const result=await executeEngineTranslation(profile(protocol),text,{fetcher:async(url,options)=>{call={url,options};return Response.json(payloads[protocol]);}});
 assert.equal(result,translated);assert.ok(!call.url.includes(secret));assert.equal(call.options.credentials,'omit');assert.equal(call.options.redirect,'error');const body=JSON.parse(call.options.body);
 if(protocol==='openai'){assert.equal(body.model,'fixture-model');assert.equal(call.options.headers.Authorization,'Bearer '+secret);}
 if(protocol==='anthropic'){assert.equal(call.options.headers['x-api-key'],secret);assert.equal(body.model,'fixture-model');}
 if(protocol==='gemini'){assert.match(call.url,/models\/fixture-model:generateContent$/);assert.equal(call.options.headers['x-goog-api-key'],secret);}
 if(protocol==='google'){assert.equal(body.target,'zh-CN');assert.equal(call.options.headers['x-goog-api-key'],secret);}
 if(protocol==='microsoft'){assert.match(call.url,/api-version=3.0/);assert.equal(call.options.headers['Ocp-Apim-Subscription-Region'],'eastasia');}
 if(protocol==='deepl')assert.equal(call.options.headers.Authorization,'DeepL-Auth-Key '+secret);
});
test('API authentication errors never expose provider error bodies or secrets',async()=>{
 await assert.rejects(executeEngineTranslation(profile('openai'),text,{fetcher:async()=>Response.json({error:secret},{status:401})}),e=>e.code==='ENGINE_AUTH'&&!e.message.includes(secret));
});
test('rate limiting pauses instead of silently retrying or falling back',async()=>{
 let calls=0;await assert.rejects(executeEngineTranslation(profile('google'),text,{fetcher:async()=>{calls++;return new Response(secret,{status:429});}}),e=>e.code==='RATE_LIMITED'&&e.retryable===false);assert.equal(calls,1);
});
test('native truncation markers are rejected for all three AI protocols',async()=>{
 const responses={openai:{choices:[{finish_reason:'length',message:{content:translated}}]},anthropic:{stop_reason:'max_tokens',content:[{type:'text',text:translated}]},gemini:{candidates:[{finishReason:'MAX_TOKENS',content:{parts:[{text:translated}]}}]}};
 for(const [protocol,payload] of Object.entries(responses))await assert.rejects(executeEngineTranslation(profile(protocol),text,{fetcher:async()=>Response.json(payload)}),e=>e.code==='TRANSLATION_UNAVAILABLE');
});
test('numeric loss is rejected, and HTTP success alone is not translation acceptance',async()=>{
 await assert.rejects(executeEngineTranslation(profile('google'),text,{fetcher:async()=>Response.json({data:{translations:[{translatedText:'该值为13。'}]}})}));
});
test('malicious or broken provider output cannot return the saved key to the page',async()=>{
 await assert.rejects(executeEngineTranslation(profile('google'),text,{fetcher:async()=>Response.json({data:{translations:[{translatedText:translated+secret}]}})}),e=>!e.message.includes(secret));
});
test('deadline remains finite when a fetch implementation ignores cancellation',async()=>{
 await assert.rejects(executeEngineTranslation(profile('google'),text,{timeoutMs:15,fetcher:()=>new Promise(()=>{})}),e=>e.code==='TRANSLATION_UNAVAILABLE');
});
test('body-reading stalls are also bounded',async()=>{
 await assert.rejects(executeEngineTranslation(profile('google'),text,{timeoutMs:15,fetcher:async()=>new Response(new ReadableStream({start(){}}))}),e=>e.code==='TRANSLATION_UNAVAILABLE');
});
test('cancellation never becomes a provider error containing internal details',async()=>{
 const controller=new AbortController();controller.abort();let calls=0;await assert.rejects(executeEngineTranslation(profile('google'),text,{signal:controller.signal,fetcher:async()=>{calls++;return Response.json(payloads.google);}}),e=>e.name==='AbortError');assert.equal(calls,0);
});
test('Google escaped text is decoded as text, never inserted as HTML',async()=>{
 assert.equal(await executeEngineTranslation(profile('google'),'Tom & Jerry',{fetcher:async()=>Response.json({data:{translations:[{translatedText:'汤姆 &amp; 杰瑞'}]}})}),'汤姆 & 杰瑞');
});
test('a later chunk failure never returns a partial translation',async()=>{
 let calls=0;await assert.rejects(executeEngineTranslation(profile('google'),'A sentence. '.repeat(420),{fetcher:async()=>{calls++;return calls===1?Response.json({data:{translations:[{translatedText:'一段译文。'}]}}):new Response('',{status:503});}}));assert.equal(calls,2);
});
for(const protocol of ['google','openai'])test(protocol+' rejects obvious conditional loss without returning the wrong translation',async()=>{
 const wrong='仅当观测独立时，估计才有效。';const payload=protocol==='google'?{data:{translations:[{translatedText:wrong}]}}:{choices:[{finish_reason:'stop',message:{content:wrong}}]};
 await assert.rejects(executeEngineTranslation(profile(protocol),'If the observations are independent, the estimate is valid.',{fetcher:async()=>Response.json(payload)}),e=>e.code==='TRANSLATION_UNAVAILABLE'&&/条件方向/.test(e.message)&&!e.message.includes(wrong));
});
