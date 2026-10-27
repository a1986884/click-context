// Introduced after the v5 medium-generation and ambiguity-review prompts froze.
// These examples and expected answers are never included in model instructions.
export const generalizationAccuracyCases=[
 {id:'generalization-rose-verb',word:'rose',sentence:'The price rose after the announcement.',expected:'涨|上升|升高',forbidden:'玫瑰',expectedLemma:'rise',expectedPOS:'VERB'},
 {id:'generalization-rose-flower',word:'rose',sentence:'A rose stood in the vase beside the window.',expected:'玫瑰',forbidden:'上涨|上升',expectedLemma:'rose',expectedPOS:'NOUN'},
 {id:'generalization-minute',word:'minute',sentence:'The scientist noticed a minute crack in the glass.',expected:'微小|细小|极小',forbidden:'分钟|分种',expectedLemma:'minute',expectedPOS:'ADJ'},
 {id:'generalization-fine',word:'fine',sentence:'The driver paid the fine before leaving.',expected:'罚款|罚金',forbidden:'晴朗|精细',expectedLemma:'fine',expectedPOS:'NOUN'},
 {id:'generalization-novel',word:'novel',sentence:'They proposed a novel approach to the problem.',expected:'新颖|新奇|创新',forbidden:'小说',expectedLemma:'novel',expectedPOS:'ADJ'},
 {id:'generalization-spring-mechanism',word:'spring',sentence:'The mechanic replaced the spring in the switch.',expected:'弹簧',forbidden:'春天|春季|泉水',expectedLemma:'spring',expectedPOS:'NOUN'},
 {id:'generalization-spring-season',word:'spring',sentence:'The flowers bloom in spring.',expected:'春天|春季',forbidden:'弹簧|泉水',expectedLemma:'spring',expectedPOS:'NOUN'},
 {id:'generalization-plastic-modifier',word:'plastic',sentence:'The plastic container fell from the shelf.',expected:'塑料|塑胶',forbidden:'容器|盒子'},
 {id:'generalization-research-modifier',word:'research',sentence:'The research assistant checked the records.',expected:'研究|科研',forbidden:'助理|助手|助研员'},
 {id:'generalization-charge',word:'charged',sentence:'They charged him with theft.',expected:'指控|控告|起诉',forbidden:'电荷|充电|收费',expectedLemma:'charge',expectedPOS:'VERB'},
 {id:'generalization-account',word:'account',sentence:'She gave an account of the journey.',expected:'叙述|描述|说明|记述',forbidden:'银行|账户',expectedLemma:'account',expectedPOS:'NOUN'},
 {id:'generalization-conduct',word:'conduct',sentence:'Copper can conduct electricity.',expected:'传导|导电|传递',forbidden:'行为|指挥',expectedLemma:'conduct',expectedPOS:'VERB'}
];
