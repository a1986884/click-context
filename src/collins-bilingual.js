import {parseDictionaryHTML} from './dom-parser-linkedom.js';
import {lookupCollinsBilingual as lookup} from './collins-bilingual-lookup.js';
export {bilingualSources} from './collins-sources.js';
export const parseCollinsBilingual=html=>parseDictionaryHTML(html,'youdao-first');
export const parseCollinsSenses=(html,options)=>parseDictionaryHTML(html,'youdao-senses',options);
export const lookupCollinsBilingual=(word,options={})=>lookup(word,{...options,parseHTML:options.parseHTML||parseDictionaryHTML});
