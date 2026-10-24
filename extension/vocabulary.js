import {getExtensionAPI} from './src/browser-api.js';
import {mountVocabulary} from './src/vocabulary-view.js';
const chrome=getExtensionAPI();
async function send(op,...args){const reply=await chrome.runtime.sendMessage({type:'store',op,args});if(!reply?.ok)throw Error(reply?.error||'扩展后台未响应，请重新打开生词本。');return reply.data;}
const view=mountVocabulary({root:document.querySelector('#vocabulary-app'),store:{words:()=>send('words'),removeWord:lemma=>send('removeWord',lemma),importWords:data=>send('importWords',data)}});
chrome.storage.onChanged.addListener(changes=>{if(changes['v2:words'])void view.refresh();});await view.refresh();
