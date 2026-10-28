// Presentation fixtures only. No live API, keys or personal reading content.
import {mountReader} from '../src/reader.js';
const params=new URLSearchParams(location.search),state=params.get('state')||'default',theme=params.get('theme')||'light',width=params.get('width')||'640';
if(!params.has('inner')){
 document.body.style.cssText='margin:0;padding:16px 24px;background:#ddd;font:14px system-ui';
 const title=document.createElement('p');title.textContent='词卡布局检查 · 模拟数据 · '+state+' / '+theme+' / '+width+'px';title.style.margin='0 0 12px';document.body.append(title);
 const frame=document.createElement('iframe');const url=new URL(location.href);url.searchParams.set('inner','1');frame.src=url;frame.style.cssText='display:block;border:0;width:'+width+'px;height:812px;background:white';frame.title='词卡展示测试';document.body.append(frame);
}else{
 document.body.style.cssText='margin:0;background:'+(theme==='dark'?'#16161A':'#F4F4F0')+';color:'+(theme==='dark'?'#F2F2EE':'#1A1A1A')+';font:17px/1.8 Georgia;padding:24px';
 const main=document.createElement('main');main.textContent='They sat on the bank beside the river.';document.body.append(main);
 const senses=[{id:'river',lemma:'bank',pos:'N-COUNT',zh:'河岸',definition:'The land along the edge of a river.',examples:[{en:'They sat on the bank.',zh:'他们坐在河岸上。'}]},{id:'money',lemma:'bank',pos:'N-COUNT',zh:'银行',definition:'An institution where people keep money.'}];
 const reader=mountReader({root:main,transport:async(type)=>{
  if(state==='loading')return new Promise(()=>{});
  if(state==='failure')throw Object.assign(Error('此网站未授权或扩展已暂停'),{code:'ONLINE_REQUIRED'});
  if(type==='lookup')return {word:'bank',lemma:'bank',phonetic:'/bæŋk/',kind:'collins',senses,source:'模拟词典数据 · 仅用于界面检查'};
  return {senseId:'river',zh:state==='nearest'?'河边的岸地':'河岸'};
 }});
 const style=reader.shadow.querySelector('style');style.textContent=style.textContent.replaceAll('@media(prefers-color-scheme:dark)',theme==='dark'?'@media all':'@media not all');
 // Only fixture positioning: all card layout and state rendering use the real reader.
 const positioning=document.createElement('style');positioning.textContent='.dict{left:12px!important;right:auto!important;top:90px!important;bottom:auto!important}';reader.shadow.append(positioning);
 await reader.ready;const task=reader.show('bank',main,main.textContent,16);if(state!=='loading')await task;
 if(state==='expanded')reader.shadow.querySelector('.other-senses').open=true;
 if(state==='collapsed')reader.shadow.querySelector('#collapse-dict').click();
 document.body.dataset.ready='true';
}
