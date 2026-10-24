import {parseHTML} from 'linkedom/worker';
import {dictionaryDocumentView} from './dictionary-dom-view.js';
import {extractDictionary} from './dictionary-extract.js';
export function parseDictionaryHTML(html,kind,options){return extractDictionary(dictionaryDocumentView(parseHTML(html).document,{stripLabels:kind.startsWith('youdao-')}),kind,options);}
