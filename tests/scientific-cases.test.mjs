import test from 'node:test';import assert from 'node:assert/strict';
import {scienceCases,assertScientificTranslation} from './live/science-cases.mjs';
const at=id=>scienceCases.findIndex(x=>x.id===id);
test('scientific cohort rejects unchanged English even when formulas and every number are present',()=>assert.throws(()=>assertScientificTranslation(scienceCases[at('chemical-and-references')].text,at('chemical-and-references'))));
test('none-of-patients validator accepts equivalent Chinese negation but rejects partial or opposite claims',()=>{
 const index=at('not-all-and-none');for(const text of ['并非所有参与者都有改善；没有患者接受安慰剂。','并非所有参与者都有改善；所有患者均未接受安慰剂。'])assertScientificTranslation(text,index);
 for(const text of ['所有参与者都有改善；没有患者接受安慰剂。','并非所有参与者都有改善；所有患者均接受安慰剂。','并非所有参与者都有改善；部分患者没有接受安慰剂。'])assert.throws(()=>assertScientificTranslation(text,index));
});
test('held-out chemical cases preserve tokens, precision, negative direction and threshold',()=>{
 const values=[['heldout-acid','在25.0摄氏度加入H2SO4，pH保持7.0。'],['heldout-gases','CO2增加了5.0%，而O2没有减少。'],['heldout-threshold','该NaCl样品未加热至20.0摄氏度以上。']];for(const [id,text]of values)assertScientificTranslation(text,at(id));assert.throws(()=>assertScientificTranslation('CO2增加了5.0%，而O2减少。',at('heldout-gases')));assert.throws(()=>assertScientificTranslation('该NaCl样品未加热至20.0摄氏度以下。',at('heldout-threshold')));
});

test('scientific cohort rejects actual122 Celsius omission and a wrong temperature scale',()=>{
 const index=at('chemical-and-references');
 for(const value of ['NaCl 在 0.9% 时被加热至 -2.0 度；见图 12 和 Eq. (4)。','0.9%的NaCl被加热至-2.0华氏度；见图12和式(4)。'])assert.throws(()=>assertScientificTranslation(value,index));
 for(const value of ['0.9%的NaCl被加热至-2.0摄氏度；见图12和式(4)。','0.9%的NaCl被加热至-2.0℃；见图12和式(4)。'])assertScientificTranslation(value,index);
});
