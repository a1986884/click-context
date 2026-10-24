import {extractDictionary} from '../src/dictionary-extract.js';
import {dictionaryDocumentView} from '../src/dictionary-dom-view.js';
const kinds=new Set(['collins-zh','collins-en','youdao-first','youdao-senses']);
export function handleParse(message,sender,api=globalThis.chrome){
 if(sender?.id!==api.runtime.id||message?.type!=='lextide:parse-html')return null;
 try{
  if(typeof message.html!=='string'||message.html.length>1024*1024||new TextEncoder().encode(message.html).length>1024*1024||!kinds.has(message.kind)||message.phrase!=null&&(typeof message.phrase!=='string'||message.phrase.length>80))throw Object.assign(Error('无效词条解析请求'),{code:'INVALID_PARSE_REQUEST'});
  const document=new DOMParser().parseFromString(message.html,'text/html');
  return {ok:true,data:extractDictionary(dictionaryDocumentView(document,{stripLabels:message.kind.startsWith('youdao-')}),message.kind,{phrase:message.phrase??null})};
 }catch(error){return {ok:false,error:error.message,code:error.code||'DICTIONARY_PARSE_FAILED'};}
}
if(globalThis.chrome?.runtime?.onMessage)chrome.runtime.onMessage.addListener((message,sender,reply)=>{
 const response=handleParse(message,sender);if(response===null)return false;reply(response);return false;
});
