// Real source pages + real context AI. Semantic checks are a small regression
// sample, not a general accuracy claim or native-installation acceptance.
import {lookupCollinsBilingual} from '../../src/collins-bilingual.js';
import {createContextClient} from '../../src/context-meaning.js';
import {mkdir,writeFile} from 'node:fs/promises';
const fetcher=(url,options={})=>fetch(url,{...options,headers:{...options.headers,'User-Agent':'Lextide-Cloud-QA/1.0 (interactive notebook acceptance test)'}});
const context=createContextClient({fetcher}),entries=new Map(),results=[];
const cases=[
 ['stopping','The bus is stopping at the next station.','停','stop'],['stopping','The dentist replaced the stopping in my tooth.','牙|填','stopping'],
 ['building','The building has twelve floors.','建筑|大楼','building'],['building','They are building a school.','建造|修建',null],
 ['bought','She bought a new camera yesterday.','购|买','buy'],['taken','He has taken the keys.','拿|取','take'],
 ['leaves','The leaves turn red in autumn.','叶','leaf'],['leaves','She leaves for work at eight.','离开|出发|去上班','leave'],
 ['happier','She feels happier after the trip.','快乐|高兴|开心','happy'],
 ['saw','He cut the wood with a saw.','锯','saw'],['saw','I saw a fox near the river.','看|见','see'],
 ['using','She is using a pencil to draw.','使用|用','use'],['Zqv',"Zqv is our team's internal project name.",'名称|名字|项目|代号',null]
];
await mkdir('test-results',{recursive:true});
for(const [word,sentence,expected,expectedLemma]of cases){
 try{let calls=0;if(!entries.has(word)){const entry=await lookupCollinsBilingual(word,{online:true,fetcher:(...args)=>{calls++;return fetcher(...args);}});entries.set(word,{entry,calls});}const {entry,calls:sourceRequests}=entries.get(word),start=Date.now();
 const result=await context({word,sentence,offset:sentence.indexOf(word),senses:entry.senses});const chosen=entry.senses.find(s=>s.id===result.senseId),semantic=new RegExp(expected).test(result.zh);
 // For building the live source currently omits build; explicit AI-only fallback
 // is accepted, but an unrelated noun sense must never be labeled matched.
 const sourceOK=expectedLemma?chosen?.lemma===expectedLemma:!chosen||word==='building'&&chosen.lemma==='build';
 results.push({word,sentence,candidateLemmas:[...new Set(entry.senses.map(s=>s.lemma))],sourceRequests,...result,selectedLemma:chosen?.lemma||null,elapsedMs:Date.now()-start,semantic,sourceOK,passed:semantic&&sourceOK});
 }catch(error){results.push({word,sentence,error:error.message,passed:false});}
 console.log(JSON.stringify(results.at(-1)));
}
await writeFile('test-results/general-forms-live.json',JSON.stringify({kind:'live dictionary and AI regression',nativeExtensionInstalled:false,results},null,2));
if(results.some(r=>!r.passed))process.exitCode=1;
