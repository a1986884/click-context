import {lookupCollinsBilingual} from '../src/collins-bilingual-lookup.js';
import {dictionaryDocumentView} from '../src/dictionary-dom-view.js';
import {extractDictionary} from '../src/dictionary-extract.js';
import {jsonFetch} from '../src/providers.js';
import {collinsQuery} from '../src/collins-sources.js';
export function createUserscriptDictionary(fetcher){
 return async(word,options)=>{
  let result;
  try{
   result=await lookupCollinsBilingual(word,{...options,fetcher,parseHTML:async(html,kind,parseOptions)=>extractDictionary(dictionaryDocumentView(new DOMParser().parseFromString(html,'text/html'),{stripLabels:true}),kind,parseOptions)});
   if(result.kind!=='unavailable')return result;
  }catch(error){
   options.signal?.throwIfAborted();
   // Do not switch transport to evade a denied, rate-limited or failed source request.
   if(error.code!=='COLLINS_ENTRY_UNAVAILABLE')throw error;
  }
  options.signal?.throwIfAborted();
  // Same public Collins source and extractor as the preview, one bounded attempt
  // only when the manager-delivered page lacks a readable Collins section.
  try{
   const data=await jsonFetch('https://v04-preview.lextide.pages.dev/api/dictionary?'+new URLSearchParams({word:collinsQuery(word)}),fetcher,{signal:options.signal,timeoutMs:22000,acceptHttpErrors:true});
   if(!data?.ok||!data.data||!Array.isArray(data.data.senses))throw Object.assign(Error(data?.error||'Collins 词条暂不可用，请查看来源'),{code:data?.code||'COLLINS_UNAVAILABLE'});
   return data.data;
  }catch(error){options.signal?.throwIfAborted();if(result)return {...result,dictionaryError:error.message};throw error;}
 };
}
