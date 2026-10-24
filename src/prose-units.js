// Original implementation: read text runs, never serialize/replace source HTML.
export const EXCLUDED='nav,footer,aside,pre,code,script,style,noscript,template,textarea,input,select,button,svg,math,form,iframe,canvas,[role="navigation"],[role="banner"],[role="textbox"],[role="button"],[role="toolbar"],[role="menu"],[role="dialog"],[aria-hidden="true"],[inert],[translate="no"],.notranslate,.advertisement,.ads,.ad-container,.toolbar,.editor,.monaco-editor,.cm-editor,.lextide-translation,lextide-reader,lextide-refresh-notice,[contenteditable]:not([contenteditable="false"])';
const BLOCK='p,h1,h2,h3,h4,h5,h6,li,blockquote,div,section,article,main,header,ul,ol,dl,dt,dd,table,thead,tbody,tfoot,tr,td,th,figure,figcaption,details,summary';
const PROSE='p,h1,h2,h3,h4,h5,h6,li,blockquote,div,section,article,main,dt,dd,td,th,figcaption,summary';
const normalize=s=>s.replace(/\s+/gu,' ').trim();
const owned=e=>e?.closest?.('.lextide-translation,lextide-reader,lextide-refresh-notice');
function exclusionView({demo=false,hiddenByReader=new WeakSet()}={}){
 const styles=new WeakMap();
 const style=e=>{if(!styles.has(e))styles.set(e,e.ownerDocument?.defaultView?.getComputedStyle?.(e)||{});return styles.get(e);};
 function excluded(e){
  if(e.matches(EXCLUDED)&&!(demo&&e.matches('[role="button"][data-word]')))return true;
  if(e.tagName==='HEADER'&&!e.closest('article'))return true;
  if(e.hidden&&!hiddenByReader.has(e))return true;
  const css=style(e);return css.visibility==='hidden'||css.visibility==='collapse'||css.contentVisibility==='hidden'||css.display==='none'&&!hiddenByReader.has(e);
 }
 return {style,excluded};
}
function readableScope(scope,root,excluded){
 let depth=0;
 for(let e=scope;e?.nodeType===1;e=e.parentElement){
  if(++depth>5000||excluded(e))return false;
  if(e!==scope&&e.tagName==='DETAILS'&&!e.hasAttribute('open')&&![...e.children].find(c=>c.tagName==='SUMMARY')?.contains(scope))return false;
  if(e===root)break;
 }
 return true;
}
// Recheck only original nodes and their ancestors, not every sentence in a long
// paragraph. Use the same exclusions as the initial scan, including disclosures.
export function readableSourceNodes(nodes,options={}){
 const {excluded}=exclusionView(options);
 return nodes.every(node=>{const parent=node.parentElement;return !!parent&&!(parent.tagName==='DETAILS'&&!parent.hasAttribute('open'))&&readableScope(parent,null,excluded);});
}
export function proseUnits(root,{demo=false,hiddenByReader=new WeakSet(),limit=400,textLimit=20000,nodeLimit=10000}={}){
 const units=[];let visited=0,overflow=false,order=0;
 const {style,excluded}=exclusionView({demo,hiddenByReader});
 if(!readableScope(root,null,excluded))return [];
 function block(e){return e.matches(BLOCK)||['block','list-item','table-cell','flex','grid'].includes(style(e).display);}
 function visit(host){
  if(overflow||units.length>=limit||excluded(host))return;
  if(++visited>nodeLimit){overflow=true;return;}
  let nodes=[],anchors=[],split=false,pending=[];
  const flush=()=>{if(!nodes.length)return;const text=normalize(nodes.map(n=>n.textContent).join(''));if(/[A-Za-z]{2}/.test(text)&&text.length<=textLimit)pending.push({p:host,nodes,anchor:anchors.at(-1),text,order:order++});nodes=[];anchors=[];};
  function inline(node,anchor){
   if(++visited>nodeLimit){overflow=true;return;}
   if(node.nodeType===3){nodes.push(node);anchors.push(anchor);return;}
   if(node.nodeType!==1||excluded(node))return;
   if(node.tagName==='BR'){flush();split=true;return;}
   if(block(node)){flush();split=true;visit(node);return;}
   for(const child of node.childNodes)inline(child,anchor);
  }
  for(const child of host.childNodes){
   // A closed disclosure contributes only its visible summary.
   if(host.tagName==='DETAILS'&&!host.hasAttribute('open')&&child.nodeType===1&&child.tagName!=='SUMMARY')continue;
   if(host.tagName==='DETAILS'&&!host.hasAttribute('open')&&child.nodeType===3)continue;
   inline(child,child);if(overflow)break;
  }
  flush();
  if(!host.matches(PROSE)&&host!==root&&!block(host))return;
  // Pure structural containers are not paragraphs of their own.
  if(host.matches('ul,ol,table,thead,tbody,tfoot,tr,dl,figure,details'))return;
  for(const unit of pending){unit.whole=!split&&pending.length===1;if(!unit.whole)unit.anchor=unit.nodes.at(-1);units.push(unit);if(units.length>=limit)break;}
 }
 const scopes=demo?[...root.querySelectorAll('p.english')]:readingScopes(root,{excluded});
 for(const scope of scopes)if(readableScope(scope,root,excluded))visit(scope);
 units.sort((a,b)=>a.order-b.order);
 return units.slice(0,limit);
}
export function paragraphs(root,demo=false){return [...new Set(proseUnits(root,{demo}).map(u=>u.p))];}
export function sameUnit(a,b){return a.p===b.p&&a.anchor===b.anchor&&a.text===b.text&&a.whole===b.whole&&a.paragraphEnd===b.paragraphEnd&&a.nodes.length===b.nodes.length&&a.nodes.every((n,i)=>n===b.nodes[i]);}
export function mutationScope(target,root){let e=target?.nodeType===1?target:target?.parentElement;while(e&&e!==root&&!e.matches(BLOCK))e=e.parentElement;return e&&root.contains(e)?e:root;}
export function ownMutation(change,hiddenByReader){
 const target=change.target?.nodeType===1?change.target:change.target?.parentElement;
 if(owned(target))return true;
 if(change.type==='attributes'&&change.attributeName==='hidden'&&hiddenByReader.has(target)&&target.hidden)return true;
 return change.type==='childList'&&[...change.addedNodes,...change.removedNodes].length>0&&[...change.addedNodes,...change.removedNodes].every(n=>n.nodeType===1&&owned(n));
}

export function readingScopes(root,options={}){
 if(!root.matches?.('body,html'))return [root];
 const excluded=options.excluded||exclusionView(options).excluded;
 const candidates=[...root.querySelectorAll('article,main,[role="main"]')].filter(e=>!e.closest(EXCLUDED)&&readableScope(e,root,excluded));
 const scopes=candidates.filter(e=>!candidates.some(other=>other!==e&&other.contains(e)));return scopes.length?scopes:[root];
}
