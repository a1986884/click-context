import {resolveForm} from './morphology.js';
import {collinsWord,collinsSources} from './collins-sources.js';
import {readPage} from './dictionary-fetch.js';
export async function lookupCollins(word,{online=false,signal,fetcher=fetch,timeoutMs,useSession=false,parseHTML}={}){
 const original=word,requested=collinsWord(word);let lemma=requested,sourceUrls=collinsSources(requested);
 if(!online)throw Object.assign(Error('Collins 查词需要联网，请先允许此网站联网查询。'),{code:'ONLINE_REQUIRED',sourceUrls});
 try{
  // Fetch only the two requested public entries, never search indexes or full dictionaries.
  const zh=await parseHTML(await readPage(sourceUrls[0],{signal,fetcher,timeoutMs,useSession}),'collins-zh',{signal});
  // The official Chinese page can redirect an inflection to a different headword.
  // Pair its English definition with that actual headword, never an unrelated homograph.
  lemma=collinsWord(zh.head);sourceUrls=[sourceUrls[0],collinsSources(lemma)[1]];
  signal?.throwIfAborted();
  let en=null,englishError;
  try{
   en=await parseHTML(await readPage(sourceUrls[1],{signal,fetcher,timeoutMs,useSession}),'collins-en',{signal});
   if(collinsWord(en.head)!==lemma)throw Object.assign(Error('Collins 英文页返回了不同的词头，未将它与当前中文释义混用。'),{code:'COLLINS_HEADWORD_MISMATCH'});
  }catch(error){
   if(signal?.aborted)throw error;
   en=null;englishError={code:error.code||'COLLINS_UNAVAILABLE',message:error.message,...(error.upstreamStatus?{upstreamStatus:error.upstreamStatus}:{})};
  }
  return {word:lemma,original,lemma,zh:zh.zh,zhSource:'Collins 官网 · 英汉释义摘录',definitions:en?[en.pos+' · '+en.definition]:[],example:en?.example||'',phonetic:en?.phonetic||zh.phonetic,partial:!en,...(englishError?{englishError}:{}),morphology:lemma!==requested?'Collins 英汉词条将 '+original+' 指向 '+lemma+'，按官网基础词条查询。':resolveForm(String(original).toLowerCase()).note,kind:'collins',source:'Collins 官网词条摘录'+(en?' · 英汉与英文解释来自对应页面':' · 英文解释暂不可用'),sourceUrls,license:{name:'© HarperCollins Publishers · 完整义项请查看官网'}};
 }catch(error){error.sourceUrls=sourceUrls;error.code||='COLLINS_UNAVAILABLE';throw error;}
}
