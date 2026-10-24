import assert from 'node:assert/strict';
export const scienceCases=[
 {id:'confidence80',text:'The estimate has an 80% confidence interval of [4.0, 9.0].',level:'80',values:['4.0','9.0']},
 {id:'confidence99.9',text:'The effect has a 99.9% confidence interval of [0.1, 0.7].',level:'99.9',values:['0.1','0.7']},
 {id:'double-negation',text:'The test did not rule out infection, and a negative result does not guarantee recovery.'},
 {id:'not-all-and-none',text:'Not all participants improved; none of the patients received placebo.'},
 {id:'chemical-and-references',text:'NaCl at 0.9% was heated to -2.0 degrees Celsius; see Fig. 12 and Eq. (4).'},
 {id:'heldout-acid',text:'H2SO4 was added at 25.0 degrees Celsius, and the pH remained 7.0.'},
 {id:'heldout-gases',text:'CO2 increased by 5.0%, while O2 did not decrease.'},
 {id:'heldout-threshold',text:'The NaCl sample was not heated above 20.0 degrees Celsius.'},
 {id:'long-separate-observations',text:Array.from({length:16},(_,i)=>'In trial '+(i+1)+', output rose by 5.0%, while cost did not fall.').join(' ')}
];
export function assertScientificTranslation(text,index){
 assert.match(text,/[\u3400-\u9fff]/u,'English prose must be translated into Chinese');
 const item=scienceCases[index],value=text.normalize('NFKC').replace(/[−﹣－]/gu,'-');
 if(item.level){const escaped=item.level.replaceAll('.',String.raw`\.`);for(const number of [item.level,...item.values])assert.ok(value.includes(number),'Scientific value must remain: '+number);assert.doesNotMatch(value,new RegExp(String.raw`置信区间\s*(?:为|是|等于|=|:)\s*${escaped}\s*%`,'u'),'Confidence level is not an interval endpoint');assert.match(value,new RegExp(String.raw`(?:${escaped}\s*%\s*(?:的)?\s*置信(?:区间|水平|度)|置信(?:水平|度|系数)\s*(?:为|是|:)?\s*${escaped}\s*%)`,'u'),'The confidence level must remain attached to the interval');}
 if(item.id==='double-negation'){assert.match(value,/(?:未|没有|不能|并未)(?:能)?排除感染/u);assert.match(value,/(?:不(?:能)?|未|没有)(?:能)?(?:保证|确保|意味着|代表)/u);assert.match(value,/康复|恢复/u);}
 if(item.id==='not-all-and-none'){assert.match(value,/(?:并非|不是|并不是|非|不)(?:所有|每|全部)/u);assert.match(value,/(?:没有|无|未有).{0,10}(?:患者|病人)|(?:所有|全部)(?:的)?(?:患者|病人).{0,8}(?:未|没有)(?:接受|服用|使用|获得|给予)/u);assert.match(value,/安慰剂/u);}
 if(['chemical-and-references','heldout-acid','heldout-threshold'].includes(item.id))assert.match(value,/摄氏|°\s*C\b|\bCelsius\b/iu,'The explicit Celsius unit must remain');
 if(item.id==='chemical-and-references'){assert.match(value,/NaCl/u);for(const number of ['0.9','-2.0','12','4'])assert.ok(value.includes(number));}
 if(item.id==='heldout-acid'){assert.match(value,/H2SO4/u);assert.match(value,/pH/u);for(const n of ['25.0','7.0'])assert.ok(value.includes(n));}
 if(item.id==='heldout-gases'){for(const token of ['CO2','O2','5.0'])assert.ok(value.includes(token));assert.match(value,/O2.{0,8}(?:没有|未|不).{0,4}(?:减少|下降)/u);}
 if(item.id==='heldout-threshold'){assert.match(value,/NaCl/u);assert.ok(value.includes('20.0'));assert.match(value,/未|没有|不曾/u);assert.match(value,/以上|超过|高于/u);}
 if(item.id==='long-separate-observations'){for(let n=1;n<=16;n++)assert.match(value,new RegExp(String.raw`(?<!\d)${n}(?!\d)`,'u'));assert.ok([...value.matchAll(/5\.0/gu)].length>=16);assert.ok([...value.matchAll(/成本/gu)].length>=16);}
}
