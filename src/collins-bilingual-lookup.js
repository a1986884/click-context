import {phraseLemma,phraseEntry} from './phrases.js';
import {readPage} from './dictionary-fetch.js';
import {collinsQuery,bilingualSources} from './collins-sources.js';
import {lemmaCandidates} from './lemma-candidates.js';
function sourceFormMatches(query,head,forms=[]){
 if(query===head||forms.includes(query))return true;
 // Accept only an inflection confirmed by the returned source headword. Do not
 // invent another request or combine an unrelated headword with this entry.
 return !query.includes(' ')&&[head+'s',head+'es',head+'ed',head+'d',head+'ing',head.replace(/y$/,'ied'),head.replace(/y$/,'ies')].includes(query);
}
export async function lookupCollinsBilingual(word,{online=false,signal,fetcher=fetch,timeoutMs,parseHTML}={}){
 const original=word,query=phraseLemma(collinsQuery(word)),sourceUrls=bilingualSources(query);
 if(!online)throw Object.assign(Error('Collins 查词需要联网，请先允许此网站联网查询。'),{code:'ONLINE_REQUIRED',sourceUrls});
 const deadline=AbortSignal.timeout(18000),combined=signal?AbortSignal.any([signal,deadline]):deadline;
 const read=async(requested,requestSignal=combined,phrase=null)=>{
  const url=bilingualSources(requested)[0],entry=await parseHTML(await readPage(url.split('#')[0],{signal:requestSignal,fetcher,timeoutMs}),'youdao-senses',{phrase,signal:requestSignal});
  entry.lemma=collinsQuery(entry.head);entry.url=url;
  if(!sourceFormMatches(requested,entry.lemma,entry.forms))throw Object.assign(Error('来源返回的词条与查询不符，请查看词条来源。'),{code:'COLLINS_ENTRY_MISMATCH'});
  return entry;
 };
 let primary,missing;
 try{primary=await read(query);}catch(error){if(combined.aborted)throw error;if(!['NOT_FOUND','COLLINS_ENTRY_UNAVAILABLE'].includes(error.code)){error.sourceUrls=sourceUrls;throw error;}missing=error;}
 // A missing standalone expression may live inside one reviewed word entry.
 const anchor=phraseEntry(query);
 if(!primary?.senses.some(s=>!s.reference)&&anchor){
  try{const entry=await read(anchor,combined,query);primary={...entry,sourceHead:entry.lemma,lemma:query,head:query,phonetic:'',related:[],references:[]};}
  catch(error){if(combined.aborted||!['NOT_FOUND','COLLINS_ENTRY_UNAVAILABLE'].includes(error.code)){error.sourceUrls=[...new Set([...bilingualSources(anchor),...sourceUrls])];throw error;}missing=error;}
 }
 const references=primary?.references||[],candidates=(primary&&primary.lemma!==query||primary&&!references.length&&/(?:er|est)$/.test(query)?[]:lemmaCandidates(query,references)).filter(w=>w!==primary?.lemma);
 const controllers=candidates.map(()=>new AbortController());
 const extra=await Promise.allSettled(candidates.map(async(candidate,index)=>{
  const entry=await read(candidate,AbortSignal.any([combined,controllers[index].signal]));
  // Regular spelling hypotheses are alternatives. Once the source confirms one,
  // stop waiting for a slow invalid stem. Explicit ambiguous references retain all.
  if(!references.length&&entry.forms.includes(query))for(let i=0;i<controllers.length;i++)if(i!==index)controllers[i].abort();
  return entry;
 }));combined.throwIfAborted();
 const entries=primary?[primary]:[],rejected=[];
 for(let i=0;i<extra.length;i++){
  const item=extra[i];if(item.status==='rejected'){if(!controllers[i].signal.aborted)rejected.push(item.reason.code||'NETWORK');continue;}
  const entry=item.value;
  if(entry.forms.includes(query)||references.includes(entry.lemma)){if(!entries.some(e=>e.lemma===entry.lemma))entries.push(entry);}
 }
 const senses=[];
 // Keep independent surface senses first. Pure morphology stubs are links, not
 // useful senses; after expanding their source references they live in details.
 for(const [entryIndex,entry]of entries.entries())for(const sense of entry.senses){
  if(sense.reference)continue;if(senses.length>=64)break;
  senses.push({...sense,id:entryIndex===0?sense.id:'collins-'+(entryIndex+1)+'-'+sense.id.replace('collins-',''),lemma:entry.lemma,sourceUrl:entry.url,...(entry.sourceHead?{sourceHead:entry.sourceHead,expression:query}:{})});
 }
 if(!senses.length)return {word:query,original,lemma:query,kind:'unavailable',partial:true,zh:'',senses:[],definitions:[],source:'Collins 暂无可用词条',dictionaryError:missing?.message||'未能读取有效 Collins 义项',sourceUrls};
 const first=senses[0],head=primary?.head||query,lemma=first.lemma;
 return {word:head,original,lemma,zh:first.zh,zhSource:'Collins 英汉双解 · 有道公开词条',definitions:[(first.pos?first.pos+' · ':'')+first.definition],senses,relatedForms:primary?.related||[],phonetic:primary?.phonetic||entries[0].phonetic,example:first.examples?.[0]?.en||'',
  ...(primary?.sourceHead?{phraseSource:{head:primary.sourceHead,url:primary.url,expression:query}}:{}),
  morphology:primary?.sourceHead?'短语 '+query+' 收录于 Collins '+primary.sourceHead+' 词条；仅显示定义中确认的短语义项。':original.toLowerCase()!==query&&original.includes(' ')?'短语词形：'+original+' → '+query+'；按完整原形查询 Collins。':entries.length>1?'保留 '+query+' 的独立义项，并补充来源确认的 '+entries.filter(e=>e.lemma!==query).map(e=>e.lemma).join('、')+' 义项；按当前句子选义。':lemma!==query?'词形：'+original+' → '+lemma+(primary?.forms.includes(query)?'（Collins 词头变形表已确认）':references.includes(lemma)?'（Collins 词条引用已确认）':'（来源返回的规则词形）'):'按原词 '+query+' 读取 Collins；未将独立词义直接替换为原形。',
  kind:'collins',source:'Collins 英汉双解大词典 · 有道公开词条摘录'+(primary?.sourceHead?' · '+primary.sourceHead+' 词条内短语':''),sourceUrls:[...new Set([primary?.url,...entries.map(e=>e.url),...sourceUrls].filter(Boolean))],partial:rejected.some(code=>!['NOT_FOUND','COLLINS_ENTRY_UNAVAILABLE','COLLINS_ENTRY_MISMATCH'].includes(code)),license:{name:'© HarperCollins Publishers · 完整义项请查看来源'}};
}
