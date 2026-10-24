import {mountReader} from './src/reader.js';
import {lookupCollinsClient} from './src/dictionary-client.js';
import {resolveContext} from './src/context-meaning.js';
import {translate} from './src/core.js';
const reader=mountReader({onOpenEngines:()=>{location.href='./engines-preview.html';},root:document.querySelector('#web-article'),transport:(type,text,online,options)=>type==='lookup'?lookupCollinsClient(text,{online,...options}):type==='context'?resolveContext(options.context,options):translate(text,fetch,options)});
document.querySelector('#settings').onclick=()=>reader.openSettings();
const passages=['Reading is a conversation with someone you may never meet. Each paragraph offers another way to see an ordinary experience.','You do not need to remember every new word at once. Notice how it works in a sentence, then carry on with the story.','A good reading tool gives you help at the moment you need it, and leaves space for your own understanding.'];let added=0;
document.querySelector('#load-more').onclick=()=>{const p=document.createElement('p');p.textContent=passages[added%passages.length];document.querySelector('#next-page').append(p);added++;document.querySelector('#more-status').textContent='已添加第 '+added+' 段';p.scrollIntoView({behavior:'auto',block:'center'});};
