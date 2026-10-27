// Public-safe held-out sentences. The oracle is intentionally independent of prompts.
export const accuracyCases=[
 {id:'generic-station',word:'station',sentence:'The station is closed today.',expected:'站',forbidden:'火车|铁路|警察|警局|电台|电视台'},
 {id:'explicit-police-station',word:'station',sentence:'She reported the theft at the police station.',expected:'站|局|所',forbidden:'火车|铁路'},
 {id:'generic-tree',word:'tree',sentence:'They waited under the tree.',expected:'树',forbidden:'松树|柏树|橡树|榆树|柳树'},
 {id:'metal-lead',word:'lead',sentence:'The old pipes were made of lead.',expected:'铅',forbidden:'带领|领导|线索'},
 {id:'inflected-led',word:'led',sentence:'She led the team through the forest.',expected:'带领|引领|领导|引导',forbidden:'铅|二极管'},
 {id:'first-saw',word:'saw',sentence:'She saw the saw on the bench.',occurrence:0,expected:'看|见',forbidden:'锯'},
 {id:'second-saw',word:'saw',sentence:'She saw the saw on the bench.',occurrence:1,expected:'锯',forbidden:'看见|看到'},
 {id:'mechanical-strain',word:'strain',sentence:'The engineer measured the strain in the steel beam.',expected:'应变|形变',forbidden:'菌株|应力|压力|拉伤'},
 {id:'electric-charge',word:'charge',sentence:'The electron has a negative charge.',expected:'电荷',forbidden:'收费|费用|指控|冲锋'},
 {id:'control-modifier',word:'control',sentence:'The control group received a placebo.',expected:'对照|参照',forbidden:'组|群'},
 {id:'phrase-rule-out',word:'ruled',sentence:'The investigators ruled out a wiring fault.',expected:'排除',forbidden:'统治|裁决'},
 {id:'literal-carry-out',word:'carried',sentence:'They carried out the broken chair through the doorway.',expected:'搬|抬|拿|运',forbidden:'执行|实施|开展|完成'}
];
