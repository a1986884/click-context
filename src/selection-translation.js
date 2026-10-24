import {readableSourceNodes} from './prose-units.js';
// Validate the whole selected span, not just its first node. Selection never sends
// text by itself; callers must revalidate after an explicit action.
export function readableSelection(range,root,{demo=false}={}){
 if(!range||!root.contains(range.startContainer)||!root.contains(range.endContainer))return null;
 const text=range.toString().replace(/\s+/gu,' ').trim();if(!text||text.length>2000||!/[A-Za-z]{2}/u.test(text))return null;
 const ancestor=range.commonAncestorContainer;
 const nodes=ancestor.nodeType===3?[ancestor]:null;
 const walker=nodes?null:document.createTreeWalker(ancestor,4);let node=nodes?.[0]||walker.nextNode(),visited=0,found=false;
 while(node){
  if(++visited>5000)return null;
  if(range.intersectsNode(node)&&node.textContent.trim()){
   if(!readableSourceNodes([node],{demo}))return null;found=true;
  }
  node=nodes?null:walker.nextNode();
 }
 return found?text:null;
}
