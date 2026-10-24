import {glossary} from './data.js';
import {resolveForm,localEntries} from './morphology.js';
import {createTranslationProvider,jsonFetch} from './providers.js';
export {splitText,jsonFetch} from './providers.js';
export function tokenize(text) { return [...text.matchAll(/[A-Za-z]+(?:[’'-][A-Za-z]+)*|[^A-Za-z]+/g)].map(m=>({text:m[0],word:/^[A-Za-z]/.test(m[0])})); }
export function normalize(word) {return word.toLowerCase().replaceAll('’',"'").trim();}
export function wordAt(text,offset) {for(const m of text.matchAll(/(?:[A-Za-z]\.){2,}|[A-Za-z]+(?:[’'-][A-Za-z]+)*/g))if(offset>=m.index&&offset<m.index+m[0].length)return m[0];return null;}
export async function translate(text,fetcher=fetch,{signal,provider=createTranslationProvider({fetcher})}={}) {
 return provider.translate(text,{signal});
}
export async function lookup(word,{online=false,fetcher=fetch,signal}={}) {
 word=normalize(word);if(/^(?:[a-z]\.){2,}$/.test(word))throw Error('已识别缩写 '+word+'；暂无可靠缩写词条');if(!/^[a-z]+(?:['-][a-z]+)*$/.test(word)||word.length>80)throw Error('请输入英文单词');
 const form=resolveForm(word),local=localEntries[form.lemma];
 if(glossary[word]||local){const original=glossary[word]||{};return {...original,word:form.lemma,original:word,lemma:form.lemma,zh:local?.zh||original.zh,phonetic:local?.phonetic||'',definitions:local?.english?[local.pos+' · '+local.english]:[],meanings:local?[{pos:local.pos,definition:local.english}]:[],morphology:form.note,source:'词汐 · 原创演示词库（CC0）',zhSource:'原创演示释义',license:{name:'CC0-1.0'},kind:'local'};}
 if(!online)throw Object.assign(Error('本地词库未收录此词，允许联网后可查询在线词典。'),{code:'ONLINE_REQUIRED'});
 const [zh,en]=await Promise.allSettled([translate(form.lemma,fetcher,{signal}),jsonFetch('https://api.dictionaryapi.dev/api/v2/entries/en/'+encodeURIComponent(form.lemma),fetcher,{signal})]);
 if(zh.status==='rejected'&&en.status==='rejected')throw Error('网络查询失败，请重试');
 const entry=en.status==='fulfilled'?en.value[0]:null;
 return {word:entry?.word||form.lemma,original:word,lemma:form.lemma,morphology:form.note,zh:zh.status==='fulfilled'?zh.value:'暂无中文释义',zhSource:'Cloudflare AI · 机器翻译，仅供参考',phonetic:entry?.phonetic||entry?.phonetics?.find(p=>p.text)?.text||'',definitions:entry?.meanings?.flatMap(m=>m.definitions.slice(0,2).map(d=>m.partOfSpeech+' · '+d.definition)).slice(0,3)||[],meanings:entry?.meanings?.flatMap(m=>m.definitions.slice(0,2).map(d=>({pos:m.partOfSpeech,definition:d.definition}))).slice(0,3)||[],source:entry?'Free Dictionary API · 在线英文词典':'Free Dictionary API · 查询失败或暂无可用英文条目，可点击重试',license:entry?.license||null,sourceUrls:entry?.sourceUrls||[],kind:'online'};
}

