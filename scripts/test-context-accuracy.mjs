import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,writeFile} from 'node:fs/promises';
import {cleanContext,parseContextResult} from '../src/context-meaning.js';
import {phraseAt,phraseLemma} from '../src/phrases.js';
import {accuracyCases} from '../tests/live/context-accuracy-cases.mjs';
const run=promisify(execFile),id=new Date().toISOString().replace(/[:.]/g,'-'),dir='test-results/semantic-accuracy/'+id;await mkdir(dir,{recursive:true});let sequence=0;
const report={id,startedAt:new Date().toISOString(),kind:'finite serial development semantic QA; no retries',revisions:['ai-context-v3','ai-context-v4'],cases:[],status:'running'};
async function jsonRequest(url,body){
 const args=['-sS','--connect-timeout','10','--max-time','30','--max-filesize','300000','-w','\n%{http_code}'];
 if(body){const path=dir+'/request-'+(++sequence)+'.json';await writeFile(path,JSON.stringify(body));args.push('-H','Content-Type: application/json','-H','Origin: https://v04-preview.lextide.pages.dev','--data-binary','@'+path);}
 args.push(url);const {stdout}=await run('curl',args,{maxBuffer:500000}),at=stdout.lastIndexOf('\n'),status=Number(stdout.slice(at+1)),raw=stdout.slice(0,at);let value;try{value=JSON.parse(raw);}catch{throw Error('Non-JSON response HTTP '+status+': '+raw.slice(0,120));}return {status,value};
}
const dictionaries=new Map();
for(const sample of accuracyCases){
 const matches=[...sample.sentence.matchAll(new RegExp('\\b'+sample.word+'\\b','gi'))],offset=matches[sample.occurrence||0]?.index;if(offset===undefined)throw Error('Invalid fixture '+sample.id);const phrase=phraseAt(sample.sentence,offset,sample.word),word=phrase?.word||sample.word,at=phrase?.offset??offset,lemma=phraseLemma(word),record={...sample,queriedWord:word,offset:at,results:[]};report.cases.push(record);
 if(!dictionaries.has(lemma)){try{const r=await jsonRequest('https://v04-preview.lextide.pages.dev/api/dictionary?'+new URLSearchParams({word:lemma}));if(!r.value.ok)throw Error('Dictionary unavailable HTTP '+r.status);dictionaries.set(lemma,r.value.data);}catch(error){dictionaries.set(lemma,{senses:[],dictionaryError:error.message});}}
 const dictionary=dictionaries.get(lemma);record.dictionary={lemma,senses:dictionary.senses?.length||0,...(dictionary.dictionaryError?{error:dictionary.dictionaryError}:{})};
 for(const revision of report.revisions){const started=Date.now();let result;try{const input=cleanContext({word,sentence:sample.sentence,offset:at,senses:dictionary.senses||[],contextRevision:revision}),r=await jsonRequest('https://lextide-context.aa1986884.workers.dev/meaning',input);if(!r.value.ok){result={status:'unavailable',http:r.status,code:r.value.code,error:r.value.error};}else{const meaning=parseContextResult(r.value.data,input),selected=input.senses.find(s=>s.id===meaning.senseId),pass=new RegExp(sample.expected,'u').test(meaning.zh)&&!new RegExp(sample.forbidden,'u').test(meaning.zh);result={status:pass?'passed':'semantic-failed',meaning,selected};}}catch(error){result={status:'unavailable',error:error.message};}result.revision=revision;result.ms=Date.now()-started;record.results.push(result);await writeFile(dir+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({id:sample.id,revision,status:result.status,zh:result.meaning?.zh,error:result.error}));}
}
report.finishedAt=new Date().toISOString();report.status=report.cases.every(c=>c.results.every(r=>r.status==='passed'))?'passed':'needs-review';await writeFile(dir+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({runDirectory:dir,status:report.status}));
