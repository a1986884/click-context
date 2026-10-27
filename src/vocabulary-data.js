export function vocabularyDraftKey(draft){return draft.id||draft.key;}
// A saved use is identified by its expression, meaning and original sentence.
export function vocabularyKey(entry){return JSON.stringify([String(entry?.lemma||entry?.word||'').toLowerCase().replaceAll('’',"'"),entry?.zh||'',entry?.sentence||'']);}
export function isVocabularyLemma(value){return typeof value==='string'&&value.length<=80&&/^[a-z]+(?:['-][a-z]+)*(?: [a-z]+(?:['-][a-z]+)*){0,3}$/.test(value);}
export const WORD_LIMIT=5000;
// Covers backups from normal 10 MiB extension storage, including JSON formatting.
export const BACKUP_FILE_LIMIT=16*1024*1024;
export function vocabularyReviewState(entry){
 if(['pending','reviewed'].includes(entry?.reviewState))return entry.reviewState;
 return /候选含义（未确认）|复核依据未确认|复核未确认/.test(entry?.dictionarySource||'')?'pending':'';
}
export function vocabularyReviewMetadata(entry){
 const result={};if(['pending','reviewed'].includes(entry?.reviewState))result.reviewState=entry.reviewState;
 if(typeof entry?.editedAt==='string'&&!Number.isNaN(Date.parse(entry.editedAt)))result.editedAt=new Date(entry.editedAt).toISOString();
 if(Number.isInteger(entry?.contextOffset)){const offset=vocabularyOccurrence(entry);if(offset!==null)result.contextOffset=offset;}
 return result;
}
export function vocabularyOccurrence(entry){
 if(typeof entry?.word!=='string'||!entry.word||typeof entry.sentence!=='string')return null;
 const escaped=entry.word.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),matches=[...entry.sentence.matchAll(new RegExp('(?<![A-Za-z])'+escaped+'(?![A-Za-z])','gi'))];
 if(Number.isInteger(entry.contextOffset)){
  const chosen=matches.find(m=>entry.contextOffset>=m.index&&entry.contextOffset<=m.index+m[0].length);if(chosen)return chosen.index;
 }
 return matches.length===1?matches[0].index:null;
}
export function parseVocabularyBackup(data){
 if(!data||data.version!==2||!Array.isArray(data.words))throw Error('请选择词汐导出的 JSON 生词本（version 2）。');
 if(data.words.length>WORD_LIMIT)throw Error('一次最多导入 5,000 个单词。');
 return data.words.map((entry,index)=>{
  const lemma=String(entry?.lemma||entry?.word||'').toLowerCase().replaceAll('’',"'");
  if(!isVocabularyLemma(lemma))throw Error('第 '+(index+1)+' 条单词格式不正确，未导入任何内容。');
  const text=(key,max)=>typeof entry[key]==='string'?entry[key].slice(0,max):'';
  const word=text('word',80)||lemma,sentence=text('sentence',1200);
  return {word,lemma,zh:text('zh',500),sentence,source:text('source',500),dictionarySource:text('dictionarySource',500),savedAt:typeof entry.savedAt==='string'&&!Number.isNaN(Date.parse(entry.savedAt))?new Date(entry.savedAt).toISOString():null,...vocabularyReviewMetadata({...entry,word,sentence})};
 });
}
export function selectVocabulary(words,query='',sort='recent',review='all'){
 const needle=query.trim().toLocaleLowerCase();
 return words.filter(word=>(review!=='pending'||vocabularyReviewState(word)==='pending')&&[word.lemma,word.word,word.zh,word.sentence].some(value=>String(value||'').toLocaleLowerCase().includes(needle))).sort((a,b)=>sort==='alpha'?a.lemma.localeCompare(b.lemma,'en'):(Date.parse(b.savedAt)||0)-(Date.parse(a.savedAt)||0)||a.lemma.localeCompare(b.lemma,'en'));
}
