import test from 'node:test';import assert from 'node:assert/strict';import {parseTranslationResult} from '../src/translation-service.js';
const input={text:'The result was not significant (p = 0.08).',translationRevision:'cloudflare-ai:en-zh:v4'},zh='结果不显著（p = 0.08）。',privateText='PRIVATE_SYNTHETIC_REASONING';
const choice={finish_reason:'stop',message:{role:'assistant',content:zh,refusal:null}};
test('the documented chat completion shape reads assistant content and never returns reasoning metadata',()=>{
 const result=parseTranslationResult({response:privateText,choices:[{...choice,message:{...choice.message,reasoning_content:privateText}}],usage:{completion_tokens:20}},input);assert.equal(result.text,zh);assert.ok(!JSON.stringify(result).includes(privateText));
});
for(const [name,choices]of [
 ['null choice',[null]],
 ['missing role',[{...choice,message:{content:zh}}]],
 ['non-assistant role',[{...choice,message:{role:'system',content:zh}}]],
 ['refusal',[{...choice,message:{...choice.message,refusal:privateText}}]],
 ['tool calls',[{...choice,message:{...choice.message,tool_calls:[{name:privateText}]}}]],
 ['malformed tool calls',[{...choice,message:{...choice.message,tool_calls:{name:privateText}}}]],
 ['function call',[{...choice,message:{...choice.message,function_call:{name:privateText}}}]],
 ['multiple alternatives',[choice,choice]],
 ['nonterminal choice',[{...choice,finish_reason:'tool_calls'}]]
])test('v4 refuses ambiguous chat '+name+' even if a normalized response looks valid',()=>assert.throws(()=>parseTranslationResult({response:zh,choices},input),e=>e.validationReason==='invalid-text'&&!JSON.stringify(e).includes(privateText)));
