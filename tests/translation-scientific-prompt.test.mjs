import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {translationPrompt,cleanTranslation,translationModel,parseTranslationResult,TRANSLATION_CACHE_VERSION} from '../src/translation-service.js';
const v5='cloudflare-ai:en-zh:v5',v4='cloudflare-ai:en-zh:v4',text='NaCl at 0.9% was heated to -2.0 degrees Celsius; see Fig. 12 and Eq. (4).';
test('scientific prose correction has a new cache revision and explicit mixed-token rule',()=>{
 assert.equal(TRANSLATION_CACHE_VERSION,v5);const prompt=translationPrompt(cleanTranslation({text,translationRevision:v5}));assert.match(prompt.messages[0].content,/translate the surrounding English prose into Chinese/);assert.deepEqual(JSON.parse(prompt.messages[1].content),{text});assert.equal(translationModel({translationRevision:v5}),'@cf/zai-org/glm-4.7-flash');assert.equal(prompt.temperature,0);assert.deepEqual(prompt.chat_template_kwargs,{enable_thinking:false});
});
for(const revision of [v4,v5])test(revision+' retains incomplete, Chinese, numbers and condition checks',()=>{
 assert.throws(()=>parseTranslationResult({choices:[{finish_reason:'length'}]},{text,translationRevision:revision}),e=>e.validationReason==='incomplete');assert.throws(()=>parseTranslationResult({response:text},{text,translationRevision:revision}),e=>e.validationReason==='invalid-text');assert.throws(()=>parseTranslationResult({response:'0.8%的NaCl被加热至-2.0摄氏度；见图12和式(4)。'},{text,translationRevision:revision}),e=>e.validationReason==='number-mismatch');assert.throws(()=>parseTranslationResult({response:'只要按下按钮，灯就会亮。'},{text:'The lamp lights only if the button is pressed.',translationRevision:revision}),e=>e.validationReason==='condition-mismatch');
});
test('v4 short and long prompt bytes remain frozen for installed older clients',()=>{
 for(const [text,hash]of [['A public statement 12.5.','ad24bfe704ae44c9f364bfd7c4f344b65db8c2cb2edfe0e6a40a73e47b562528'],['A public sentence about the result. '.repeat(50),'ac151868cbdd1cc5ffc8abe47ab2b24347c556c98f2c83ce4bf3f08473d4b6e1']])assert.equal(createHash('sha256').update(JSON.stringify(translationPrompt({text,translationRevision:v4}))).digest('hex'),hash);
});
test('corrected scientific output preserves identifiers, numeric precision and references',()=>{
 const result=parseTranslationResult({response:'0.9%的NaCl被加热至-2.0°C；见图12和式(4)。'},{text,translationRevision:v5});assert.equal(result.version,v5);assert.equal(result.model,'@cf/zai-org/glm-4.7-flash');assert.match(result.text,/NaCl/);
});
