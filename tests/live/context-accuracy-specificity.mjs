// New evaluation cohort; never interpolate expected/forbidden values into prompts.
// Ambiguous items require human review even when their lexical rules pass.
export const specificityAccuracyCases=[
 {id:'specificity-terminal-closed',word:'terminal',sentence:'The terminal is closed for maintenance.',expected:'终端|终点|类型|不明',forbidden:'航站楼|机场|航空|电脑|计算机',manualReview:true},
 {id:'specificity-terminal-air',word:'terminal',sentence:'Passengers checked their boarding passes inside the airport terminal.',expected:'航站楼|候机楼',forbidden:'计算机|疾病|晚期'},
 {id:'specificity-terminal-computer',word:'terminal',sentence:'The operator typed commands at a computer terminal.',expected:'终端',forbidden:'航站楼|疾病|晚期'},
 {id:'specificity-terminal-illness',word:'terminal',sentence:'The patient was diagnosed with a terminal illness.',expected:'晚期|不治|绝症',forbidden:'航站楼|终点站',expectedPOS:'ADJ'},
 {id:'specificity-station-repaired',word:'station',sentence:'The station is being repaired.',expected:'站|台|类型|不明',forbidden:'火车|铁路|地铁|广播|电视|警察',manualReview:true},
 {id:'specificity-station-rail',word:'station',sentence:'The train stopped at the railway station.',expected:'火车站|铁路车站|车站',forbidden:'电视台|警察局'},
 {id:'specificity-station-broadcast',word:'station',sentence:'The radio station broadcasts local news.',expected:'电台|广播台',forbidden:'火车站|地铁站'},
 {id:'specificity-port-closed',word:'port',sentence:'The port is closed for maintenance.',expected:'港|端口|类型|不明',forbidden:'深水港|集装箱港|串口|USB',manualReview:true},
 {id:'specificity-port-shipping',word:'port',sentence:'Cargo ships entered the port at dawn.',expected:'港口|港',forbidden:'端口|接口|葡萄酒'},
 {id:'specificity-port-network',word:'port',sentence:'The firewall blocks connections to this TCP port.',expected:'端口',forbidden:'港口|葡萄酒'},
 {id:'specificity-saw-verb',word:'saw',sentence:'She saw the saw on the bench.',occurrence:0,expected:'看见|看到',forbidden:'锯',expectedLemma:'see',expectedPOS:'VERB'},
 {id:'specificity-saw-noun',word:'saw',sentence:'She saw the saw on the bench.',occurrence:1,expected:'锯',forbidden:'看见|看到',expectedLemma:'saw',expectedPOS:'NOUN'},
 {id:'specificity-bass-modifier',word:'bass',sentence:'The bass player cooked a bass for dinner.',occurrence:0,expected:'贝斯|贝司|低音',forbidden:'手|演奏者|乐师|鲈鱼'},
 {id:'specificity-bass-fish',word:'bass',sentence:'The bass player cooked a bass for dinner.',occurrence:1,expected:'鲈',forbidden:'贝斯|贝司|低音|演奏'},
 {id:'specificity-strain',word:'strain',sentence:'The strain is the change in length divided by the original length.',expected:'应变',forbidden:'应力|压力|菌株'},
 {id:'specificity-stress',word:'stress',sentence:'Stress equals force divided by the cross-sectional area.',expected:'应力',forbidden:'应变|心理|紧张'},
 {id:'specificity-silver-modifier',word:'silver',sentence:'The silver necklace lay on the desk.',expected:'银',forbidden:'项链',manualReview:true},
 {id:'specificity-coffee-modifier',word:'coffee',sentence:'The coffee cup is empty.',expected:'咖啡',forbidden:'杯|咖啡色'},
];
export function accuracyCaseInput(sample){
 const escaped=sample.word.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),matches=[...sample.sentence.matchAll(new RegExp('(?<![A-Za-z])'+escaped+'(?![A-Za-z])','gi'))],offset=matches[sample.occurrence||0]?.index;
 if(offset===undefined)throw Error('Invalid accuracy occurrence: '+sample.id);
 return {word:sample.word,sentence:sample.sentence,offset,senses:[]};
}
export function evaluateAccuracyMeaning(sample,meaning){
 const lexicalPass=new RegExp(sample.expected,'u').test(meaning.zh)&&(!sample.forbidden||!new RegExp(sample.forbidden,'u').test(meaning.zh)),lemmaPass=!sample.expectedLemma||meaning.lemma===sample.expectedLemma,posPass=!sample.expectedPOS||meaning.pos===sample.expectedPOS;
 return {lexicalPass,lemmaPass,posPass,status:!lexicalPass||!lemmaPass||!posPass?'failed':sample.manualReview?'needs-human-review':'rules-passed'};
}
