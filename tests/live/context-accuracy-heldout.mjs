// A separate cohort introduced after the independent interpretation design froze.
export const heldoutAccuracyCases=[
 {id:'holdout-terminal',word:'terminal',sentence:'The terminal is closed for maintenance.',expected:'终端|终点|站|类型|不明',forbidden:'航站楼|机场|航空|计算机|电脑'},
 {id:'holdout-stress',word:'stress',sentence:'The engineer calculated the stress in the metal sample.',expected:'应力',forbidden:'应变|心理|紧张'},
 {id:'holdout-culture',word:'culture',sentence:'The technician incubated the bacterial culture overnight.',expected:'培养|菌',forbidden:'文化|修养'},
 {id:'holdout-liquid',word:'liquid',sentence:"The bank's assets are liquid.",expected:'变现|流动',forbidden:'液体|液态|液状'},
 {id:'holdout-appeal',word:'appeal',sentence:'She filed the appeal before the deadline.',expected:'上诉|申诉',forbidden:'吸引|魅力'},
 {id:'holdout-mouse-animal',word:'mouse',sentence:'The mouse ran under the cupboard.',expected:'鼠',forbidden:'鼠标'},
 {id:'holdout-mouse-device',word:'mouse',sentence:'She clicked the mouse to select the file.',expected:'鼠标',forbidden:'老鼠|小鼠'},
 {id:'holdout-light',word:'light',sentence:'The light suitcase was easy to lift.',expected:'轻|不重',forbidden:'灯|光线|浅色'},
 {id:'holdout-steel-modifier',word:'steel',sentence:'The steel bridge spans the river.',expected:'钢',forbidden:'桥'},
 {id:'holdout-name',word:'Hart',sentence:'Professor Hart reviewed the paper.',expected:'哈特|姓氏|人名|名字',forbidden:'鹿|雄鹿'},
 {id:'holdout-mercury-planet',word:'Mercury',sentence:'Mercury is the closest planet to the Sun.',expected:'水星',forbidden:'水银|汞'},
 {id:'holdout-mercury-element',word:'mercury',sentence:'The thermometer contains mercury.',expected:'汞|水银',forbidden:'水星'}
];
