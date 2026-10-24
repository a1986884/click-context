import test from 'node:test';import assert from 'node:assert/strict';
import {executeEngineTranslation} from '../src/engine-executor.js';
const text='The river is quiet.',translated='河流很安静。';
const profile=protocol=>({id:'example',preset:protocol,protocol,label:'Example',endpoint:'https://api.example.test/v1',model:'example-model',apiKey:'EXAMPLE_OUTPUT_SHAPE_KEY'});
const chat=message=>({choices:[{finish_reason:'stop',message:{role:'assistant',content:translated,...message}}]});
const claude=content=>({role:'assistant',stop_reason:'end_turn',content});
const gemini=(parts,extra={})=>({candidates:[{finishReason:'STOP',content:{role:'model',parts,...extra}}]});
const invalid=[
 ['openai','wrong role',chat({role:'user'})],['openai','refusal',chat({refusal:'EXAMPLE_REFUSAL'})],['openai','tool calls',chat({tool_calls:[{type:'function',function:{name:'example'}}]})],['openai','legacy function',chat({function_call:{name:'example',arguments:'{}'}})],['openai','multiple choices',{choices:[...chat({}).choices,...chat({}).choices]}],
 ['anthropic','wrong role',{...claude([{type:'text',text:translated}]),role:'user'}],['anthropic','tool block',claude([{type:'text',text:translated},{type:'tool_use',id:'example',name:'example',input:{}}])],['anthropic','refusal block',claude([{type:'text',text:translated},{type:'refusal',refusal:'EXAMPLE_REFUSAL'}])],['anthropic','unknown block',claude([{type:'text',text:translated},{type:'example_unknown'}])],
 ['gemini','wrong role',gemini([{text:translated}],{role:'user'})],['gemini','function call',gemini([{text:translated},{functionCall:{name:'example',args:{}}}])],['gemini','mixed function and text',gemini([{text:translated,functionCall:{name:'example',args:{}}}])],['gemini','inline image',gemini([{text:translated},{inlineData:{mimeType:'image/png',data:'EXAMPLE'}}])],['gemini','multiple candidates',{candidates:[...gemini([{text:translated}]).candidates,...gemini([{text:translated}]).candidates]}],['gemini','blocked prompt',{...gemini([{text:translated}]),promptFeedback:{blockReason:'SAFETY'}}]
];
for(const [protocol,name,payload]of invalid)test(protocol+' rejects '+name+' without retry or fallback',async()=>{let calls=0;await assert.rejects(executeEngineTranslation(profile(protocol),text,{fetcher:async()=>{calls++;return Response.json(payload)}}),e=>e.code==='TRANSLATION_UNAVAILABLE'&&e.retryable===false);assert.equal(calls,1);});
const valid=[
 ['openai','assistant',chat({})],['openai','compatible missing role',{choices:[{finish_reason:'stop',message:{content:translated}}]}],['openai','empty optional fields',chat({refusal:null,tool_calls:[]})],
 ['anthropic','text blocks',claude([{type:'text',text:'河流'},{type:'text',text:'很安静。'}])],['anthropic','thinking excluded',claude([{type:'thinking',thinking:'EXAMPLE_PRIVATE_REASONING',signature:'example'},{type:'text',text:translated}])],['anthropic','redacted thinking excluded',claude([{type:'redacted_thinking',data:'EXAMPLE_REDACTED'},{type:'text',text:translated}])],['anthropic','compatible missing role',{stop_reason:'end_turn',content:[{type:'text',text:translated}]}],
 ['gemini','text',gemini([{text:translated}])],['gemini','thought excluded',gemini([{text:'EXAMPLE_PRIVATE_REASONING',thought:true},{text:translated,thought:false}])],['gemini','compatible missing role',{candidates:[{finishReason:'STOP',content:{parts:[{text:translated}]}}]}]
];
for(const [protocol,name,payload]of valid)test(protocol+' preserves '+name,async()=>assert.equal(await executeEngineTranslation(profile(protocol),text,{fetcher:async()=>Response.json(payload)}),translated));
