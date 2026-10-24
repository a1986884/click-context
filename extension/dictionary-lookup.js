import {lookupCollinsBilingual} from '../src/collins-bilingual-lookup.js';
import {createOffscreenParser} from './offscreen-client.js';
// A real runtime module shared by the worker and native installation acceptance.
export function createDictionaryLookup(api){
 const parseHTML=createOffscreenParser(api);
 return (word,options={})=>lookupCollinsBilingual(word,{...options,parseHTML});
}
