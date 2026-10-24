import {mountReader} from './src/reader.js';
const reader=mountReader({root:document.querySelector('article')});
document.querySelector('#original').onclick=()=>reader.setMode('original');
document.querySelector('#bilingual').onclick=()=>reader.setMode('bilingual');
document.querySelector('#translated').onclick=()=>reader.setMode('translated');
document.querySelector('#settings').onclick=()=>reader.openSettings();
