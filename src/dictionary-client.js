import {phraseLemma} from './phrases.js';
import {cacheWordLookup} from './dictionary-cache.js';
import {collinsQuery,bilingualSources} from './collins-sources.js';
import {jsonFetch,normalize} from './core.js';
async function lookupCollinsRemote(word,{online=false,signal,fetcher=fetch}={}){
 const original=word;word=phraseLemma(collinsQuery(normalize(word)));
 const sourceUrls=bilingualSources(word);
 if(!online)throw Object.assign(Error('Collins 查词需要联网，请先在阅读设置中允许联网查询。'),{code:'ONLINE_REQUIRED',sourceUrls});
 try{const result=await jsonFetch('/api/dictionary?'+new URLSearchParams({word}),fetcher,{signal,timeoutMs:26000,acceptHttpErrors:true});if(!result.ok)throw Object.assign(Error(result.error||'Collins 暂不可用，请打开官网查看。'),{code:result.code,upstreamStatus:result.upstreamStatus});return {...result.data,...(original.includes(' ')?{original}:{}),...(original.toLowerCase()!==word&&original.includes(' ')&&!result.data.phraseSource?{morphology:'短语词形：'+original+' → '+word+'；按完整原形查询 Collins。'}:{})};}
 catch(error){if(!signal?.aborted){if(!error.code){error.message='Collins 当前无法读取该词：'+error.message;error.code='COLLINS_UNAVAILABLE';}}error.sourceUrls=sourceUrls;throw error;}
}

export const lookupCollinsClient=cacheWordLookup(lookupCollinsRemote);
