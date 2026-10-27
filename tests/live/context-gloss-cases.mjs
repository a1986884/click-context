import assert from 'node:assert/strict';

// Original public-safe samples. Finite positive/negative checks still need human review.
export const contextSamples=[
 ['bank','She deposited her salary at the bank.','银行|金融机构'],
 ['bank','They sat on the bank beside the river.','岸'],
 ['available','Tickets are available online from Monday.','购买|售|购|获得|获取|领取|取得'],
 ['available','Are you available for a meeting tomorrow?','有空|时间|方便'],
 ['hugging','She was hugging her daughter tightly.','抱|搂'],
 ['listed','The company is listed on the London Stock Exchange.','上市|挂牌'],
 ['wound','She wound the bandage around the wound.','缠|绕',0],
 ['wound','She wound the bandage around the wound.','伤',1],
 ['tear','A tear rolled down her cheek as she noticed a tear in the curtain.','泪',0],
 ['tear','A tear rolled down her cheek as she noticed a tear in the curtain.','裂|破口|破洞',1],
 ['bass','The bass player cooked a bass for dinner.','低音|贝斯|贝司',0,'optional','演奏|乐手|乐师|贝斯手|贝司手|提琴手'],
 ['bass','The bass player cooked a bass for dinner.','鲈',1,'optional','鳜|桂鱼'],
 // Held-out compounds: these words/sentences are not examples in the model prompt.
 ['coffee','She put the coffee cup on the table.','咖啡',0,'optional','杯'],
 ['stone','The stone wall stood beside the path.','石|岩',0,'optional','墙'],
 ['chicken','The chef served chicken soup for lunch.','鸡',0,'optional','汤'],
 ['train','We waited outside the train station.','火车|列车',0,'optional','车站|站台'],
 ['baby','They installed a baby seat in the car.','婴|幼|宝宝',0,'optional','座|椅'],
 ['wine','He washed the wine glass after dinner.','葡萄酒|酒',0,'optional','杯'],
 ['bass','The bass speaker was beside the stage.','低音|低频|贝斯|贝司',0,'optional','扬声器|音箱'],
 ['power','Press the power button to start the computer.','电源|电力',0,'optional','按钮'],
 ['laser','The office bought a laser printer.','激光',0,'optional','打印机|打印器'],
 ['history','The history teacher explained the event.','历史',0,'optional','教师|老师'],
 ['emergency','They opened the emergency exit.','紧急|应急',0,'optional','出口'],
 ['bass','The angler released the bass back into the lake.','鲈',0,'optional','鳜|桂鱼']
];

export function assertContextGloss(zh,{expected,forbidden}){
 assert.match(zh,new RegExp(expected,'u'),'Unexpected contextual meaning');
 if(forbidden)assert.doesNotMatch(zh,new RegExp(forbidden,'u'),'Gloss includes an unselected head noun or incorrect extra classification');
}

// Three independent fresh-page trials of the reported sentence, plus two
// contrasting meanings. The harness must observe a real request for each trial.
export const classStabilitySamples=[
 ...Array.from({length:3},()=>['class','This class is co-taught by Anish, Jon, and Jose.','课程']),
 ['class','The class applauded when the teacher entered.','班|学生'],
 ['class','She teaches a class on modern history.','课|课程']
];
