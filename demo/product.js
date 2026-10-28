import {createContextClient,CONTEXT_CURRENT_REVISION} from './src/context-meaning.js';
import {tokenize,translate} from './src/core.js';
import {lookupCollinsClient} from './src/dictionary-client.js';
import {createTranslationProvider} from './src/providers.js';
import {mountReader} from './src/reader.js';
const endpoint=document.querySelector('meta[name="click-context-endpoint"]')?.content;
const resolveContext=createContextClient({revision:CONTEXT_CURRENT_REVISION,...(endpoint?{endpoint}:{})});
const article=document.querySelector('#trial-article');
const translationProvider=createTranslationProvider(endpoint?{endpoint:endpoint.replace(/\/meaning$/,'/translate')}:{});
function tokenizeParagraph(paragraph){paragraph.classList.add('english');const text=paragraph.textContent;paragraph.replaceChildren();for(const token of tokenize(text)){
 if(!token.word){paragraph.append(document.createTextNode(token.text));continue;}
 const word=document.createElement('span');word.dataset.word=token.text;word.textContent=token.text;word.tabIndex=0;word.setAttribute('role','button');word.setAttribute('aria-label','查询 '+token.text);paragraph.append(word);
}}
for(const p of article.querySelectorAll('p'))tokenizeParagraph(p);
const reader=mountReader({root:article,demo:true,contextRevision:CONTEXT_CURRENT_REVISION,onOpenEngines:()=>{location.href='./engines-preview.html';},dictionaryNotice:'Collins 英汉双解（有道公开词条）',transport:(type,word,online,options)=>type==='lookup'?lookupCollinsClient(word,{online,...options}):type==='context'?resolveContext(options.context,options):translate(word,fetch,{...options,provider:translationProvider})});
const toggle=document.querySelector('#trial-toggle'),mode=document.querySelector('#trial-mode'),unit=document.querySelector('#trial-unit'),state=document.querySelector('#trial-state');
function sync(){const enabled=reader.preferences.words;toggle.setAttribute('aria-pressed',String(enabled));toggle.textContent=enabled?'查词已开启':'开启查词';mode.value=reader.mode;unit.value=reader.preferences.translationUnit;unit.disabled=reader.mode!=='bilingual';state.textContent=reader.paused?'已暂停 · 点击右下角书本按钮恢复原配置':({'original':'原文模式 · 正文翻译未开启','bilingual':'双语模式 · '+(unit.value==='sentence'?'逐句对照':'逐段对照'),'translated':'译文模式'})[reader.mode];for(const word of article.querySelectorAll('[data-word]')){word.tabIndex=enabled?0:-1;if(enabled)word.setAttribute('role','button');else word.removeAttribute('role');}}
toggle.onclick=()=>void reader.setWords(!reader.preferences.words,{activate:true});
mode.onchange=()=>void reader.setMode(mode.value);
unit.onchange=()=>void reader.setTranslationUnit(unit.value);
for(const button of document.querySelectorAll('.guide-settings'))button.onclick=()=>reader.openSettings();
document.querySelector('#trial-saved').onclick=()=>reader.openVocabulary();
document.querySelector('#trial-export').onclick=()=>reader.exportWords();
document.querySelector('#trial-load-custom').onclick=async()=>{const text=document.querySelector('#trial-custom-text').value.trim(),status=document.querySelector('#trial-custom-status');if(!text){status.textContent='请先粘贴英文正文。';return;}await reader.replaceContent(()=>{article.replaceChildren();for(const line of text.split(/\n+/).filter(Boolean)){const p=document.createElement('p');p.textContent=line;tokenizeParagraph(p);article.append(p);}});sync();status.textContent='已载入你的正文，沿用当前阅读模式。';};
document.querySelector('lextide-reader').addEventListener('readerstatechange',sync);sync();
