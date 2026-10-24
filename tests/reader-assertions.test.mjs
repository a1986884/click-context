import test from 'node:test';
import assert from 'node:assert/strict';
import {assertParagraphTranslations,assertStatisticalNegation,assertConfidenceInterval} from './live/reader-assertions.mjs';
const valid=[
 '该治疗将死亡率从 12.5% 降低至 8.0%。然而，这一差异在统计学上并不显著（p = 0.08）。',
 '估计仅在观测相互独立时才有效。有关模型假设，请参见公式 (3) 和图 2。'
];
test('paragraph probe accepts the fresh 0.7.74 public sample translations',()=>assert.doesNotThrow(()=>assertParagraphTranslations(valid)));
for(const [label,change] of [
 ['observed mixed sufficient/necessary wording from 0.7.78',texts=>texts[1]='只要观察值相互独立，估计才是有效的；参见式 (3) 和图 2。'],
 ['only-if strengthened to observed compound biconditional',texts=>texts[1]='只要且仅当观测值相互独立，该估计才有效；参见式(3)和图2。'],
 ['only-if strengthened to if-and-only-if',texts=>texts[1]='当且仅当观测相互独立时估计才有效；参见公式 (3) 和图 2。'],
 ['condition reversed by not-only',texts=>texts[1]='该估计不仅在观测相互独立时有效，也适用于其他情况。参见公式 (3) 和图 2。'],
 ['negation hidden in a different word',texts=>texts[0]='该治疗将死亡率从12.5%降低至8.0%。然而，不同组之间的差异在统计学上显著（p = 0.08）。'],
 ['condition omitted',texts=>texts[1]=texts[1].replace('仅在观测相互独立时才','在观测相互独立时')],
 ['statistical negation omitted',texts=>texts[0]=texts[0].replace('并不显著','显著')],
 ['mortality precision changed',texts=>texts[0]=texts[0].replace('8.0%','8%')],
 ['p value omitted',texts=>texts[0]=texts[0].replace('（p = 0.08）','')],
 ['equation reference omitted',texts=>texts[1]=texts[1].replace('公式 (3) 和','')],
 ['figure reference changed',texts=>texts[1]=texts[1].replace('图 2','图 20')],
 ['one paragraph untranslated',texts=>texts[1]='The estimate is valid only if the observations are independent. See Eq. (3) and Fig. 2.'],
 ['one paragraph absent',texts=>texts.pop()]
])test(`paragraph probe rejects ${label}`,()=>{const texts=[...valid];change(texts);assert.throws(()=>assertParagraphTranslations(texts));});

for(const phrase of ['差异不显著','差异未达到统计学显著性','差异无统计学意义','差异没有显著性'])test(`paragraph probe accepts true statistical negation: ${phrase}`,()=>{
 const texts=[`死亡率由12.5%降至8.0%，但${phrase}（p = 0.08）。`,valid[1]];assert.doesNotThrow(()=>assertParagraphTranslations(texts));
});
for(const condition of ['仅当观测彼此独立时，估计才有效','只有观测彼此独立，估计才有效','唯有观测彼此独立，估计才有效'])test(`paragraph probe accepts a necessary condition: ${condition}`,()=>assert.doesNotThrow(()=>assertParagraphTranslations([valid[0],condition+'。参见式（3）和图2。'])));

test('observed 98 meaning-of-significance synonyms are true negation, not an unrelated negative word',()=>{
 for(const text of ['差异并不具有统计学意义','差异不具备统计意义'])assert.doesNotThrow(()=>assertStatisticalNegation(text));
 for(const text of ['不同组的差异具有统计学意义','不同组的差异显著'])assert.throws(()=>assertStatisticalNegation(text));
});
for(const text of ['均值-2.0摄氏度，95%置信区间为[1.2, 2.3]。','均值-2.0摄氏度，置信区间（95%）为[1.2, 2.3]。','均值-2.0摄氏度，置信水平为95%，区间为[1.2, 2.3]。','均值−2.0摄氏度，在95%置信水平下，区间为[1.2, 2.3]。'])test('scientific probe accepts a level attached to its interval: '+text,()=>assert.doesNotThrow(()=>assertConfidenceInterval(text)));
test('scientific probe rejects actual initial98 level/value confusion',()=>assert.throws(()=>assertConfidenceInterval('平均温度为-2.0摄氏度，置信区间为95%，区间为[1.2, 2.3]。')));
