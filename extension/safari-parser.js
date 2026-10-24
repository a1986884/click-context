// Explicit Safari candidate strategy: no chrome.offscreen API. Keep linkedom.
import {parseDictionaryHTML} from '../src/dom-parser-linkedom.js';
export function createOffscreenParser(){return async(html,kind,options)=>parseDictionaryHTML(html,kind,options);}
