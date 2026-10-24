// A saved use is identified by its expression, meaning and original sentence.
export function vocabularyKey(entry){return JSON.stringify([String(entry?.lemma||entry?.word||'').toLowerCase().replaceAll('’',"'"),entry?.zh||'',entry?.sentence||'']);}
export const WORD_LIMIT=5000;
// Covers backups from normal 10 MiB extension storage, including JSON formatting.
export const BACKUP_FILE_LIMIT=16*1024*1024;
export function parseVocabularyBackup(data){
 if(!data||data.version!==2||!Array.isArray(data.words))throw Error('请选择词汐导出的 JSON 生词本（version 2）。');
 if(data.words.length>WORD_LIMIT)throw Error('一次最多导入 5,000 个单词。');
 return data.words.map((entry,index)=>{
  const lemma=String(entry?.lemma||entry?.word||'').toLowerCase().replaceAll('’',"'");
  if(!/^[a-z]+(?:['-][a-z]+)*(?: [a-z]+(?:['-][a-z]+)*){0,3}$/.test(lemma)||lemma.length>80)throw Error('第 '+(index+1)+' 条单词格式不正确，未导入任何内容。');
  const text=(key,max)=>typeof entry[key]==='string'?entry[key].slice(0,max):'';
  return {word:text('word',80)||lemma,lemma,zh:text('zh',500),sentence:text('sentence',1200),source:text('source',500),dictionarySource:text('dictionarySource',500),savedAt:typeof entry.savedAt==='string'&&!Number.isNaN(Date.parse(entry.savedAt))?new Date(entry.savedAt).toISOString():null};
 });
}
export function selectVocabulary(words,query='',sort='recent'){
 const needle=query.trim().toLocaleLowerCase();
 return words.filter(word=>[word.lemma,word.word,word.zh,word.sentence].some(value=>String(value||'').toLocaleLowerCase().includes(needle))).sort((a,b)=>sort==='alpha'?a.lemma.localeCompare(b.lemma,'en'):(Date.parse(b.savedAt)||0)-(Date.parse(a.savedAt)||0)||a.lemma.localeCompare(b.lemma,'en'));
}
