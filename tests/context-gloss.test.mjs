import test from 'node:test';import assert from 'node:assert/strict';import {matchesDictionaryGloss as match} from '../src/context-gloss.js';
const cases=[
 ['full source','银行','银行',true],['plain alias','金融机构','银行；金融机构',true],['enumeration alias','河岸','岸、河岸',true],['ASCII alias','金融机构','银行;金融机构',true],
 ['formatting preserved','银行（大楼）','银行 ( 大楼 )',true],['trailing punctuation','银行。','银行',true],['qualifier lost','银行','银行（大楼）',false],['negation lost','银行','非银行',false],['word spaces significant','信用银行','信用 银行',false],
 ['parenthetical enumeration','岸边','河岸（堤岸、岸边、河滩）',false],['parenthetical semicolon','可写','属性（可读; 可写; 可执行）',false],['square qualifier','岸边','河岸[堤岸、岸边、河滩]',false],['nested qualifier','岸边','河岸（地形[堤岸、岸边、河滩]）',false],
 ['outside alias after qualifier','河边','河岸（堤岸、岸边、河滩）；河边',true],['outside alias before qualifier','河边','河边；河岸（堤岸、岸边、河滩）',true],['complete qualified alias','河岸（堤岸、岸边、河滩）','河边；河岸（堤岸、岸边、河滩）',true],
 ['unclosed qualifier','岸边','河岸（堤岸、岸边、河滩',false],['mismatched qualifier','岸边','河岸（堤岸、岸边、河滩]',false],['stray closer','河边','河岸）；河边',false],['whole malformed source remains literal','河岸（','河岸（',true],
 ['empty meaning','','银行；',false],['empty dictionary','岸边','',false],['substring','行','银行；金融机构',false],['non string',null,'银行',false],
 ['Chinese quote','岸边','例如“堤岸、岸边、河滩”',false],['Chinese bracket','岸边','河岸【堤岸、岸边、河滩】',false],['ASCII quote','岸边','例如"堤岸、岸边、河滩"',false],['inside qualifier stays spaced','总部','银行（总 部）',false]
];for(const [name,ai,dictionary,expected]of cases)test('dictionary gloss alias boundary: '+name,()=>assert.equal(match(ai,dictionary),expected));

test('strict provenance never splits a shared qualifier across Chinese enumeration fragments',()=>{
 for(const [meaning,dictionary]of [['运动','运动、娱乐用的'],['金','金、银制的'],['政治','政治、经济方面的'],['河岸','岸、河岸']])assert.equal(match(meaning,dictionary,{allowEnumeration:false}),false);
 assert.equal(match('运动、娱乐用的','运动、娱乐用的',{allowEnumeration:false}),true);
 assert.equal(match('娱乐用的','消遣用的；娱乐用的',{allowEnumeration:false}),true);
 assert.equal(match('河岸','岸、河岸'),true);
});
