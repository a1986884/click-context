import {sentenceRanges,isNumericSuperscript} from './sentences.js';
// Plain-text snapshots of the selected prose only. No requests or storage.
const EXCLUDED='script,style,noscript,template,input,textarea,select,button,code,pre,svg,math,nav,header:not(article header),[role="banner"],footer,aside,[hidden],[inert],[aria-hidden="true"],[contenteditable]:not([contenteditable="false"]),[role="textbox"],[role="button"],[role="toolbar"],[role="navigation"],lextide-reader,.lextide-translation';
const BLOCK='p,li,blockquote,dd,dt,td,th,summary,figcaption,h1,h2,h3,h4,h5,h6,div';
const normalize=text=>text.replace(/\s+/gu,' ').trim();

// Map all requested raw boundaries in one pass, including whitespace runs.
function normalizedPositions(text,positions,max){
 const points=[...new Set(positions)].sort((a,b)=>a-b),mapped=new Map();let index=0,length=0,seenText=false;
 for(const match of text.matchAll(/\s+|[^\s]+/gu)){
  const whitespace=/^\s/u.test(match[0]),end=match.index+match[0].length;
  while(index<points.length&&points[index]<=end){const at=points[index++],within=at-match.index;const value=length+(whitespace?(seenText&&within>0?1:0):within);mapped.set(at,Math.min(max,value));}
  length+=whitespace?(seenText?1:0):match[0].length;if(!whitespace)seenText=true;
 }
 return mapped;
}

export function sentenceContext(text,offset,length=1,limit=1200,superscripts=[]){
 if(!text||!Number.isInteger(offset)||offset<0||offset>=text.length)return {sentence:'',offset:null};
 const ranges=sentenceRanges(text,{superscripts});
 let {start=0,end=text.length}=ranges.find(s=>offset>=s.start&&offset<s.end)||{};
 end=Math.max(end,Math.min(text.length,offset+length));
 while(start<offset&&/\s/u.test(text[start]))start++;
 while(end>offset+length&&/\s/u.test(text[end-1]))end--;
 if(end-start>limit){start=Math.max(start,offset-Math.floor((limit-length)/2));end=Math.min(end,start+limit);}
 return {sentence:text.slice(start,end),offset:offset-start};
}

export function proseBlock(node){
 const element=node?.nodeType===1?node:node?.parentElement;
 const block=element?.closest(BLOCK)||element;
 return block&&!block.matches('body,html,main,article,section')&&!block.closest(EXCLUDED)?block:null;
}

// Preserve the actual DOM position, including repeated words and inline elements.
export function proseSnapshot(block,target,targetOffset=0,{demo=false}={}){
 const excluded=demo?EXCLUDED.replace(',[role="button"]',''):EXCLUDED;
 if(!block||!target||!block.contains(target)||block.isConnected===false||block.closest(excluded))return null;
 const styles=new WeakMap(),style=node=>{if(!styles.has(node))styles.set(node,node.ownerDocument?.defaultView?.getComputedStyle?.(node)||node.style||{});return styles.get(node);};
 let ancestors=0;
 for(let node=block;node;node=node.parentElement){
  if(++ancestors>5000)return null;
  const css=style(node);if(node.matches(excluded)||css.display==='none'||css.contentVisibility==='hidden')return null;
  if(node.tagName==='DETAILS'&&!node.hasAttribute('open')&&![...node.children].find(child=>child.tagName==='SUMMARY')?.contains(block))return null;
 }
 let text='',at=null,count=0,overflow=false;const superscripts=[];
 function walk(node){
  if(++count>5000||text.length>100000){overflow=true;return;}
  if(node.nodeType===3){
   if(text.length+node.textContent.length>100000){overflow=true;return;}
   if(node===target)at=text.length+Math.min(Math.max(0,targetOffset),node.textContent.length);
   if(isNumericSuperscript(node))superscripts.push({start:text.length,end:text.length+node.textContent.length});
   text+=node.textContent;return;
  }
  if(node.nodeType!==1)return;
  const css=style(node);
  if(node.matches(excluded)||css.display==='none'||css.visibility==='hidden'||css.visibility==='collapse'||css.contentVisibility==='hidden')return;
  if(node.tagName==='DETAILS'&&!node.hasAttribute('open')){
   text+=' ';if(node===target&&targetOffset===0)at=text.length;
   const summary=[...node.children].find(child=>child.tagName==='SUMMARY');if(summary)walk(summary);text+=' ';return;
  }
  if(node.tagName==='BR'){text+=' ';return;}
  const children=Array.from(node.childNodes);
  for(let i=0;i<=children.length;i++){
   if(node===target&&i===targetOffset)at=text.length;
   if(i<children.length)walk(children[i]);
   if(overflow)return;
  }
 }
 walk(block);
 if(overflow||text.length>100000||at===null)return null;
 const normalized=normalize(text);
 if(!superscripts.length)return {text:normalized,offset:text.slice(0,at).replace(/\s+/gu,' ').trimStart().length};
 const positions=normalizedPositions(text,[at,...superscripts.flatMap(r=>[r.start,r.end])],normalized.length);
 return {text:normalized,offset:positions.get(at),superscripts:superscripts.map(r=>({start:positions.get(r.start),end:positions.get(r.end)}))};
}

export function snapshotContext(snapshot,offset=snapshot.offset,length=1){
 return sentenceContext(snapshot.text,offset,length,1200,snapshot.superscripts||[]);
}

export function selectedContext(range,word,options={}){
 const block=proseBlock(range.startContainer);
 if(!block||!block.contains(range.endContainer))return null;
 const snapshot=proseSnapshot(block,range.startContainer,range.startOffset,options);
 if(!snapshot)return null;
 let offset=snapshot.offset;while(offset<snapshot.text.length&&/\s/u.test(snapshot.text[offset]))offset++;
 if(snapshot.text.slice(offset,offset+word.length)!==word)return null;
 return snapshotContext(snapshot,offset,word.length);
}
