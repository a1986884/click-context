import {CLIENT_TRANSLATION_CACHE_VERSION} from './translation-client-validation.js';
import {cleanBubblePosition} from './protocol.js';
import {parseVocabularyBackup,WORD_LIMIT,vocabularyKey,vocabularyReviewMetadata,vocabularyDraftKey} from './vocabulary-data.js';
// One schema for Demo and extension. The extension supplies a background-owned adapter.
export const DEFAULT_PREFS={mode:'bilingual',words:true,online:false,enabled:false,side:'right',bubblePosition:null,translationUnit:'paragraph'};
const CACHE_VERSION=CLIENT_TRANSLATION_CACHE_VERSION;
export const CACHE_BUCKETS=16,CACHE_BUCKET_LIMIT=256,CACHE_BUCKET_BYTES=128*1024;
function cacheBucket(text){let hash=2166136261;for(let i=0;i<text.length;i++)hash=Math.imul(hash^text.charCodeAt(i),16777619);return 'translation-cache:v3:'+((hash>>>0)%CACHE_BUCKETS);}
export const CACHE_TTL=7*24*60*60*1000;
function vocabularyReadError(){return Object.assign(Error('已有生词数据无法读取，未修改任何内容。请保留原始数据并检查备份。'),{code:'VOCABULARY_READ_FAILED'});}
export function createStore(adapter,{now=Date.now}={}){
 let queue=Promise.resolve();
 const serial=fn=>{const job=queue.then(()=>adapter.exclusive?adapter.exclusive(fn):fn());queue=job.catch(()=>{});return job;};
 const get=async key=>await adapter.get(key);
 const readWords=async()=>{let words;try{words=await get('words');}catch{throw vocabularyReadError();}if(words==null)return [];if(!Array.isArray(words))throw vocabularyReadError();return words;};
 const set=async(key,value)=>{try{return await adapter.set(key,value);}catch(error){
  const message=String(error?.message||error||''),rate=/WRITE_OPERATIONS|write[ -]?rate/i.test(message);
  if(['QuotaExceededError','NS_ERROR_DOM_QUOTA_REACHED'].includes(error?.name)||!rate&&/QUOTA_BYTES|quota.*exceed|exceed.*quota|storage.*full/i.test(message))throw Object.assign(Error('浏览器存储空间已满，请清除翻译缓存，或导出生词本并整理收藏后重试。'),{code:'STORAGE_FULL'});
  throw error;
 }};
 const checkDraft=(current,expected)=>{if(expected!==undefined&&JSON.stringify(current??null)!==JSON.stringify(expected))throw Object.assign(Error('草稿已在其他窗口变化，已保留新草稿；请取消当前编辑后重新核对。'),{code:'DRAFT_CONFLICT'});};
 const readDrafts=async()=>{const drafts=await get('vocabulary-drafts');if(drafts==null)return [];if(!Array.isArray(drafts)||drafts.length>20||drafts.some(d=>!d||typeof d.key!=='string'||!d.entry||typeof d.entry.word!=='string'||typeof d.text!=='string'||d.text.length>500||JSON.stringify(d.entry).length>10000||d.key!==vocabularyKey(d.entry)||d.id!==undefined&&(typeof d.id!=='string'||!/^[a-z0-9-]{8,80}$/i.test(d.id))))throw Error('草稿数据无法读取，未修改已有草稿。');return drafts;};
 return {
  async prefs(){const p=await get('prefs')||{};return {...DEFAULT_PREFS,...p,mode:['original','bilingual','translated'].includes(p.mode)?p.mode:DEFAULT_PREFS.mode,words:p.words!==false,online:p.online===true,enabled:p.enabled===true,translationUnit:p.translationUnit==='sentence'?'sentence':'paragraph',bubblePosition:cleanBubblePosition(p.bubblePosition),side:p.side==='left'?'left':'right'};},
  savePrefs(p){return serial(()=>set('prefs',Object.fromEntries(Object.keys(DEFAULT_PREFS).filter(k=>k in p).map(k=>[k,p[k]]))));},
  async words(){return (await readWords()).filter(w=>w&&typeof w.word==='string');},
  saveWord(entry){return serial(async()=>{const words=[...await readWords()];const lemma=entry.lemma.toLowerCase();const item={word:entry.word,lemma,zh:entry.zh||'',sentence:entry.sentence||'',source:entry.source||'',dictionarySource:entry.dictionarySource||'',savedAt:new Date(now()).toISOString(),...vocabularyReviewMetadata(entry)};const found=words.find(w=>vocabularyKey(w)===vocabularyKey(item));if(found)return found;if(words.length>=WORD_LIMIT)throw Object.assign(Error('生词本已满（5,000 个），请先导出整理。'),{code:'VOCABULARY_FULL'});words.push(item);await set('words',words);return item;});},
  removeWord(lemma){return serial(async()=>{const words=await readWords(),remaining=words.filter(w=>vocabularyKey(w)!==lemma&&w.lemma!==lemma);if(remaining.length!==words.length)await set('words',remaining);});},
  updateWord(key,patch,expected){return serial(async()=>{
   if(typeof key!=='string'||!patch||typeof patch!=='object'||Array.isArray(patch)||!Object.keys(patch).length||Object.keys(patch).some(k=>!['zh','reviewState'].includes(k))||'zh'in patch&&(typeof patch.zh!=='string'||!patch.zh.trim()||patch.zh.length>500)||'reviewState'in patch&&!['pending','reviewed'].includes(patch.reviewState))throw Error('无效收藏修改：释义须为 1–500 个字符。');
   const words=[...await readWords()],index=words.findIndex(w=>vocabularyKey(w)===key);
   if(index<0)throw Error('这条收藏已被删除或修改，请刷新后重试。');
   const original=words[index],item={...original};
   if(expected&&JSON.stringify(original)!==JSON.stringify(expected))throw Error('这条收藏已在其他窗口发生变化，未覆盖新内容。草稿仍保留，请重新核对。');
   if('zh'in patch&&patch.zh.trim()!==original.zh){item.zh=patch.zh.trim();item.editedAt=new Date(now()).toISOString();item.reviewState='pending';}
   if('reviewState'in patch)item.reviewState=patch.reviewState;
   if(words.some((w,i)=>i!==index&&vocabularyKey(w)===vocabularyKey(item)))throw Error('已有相同释义和原句的收藏，未覆盖任何记录。');
   if(JSON.stringify(item)!==JSON.stringify(original)){words[index]=item;await set('words',words);}return item;
  });},
  async vocabularyDrafts(){return readDrafts();},
  saveVocabularyDraft(entry,text,expected,id){return serial(async()=>{
   if(!entry||typeof entry.word!=='string'||typeof text!=='string'||text.length>500||JSON.stringify(entry).length>10000||id!=null&&(typeof id!=='string'||!/^[a-z0-9-]{8,80}$/i.test(id)))throw Error('草稿格式无效。');
   const drafts=await readDrafts();
   const key=vocabularyKey(entry),identity=id||key;checkDraft(drafts.find(d=>vocabularyDraftKey(d)===identity),expected);const remaining=drafts.filter(d=>vocabularyDraftKey(d)!==identity);
   if(text===(entry.zh||'')){await set('vocabulary-drafts',remaining);return null;}
   if(remaining.length>=20)throw Error('已暂存 20 条草稿，请先恢复或放弃旧草稿。');
   const draft={key,...(id?{id}:{}),entry,text,at:new Date(now()).toISOString(),revision:globalThis.crypto?.randomUUID?.()||String(now())+'-'+Math.random().toString(36).slice(2)};await set('vocabulary-drafts',[draft,...remaining]);return draft;
  });},
  removeVocabularyDraft(key,expected){return serial(async()=>{const drafts=await readDrafts();checkDraft(drafts.find(d=>vocabularyDraftKey(d)===key),expected);await set('vocabulary-drafts',drafts.filter(d=>vocabularyDraftKey(d)!==key));});},
  async cacheGet(text,namespace=CACHE_VERSION){
   const c=await get(cacheBucket(text))||{},key=namespace+'|'+text,e=c[key];
   if(e&&typeof e.value==='string'&&now()-e.at<CACHE_TTL)return e.value;
   return null; // A different provider's cached text must never be labeled as Cloudflare AI.
  },
  cacheSet(text,value,namespace=CACHE_VERSION){return serial(async()=>{
   const bucket=cacheBucket(text),old=await get(bucket)||{},key=namespace+'|'+text,at=now(),entries=Object.entries({[key]:{at,value},...Object.fromEntries(Object.entries(old).filter(([k])=>k!==key))}).filter(([,e])=>typeof e?.value==='string'&&at-e.at<CACHE_TTL).sort((a,b)=>b[1].at-a[1].at);
   let bytes=2;const kept=[];
   for(const entry of entries){const json=JSON.stringify(entry),size=Math.max(json.length*2,new TextEncoder().encode(json).length)+2;if(kept.length>=CACHE_BUCKET_LIMIT||bytes+size>CACHE_BUCKET_BYTES)continue;kept.push(entry);bytes+=size;}
   await set(bucket,Object.fromEntries(kept));
  });},
  importWords(data){return serial(async()=>{const incoming=parseVocabularyBackup(data);const current=await readWords();const seen=new Set(current.map(vocabularyKey));const added=[];let duplicates=0;for(const word of incoming){if(seen.has(vocabularyKey(word))){duplicates++;continue;}seen.add(vocabularyKey(word));added.push(word);}if(current.length+added.length>WORD_LIMIT)throw Object.assign(Error('生词本最多保留 5,000 个收藏，请先导出整理。'),{code:'VOCABULARY_FULL'});if(added.length)await set('words',[...current,...added]);return {added:added.length,duplicates};});},
  clearCache(){return serial(async()=>{for(const key of ['translations',...Array.from({length:CACHE_BUCKETS},(_,i)=>'translation-cache:v3:'+i)])if(await get(key)!=null)await set(key,{});});}
 };
}
export function demoStore(){return createStore({
 exclusive:fn=>globalThis.navigator?.locks?.request?globalThis.navigator.locks.request('click-context:v2:store-write',fn):fn(),
 get:async key=>{
  try{
   const value=JSON.parse(localStorage.getItem('lextide:v2:'+key)??'null');
   if(key==='words'&&value===null){
    const legacy=JSON.parse(localStorage.getItem('lextide-saved')??'[]');if(!Array.isArray(legacy))throw vocabularyReadError();
    // Reading/exporting legacy favorites must not allocate space or modify them.
    return [...new Set(legacy.filter(w=>typeof w==='string'&&/^[a-z'-]{1,80}$/i.test(w)))].map(word=>({word,lemma:word.toLowerCase(),zh:'',sentence:'',source:'',savedAt:null}));
   }
   return value;
  }catch{if(key==='words')throw vocabularyReadError();if(key==='vocabulary-drafts')throw Error('草稿数据无法读取，未修改已有草稿。');return null;}
 },
 set:async(key,value)=>{localStorage.setItem('lextide:v2:'+key,JSON.stringify(value));}
});}

export function remoteStore(send){return Object.fromEntries(['prefs','savePrefs','words','saveWord','removeWord','updateWord','vocabularyDrafts','saveVocabularyDraft','removeVocabularyDraft','importWords','cacheGet','cacheSet','clearCache'].map(op=>[op,(...args)=>send(op,args)]));}
