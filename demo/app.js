import {resolveContext} from './src/context-meaning.js';
import {articles} from './src/data.js';
import {tokenize} from './src/core.js';
import {lookupCollinsClient} from './src/dictionary-client.js';
import {translate} from './src/core.js';
import {mountReader} from './src/reader.js';
const article=document.querySelector('#article');
document.querySelector('aside p').textContent='开启查词后，点一个英文单词，查看它在原句中的含义。可将词义连同这句用法收藏。点击右下角按钮关闭，链接恢复跳转；长按图标设置正文双语。';
function tokenized(el,text){for(const token of tokenize(text)){if(!token.word){el.append(document.createTextNode(token.text));continue;}const span=document.createElement('span');span.dataset.word=token.text;span.tabIndex=0;span.textContent=token.text;span.setAttribute('role','button');span.setAttribute('aria-label','查询 '+token.text);el.append(span);}}
function render(item){const prior=reader?.preferences;reader?.restore();article.replaceChildren();const cat=document.createElement('div');cat.className='category';cat.textContent=item.category;const title=document.createElement('h2');tokenized(title,item.title);const subtitle=document.createElement('div');subtitle.className='subtitle';subtitle.textContent=item.subtitle;article.append(cat,title,subtitle);for(const [en,zh]of item.paragraphs){const p=document.createElement('p');p.className='english';tokenized(p,en);if(zh)p.dataset.translation=zh;const example=p.querySelector('[data-word="ocean"]');if(example&&item===articles[0]&&!article.querySelector('[data-lookup-example]')){const link=document.createElement('a');link.href='https://en.wikipedia.org/wiki/Ocean';link.dataset.lookupExample='true';example.before(link);link.append(example);}article.append(p);}if(prior?.enabled)void reader.setMode(prior.mode);if(reader)syncReadingButton();}
let reader;render(articles[0]);reader=mountReader({onOpenEngines:()=>{location.href='./engines-preview.html';},root:article,demo:true,dictionaryNotice:'Collins 英汉双解（有道公开词条）',transport:(type,text,online,options)=>{return type==='lookup'?lookupCollinsClient(text,{online,...options}):type==='context'?resolveContext(options.context,options):translate(text,fetch,options);}});
const toolbar=document.createElement('div');toolbar.className='mode-toolbar';toolbar.innerHTML='<label><input id="demo-words" type="checkbox" checked> 查词（开启时链接不跳转）</label><button id="demo-vocabulary" type="button">我的生词本</button><a href="./webpage.html">网页阅读示例 ↗</a><span id="mode-status" role="status"></span><small>插件交互预览。点击英文查询 Collins 双解；长按右下角图标设置双语翻译。</small>';document.querySelector('.reader-heading').after(toolbar);
document.querySelector('#demo-vocabulary').onclick=()=>reader.openVocabulary();
document.querySelector('#demo-words').onchange=e=>void reader.setWords(e.target.checked);
document.querySelector('#article-select').onchange=e=>render(articles[Number(e.target.value)]);
document.querySelector('#read-start').onclick=()=>article.scrollIntoView({behavior:'smooth'});
document.querySelector('#open-settings').onclick=()=>reader.openSettings();
function syncReadingButton(){
 const enabled=reader.preferences.words;article.dataset.lookupEnabled=String(enabled);
 for(const word of article.querySelectorAll('[data-word]')){
  if(enabled){word.tabIndex=0;word.setAttribute('role','button');word.setAttribute('aria-label','查询 '+word.dataset.word);}
  else{word.removeAttribute('tabindex');word.removeAttribute('role');word.removeAttribute('aria-label');if(document.activeElement===word)word.blur();}
 }
document.querySelector('#demo-words').checked=reader.preferences.words;document.querySelector('#mode-status').textContent=({original:'原文模式',bilingual:'双语模式',translated:'译文模式'})[reader.mode]+(reader.preferences.words?' · 查词开启，链接不跳转':' · 查词关闭，链接正常');}
document.querySelector('lextide-reader').addEventListener('readerstatechange',syncReadingButton);syncReadingButton();
document.querySelector('#custom').onclick=()=>{document.querySelector('#custom-panel').hidden=false;document.querySelector('#custom-text').focus();};
document.querySelector('#load-custom').onclick=()=>{const text=document.querySelector('#custom-text').value.trim();if(!text){document.querySelector('#custom-status').textContent='请先粘贴英文正文。';return;}render({category:'YOUR OWN CURRENT',title:'Your reading, your pace',subtitle:'自定义英文文章 · 所有英文单词均可点击',paragraphs:text.split(/\n+/).filter(Boolean).map(p=>[p])});article.scrollIntoView({behavior:'smooth'});};
document.querySelector('#saved').onclick=()=>reader.openVocabulary();document.querySelector('#saved-panel').remove();
document.querySelector('footer small').textContent='V0.4 预览版 · 原创示例文章';

