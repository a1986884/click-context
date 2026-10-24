// Tickets may be free: obtaining/availability is valid; do not require a purchase.
import {lookupCollinsBilingual} from '../../src/collins-bilingual.js';
import {createContextClient} from '../../src/context-meaning.js';
import {writeFile} from 'node:fs/promises';
const fetcher=(url,options={})=>fetch(url,{...options,headers:{...options.headers,'User-Agent':'Lextide-Cloud-QA/1.0 (interactive notebook acceptance test)'}});
const resolve=createContextClient({fetcher}),entries=new Map(),report=[];
for(const [word,sentence,expected] of [
 ['bank','She deposited her salary at the bank.','银行'],['bank','They sat on the bank beside the river.','岸'],
 ['light','This suitcase is light enough for a child to carry.','轻'],['light','Please turn on the light in the kitchen.','灯'],
 ['plant','The car plant employs two thousand workers.','厂'],['plant','Water this plant twice a week.','植物'],
 ['available','Tickets are available online from Monday.','购买|售|购|获得|获取|领取'],['available','Are you available for a meeting tomorrow?','有空|时间|方便'],
 ['charge','They charge ten dollars for delivery.','收'],['charge','You need to charge the battery before using it.','充电']]){
 try{if(!entries.has(word))entries.set(word,await lookupCollinsBilingual(word,{online:true,fetcher}));const entry=entries.get(word);const started=Date.now();const result=await resolve({word,sentence,offset:sentence.indexOf(word),senses:entry.senses});report.push({word,sentence,expected,...result,matchedCollins:entry.senses.find(s=>s.id===result.senseId)?.zh,elapsedMs:Date.now()-started,passed:new RegExp(expected).test(result.zh)});}catch(e){report.push({word,sentence,error:e.message,passed:false});}
 console.log(JSON.stringify(report.at(-1)));
}
await writeFile('test-results/live-context-api.json',JSON.stringify(report,null,2));

if(report.some(r=>!r.passed))process.exitCode=1;
