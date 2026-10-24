// English sentence offsets in the original text, including intervening whitespace.
// Keep scientific abbreviations and decimal values intact; never rewrite source HTML.
const abbreviation=/(?:\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|vs|etc|Fig|Figs|Eq|Eqs|Sec|Secs|Ref|Refs|Vol|No|pp|Ch|al|approx|cf)|\b[A-Z]|\be\.g|\bi\.e)\.$/iu;
let segmenter;
export function isNumericSuperscript(node){
 const sup=node.parentElement?.closest('sup'),text=sup?.textContent||'';
 return text.length<=80&&/\d/u.test(text)&&/^[\s\d,;–—-]+$/u.test(text);
}
export function sentenceRanges(text,{superscripts=[]}={}){
 let end=0;const partsBeforeMask=[];
 for(const range of superscripts)if(Number.isInteger(range.start)&&Number.isInteger(range.end)&&range.start>=end&&range.end>range.start&&range.end<=text.length){partsBeforeMask.push(text.slice(end,range.start),' '.repeat(range.end-range.start));end=range.end;}
 const structuralText=end?partsBeforeMask.join('')+text.slice(end):text;
 // Mask only the segmenter's view: offsets and returned slices still reference
 // the untouched source, including citation links and Unicode superscripts.
 const segmentationText=structuralText.replace(/\[\d[\d\s,;–—-]*\]|[⁰¹²³⁴⁵⁶⁷⁸⁹]+(?:[,，–—-][⁰¹²³⁴⁵⁶⁷⁸⁹]+)*/gu,match=>' '.repeat(match.length));
 segmenter??=typeof Intl.Segmenter==='function'?new Intl.Segmenter('en',{granularity:'sentence'}):null;
 const parts=segmenter?[...segmenter.segment(segmentationText)].map(s=>({start:s.index,end:s.index+s.segment.length})):Array.from(segmentationText.matchAll(/[\s\S]+?(?:[.!?]+["'”’\])]*(?:\s+|$)|$)/g),m=>({start:m.index,end:m.index+m[0].length})).filter(r=>r.end>r.start);
 const ranges=[];
 for(const part of parts){const prior=ranges.at(-1);if(prior&&abbreviation.test(segmentationText.slice(prior.start,prior.end).trim()))prior.end=part.end;else ranges.push({...part});}
 // A numbered citation after a full stop belongs with the preceding sentence.
 for(let i=1;i<ranges.length;i++){
  const r=ranges[i],citation=text.slice(r.start,r.end).match(/^(?:\s*\[\d[\d\s,;–—-]*\])+\s*/u);
  if(citation){r.start+=citation[0].length;ranges[i-1].end=r.start;}
 }
 return ranges.filter(r=>r.end>r.start);
}
const normalize=s=>s.replace(/\s+/gu,' ').trim();
export function sentenceUnits(units,splits,limit=400,{keep=new Set(),visible=()=>true,onMore=()=>{}}={}){
 let added=0;const result=[],lastUnits=new Map(units.map(unit=>[unit.p,unit])),owners=new Map(),generated=new Map();
 for(const split of splits)if(split.owner){owners.set(split.owner.node,split.owner);generated.set(split.right,split.owner);}
 for(const unit of units){
  const raw=unit.nodes.map(n=>n.textContent).join('');let offset=0;
  const source=unit.nodes.map(node=>{const start=offset;offset+=node.textContent.length;return {node,start,end:offset};});
  const ranges=[];
  const superscripts=source.filter(item=>isNumericSuperscript(item.node)).map(({start,end})=>({start,end}));
  for(const range of sentenceRanges(raw,{superscripts})){
   // A link spanning a sentence boundary stays an intact interactive element.
   let end=range.end;const at=source.find(n=>n.start<end&&n.end>=end),link=at?.node.parentElement?.closest('a,[role="link"]');
   if(link&&unit.p.contains(link))for(const n of source)if(link.contains(n.node))end=Math.max(end,n.end);
   const prior=ranges.at(-1);if(prior&&range.start<prior.end)prior.end=Math.max(prior.end,end);else ranges.push({start:range.start,end});
  }
  const selected=ranges.filter(range=>{
   const parts=source.filter(n=>n.end>range.start&&n.start<range.end);if(!parts.length)return false;
   const first=parts[0],last=parts.at(-1),retained=parts.some(n=>keep.has(n.node));
   if(retained)return true;
   if(!visible(unit,first.node,range.start-first.start,last.node,range.end-last.start))return false;
   if(added>=limit){onMore();return false;}added++;return true;
  });
  const boundaries=[...new Set(selected.flatMap(r=>[r.start,r.end]))].filter(end=>end>0&&end<raw.length).sort((a,b)=>a-b),fragments=[];
  for(const item of source){
   let node=item.node,start=item.start,owner=owners.get(node)||generated.get(node);
   for(const end of boundaries.filter(b=>b>item.start&&b<item.end)){
    owner??={node,parent:node.parentNode,text:node.textContent,generated:new Map(),adopted:false};owners.set(owner.node,owner);
    const cut=end-start,right=node.ownerDocument.createTextNode(node.textContent.slice(cut));node.textContent=node.textContent.slice(0,cut);
    if(node===owner.node)owner.text=node.textContent;else owner.generated.set(node,node.textContent);
    node.after(right);owner.generated.set(right,right.textContent);generated.set(right,owner);splits.push({left:node,right,owner});fragments.push({node,start,end});node=right;start=end;
   }
   fragments.push({node,start,end:item.end});
  }
  for(const range of selected){
   const nodes=fragments.filter(n=>n.start>=range.start&&n.end<=range.end&&n.end>n.start).map(n=>n.node),text=normalize(nodes.map(n=>n.textContent).join(''));
   if(!/[A-Za-z]{2}/.test(text)||text.length>20000)continue;
   let anchor=nodes.at(-1);
   // Place Chinese outside a completed inline element, preserving its listener and identity.
   while(anchor?.parentElement&&anchor.parentElement!==unit.p){let next=anchor.nextSibling;while(next?.nodeType===1&&next.matches('.lextide-translation'))next=next.nextSibling;if(next)break;anchor=anchor.parentElement;}
   result.push({...unit,nodes,text,anchor,whole:false,sentence:true,paragraphEnd:range.end===raw.length&&lastUnits.get(unit.p)===unit});
  }

 }
 return result;
}
// Only remove our unchanged fragments when the host replaces/removes its own
// original text node. A host edit/reparent of a generated node transfers ownership.
export function repairSentenceSources(splits,root=null,changedText=null){
 const owners=new Set(splits.map(split=>split.owner).filter(Boolean)),removed=new Set(),repaired=[];
 for(const owner of owners){
  const parent=owner.node.parentNode||owner.parent,originalRemoved=!owner.node.parentNode;
  if(!parent||root&&!root.contains(originalRemoved?parent:owner.node))continue;
  for(const [node,text] of owner.generated){
   if(!node.parentNode){owner.generated.delete(node);continue;}
   if(node.parentNode!==parent||node.textContent!==text||changedText?.has(node)){owner.adopted=true;break;}
  }
  if(owner.adopted||!originalRemoved&&owner.node.textContent===owner.text&&!changedText?.has(owner.node))continue;
  for(const node of owner.generated.keys())if(node.parentNode===parent)node.remove();
  removed.add(owner);repaired.push(originalRemoved?parent:owner.node);
 }
 if(removed.size){let at=0;for(const split of splits)if(!removed.has(split.owner))splits[at++]=split;splits.length=at;}
 return repaired;
}
export function restoreSentenceSplits(splits){
 for(const {left,right} of splits.reverse())if(left.parentNode&&left.parentNode===right.parentNode&&left.nextSibling===right){left.textContent+=right.textContent;right.remove();}
 splits.length=0;
}
