import {parseDictionaryHTML} from './dom-parser-linkedom.js';
import {lookupCollins as lookup} from './collins-lookup.js';
export {readPage} from './dictionary-fetch.js';
export {collinsWord,collinsSources} from './collins-sources.js';
export const parseCollinsPage=(html,language)=>parseDictionaryHTML(html,language==='zh'?'collins-zh':'collins-en');
export const lookupCollins=(word,options={})=>lookup(word,{...options,parseHTML:options.parseHTML||parseDictionaryHTML});
