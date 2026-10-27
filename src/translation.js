import {sentenceUnits,restoreSentenceSplits,repairSentenceSources} from './sentences.js';
import {proseUnits,readingScopes,sameUnit,mutationScope,ownMutation,readableSourceNodes,EXCLUDED,paragraphs} from './prose-units.js';
export {EXCLUDED,paragraphs};
const delay=(ms,signal)=>new Promise((resolve,reject)=>{
 const abort=()=>{clearTimeout(timer);reject(signal.reason||Error('已取消'));};
 const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},ms);
 signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();
});
function abortable(promise,signal){
 return new Promise((resolve,reject)=>{const abort=()=>reject(signal.reason||Error('已取消'));if(signal.aborted){abort();return;}signal.addEventListener('abort',abort,{once:true});Promise.resolve(promise).then(resolve,reject).finally(()=>signal.removeEventListener('abort',abort));});
}
export class ParagraphTranslator{
 constructor({root,demo=false,store,translate,report=()=>{},interval=1200,quietOffline=false,cacheNamespace,sourceName='Cloudflare AI'}){Object.assign(this,{root,demo,store,translate,report,interval,quietOffline,cacheNamespace,sourceName});this.records=[];this.splits=[];this.active=false;this.lastRequest=0;this.hiddenByReader=new WeakSet();this.dirty=new Set();this.textChanges=new WeakSet();}
 rect(r){
  if(r.sentence&&r.nodes.length&&document.createRange){const range=document.createRange();if(!range.getBoundingClientRect)return r.p.getBoundingClientRect?.();range.setStart(r.nodes[0],0);range.setEnd(r.nodes.at(-1),r.nodes.at(-1).textContent.length);const rect=range.getBoundingClientRect?.();if(rect)return rect;}
  return r.p.getBoundingClientRect?.();
 }
 eligible(r){const rect=this.rect(r),p=r.p;return !rect||(!p.getClientRects||p.getClientRects().length>0)&&rect.bottom>=0&&rect.top<=(window.innerHeight||800)+200;}
 record(unit){return {...unit,state:'idle',eligible:this.eligible(unit),node:null,controller:new AbortController(),originalHidden:unit.p.hidden};}
 async start(mode,online,translationUnit='paragraph'){
  this.stop();if(mode==='original')return;this.active=true;this.rateLimited=false;this.pauseReason=null;this.mode=mode;this.translationUnit=mode==='bilingual'&&translationUnit==='sentence'?'sentence':'paragraph';this.online=online;this.regions=readingScopes(this.root,{demo:this.demo,hiddenByReader:this.hiddenByReader});this.controller=new AbortController();this.records=this.units(proseUnits(this.root,this.scanOptions())).map(u=>this.record(u));
  if(typeof window.IntersectionObserver==='function'){
   this.observer=new window.IntersectionObserver(entries=>{for(const entry of entries)for(const r of this.records)if(r.p===entry.target)r.eligible=r.sentence?this.eligible(r):entry.isIntersecting;void this.pump();},{rootMargin:'200px'});
   for(const r of this.records)this.observer.observe(r.p);
  }else for(const r of this.records)r.eligible=true;
  if(!this.demo&&typeof window.MutationObserver==='function'){
   this.onChanges=(changes,recordText=true)=>{
    const relevant=changes.filter(m=>!ownMutation(m,this.hiddenByReader));if(!relevant.length)return;if(recordText!==false)this.rememberTextChanges(relevant);
    for(const change of relevant){const scope=mutationScope(change.target,this.root);if(this.dirty.size<32)this.dirty.add(scope);else{this.dirty.clear();this.dirty.add(this.root);break;}}
    if(!this.scanTimer)this.scanTimer=setTimeout(()=>{this.scanTimer=null;const scopes=[...this.dirty];this.dirty.clear();this.refresh(scopes);},150);
   };
   this.mutations=new window.MutationObserver(this.onChanges);
   this.mutations.observe(this.root,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['hidden','open','aria-hidden','inert','class','style','translate','contenteditable']});
  }
  if(this.translationUnit==='sentence'){
   this.onScroll=()=>{if(this.scrollTimer)return;this.scrollTimer=setTimeout(()=>{this.scrollTimer=null;if(this.active){this.refresh([this.root],false,true);void this.pump();}},120);};
   window.addEventListener('scroll',this.onScroll,true);
  }
  this.onResize=()=>{if(this.resizeTimer)return;this.resizeTimer=setTimeout(()=>{this.resizeTimer=null;if(this.active)this.refresh([this.root]);},120);};
  window.addEventListener('resize',this.onResize);
  await this.pump();
 }
 scanOptions(){return {demo:this.demo,hiddenByReader:this.hiddenByReader,limit:Infinity,nodeLimit:Infinity,textLimit:this.translationUnit==='sentence'?100000:20000};}
 // At async boundaries, apply source edits already queued by the observer before
 // accepting the snapshot. Idle edits still use the normal coalescing timer.
 flushChanges(){
  if(!this.active)return;const pending=this.mutations?.takeRecords?.()||[];if(pending.length)this.onChanges?.(pending);
  if(!this.dirty.size)return;clearTimeout(this.scanTimer);this.scanTimer=null;const scopes=[...this.dirty];this.dirty.clear();this.refresh(scopes,false);
 }
 units(units,old=[]){
  if(this.translationUnit!=='sentence')return units;
  this.splits=this.splits.filter(({left,right})=>left.parentNode===right.parentNode&&this.root.contains(left)&&this.root.contains(right));
  const pending=this.mutations?.takeRecords?.()||[];
  const keep=new Set(old.flatMap(r=>r.nodes));this.moreVisible=false;
  const result=sentenceUnits(units.filter(unit=>this.eligible(unit)||unit.nodes.some(node=>keep.has(node))),this.splits,400,{keep,onMore:()=>{this.moreVisible=true;},visible:(unit,first,start,last,end)=>{
   if(!this.eligible(unit))return false;
   const range=document.createRange?.();if(!range?.getBoundingClientRect)return true;
   range.setStart(first,start);range.setEnd(last,end);const rect=range.getBoundingClientRect();return rect.bottom>=0&&rect.top<=(window.innerHeight||800)+200;
  }});
  this.mutations?.takeRecords?.(); // Discard only our synchronous text splits, retain queued page edits.
  if(pending.length)this.onChanges(pending);
  return result;
 }
 rememberTextChanges(changes){if(this.splits.length)for(const change of changes)if(change.type==='characterData'&&change.target&&!ownMutation(change,this.hiddenByReader))this.textChanges.add(change.target);}
 dispose(r){r.controller.abort();this.observer?.unobserve?.(r.p);r.node?.remove();if(r.changedHidden){r.p.hidden=r.originalHidden;this.hiddenByReader.delete(r.p);}}
 refresh(scopes=[this.root],pump=true,windowOnly=false){
  if(!this.active)return;
  if(this.splits.length){
   const pending=this.mutations?.takeRecords?.()||[];this.rememberTextChanges(pending);const changedText=this.textChanges;this.textChanges=new WeakSet();
   const detached=this.records.filter(r=>!this.root.contains(r.p));for(const r of detached)this.dispose(r);this.records=this.records.filter(r=>this.root.contains(r.p));
   const outside=this.splits.filter(({left,right})=>!this.root.contains(left)&&!this.root.contains(right));
   if(outside.length){const removed=new Set(outside);this.splits=this.splits.filter(split=>!removed.has(split));repairSentenceSources(outside,null,changedText);restoreSentenceSplits(outside);}
   const repaired=repairSentenceSources(this.splits,this.root,changedText);
   this.mutations?.takeRecords?.(); // Only our synchronous cleanup/restoration.
   if(pending.length)this.onChanges?.(pending,false);
   if(repaired.length){
    const changed=[...new Set(repaired.map(node=>mutationScope(node,this.root)))],invalid=r=>changed.some(scope=>scope.contains(r.p)||r.p.contains(scope));
    for(const r of this.records)if(invalid(r))this.dispose(r);this.records=this.records.filter(r=>!invalid(r));
    scopes=[...new Set([...scopes,...changed])];if(scopes.length>32)scopes=[this.root];windowOnly=false;
   }
  }
  const regions=readingScopes(this.root,{demo:this.demo,hiddenByReader:this.hiddenByReader});
  if(!this.regions||regions.length!==this.regions.length||regions.some((region,i)=>region!==this.regions[i])){scopes=[this.root];windowOnly=false;}
  this.regions=regions;
  if(windowOnly)for(const r of this.records)if(r.state==='loading'&&!this.eligible(r)){r.controller.abort();r.controller=new AbortController();r.state='idle';r.node?.remove();r.node=null;}
  scopes=scopes.filter((s,i)=>this.root.contains(s)&&!scopes.some((other,j)=>i!==j&&other!==s&&other.contains(s)));
  const affected=r=>!this.root.contains(r.p)||(!windowOnly||this.eligible({p:r.p}))&&scopes.some(s=>s.contains(r.p)||r.p.contains(s));
  const old=this.records.filter(affected),unaffected=this.records.filter(r=>!affected(r));
  const next=[];
  scopes=scopes.filter(s=>regions.some(region=>region.contains(s)||s.contains(region)));
  for(const scope of scopes){for(const unit of proseUnits(scope,this.scanOptions())){if(windowOnly&&!this.eligible(unit)||next.some(u=>sameUnit(u,unit)))continue;next.push(unit);}}
  const keep=[],used=new Set();
  for(const unit of this.units(next,old)){const found=old.find(r=>!used.has(r)&&sameUnit(r,unit));if(found){used.add(found);keep.push(found);}else keep.push(unit);}
  for(const r of old)if(!used.has(r))this.dispose(r);
  const refreshed=keep.map(r=>r.controller?r:this.record(r));this.records=[...unaffected,...refreshed];
  for(const r of refreshed)if(this.records.includes(r))this.observer?.observe(r.p);else this.dispose(r);
  if(pump)void this.pump();
 }
 stop(){this.rememberTextChanges(this.mutations?.takeRecords?.()||[]);this.active=false;this.regions=null;this.moreVisible=false;window.removeEventListener('scroll',this.onScroll,true);window.removeEventListener('resize',this.onResize);clearTimeout(this.resizeTimer);this.resizeTimer=null;clearTimeout(this.scrollTimer);this.scrollTimer=null;this.controller?.abort();this.observer?.disconnect();this.mutations?.disconnect();clearTimeout(this.scanTimer);this.scanTimer=null;this.dirty.clear();for(const r of this.records)this.dispose(r);repairSentenceSources(this.splits,null,this.textChanges);restoreSentenceSplits(this.splits);this.textChanges=new WeakSet();this.records=[];this.pumping=false;}
 summary(){const all=this.records,unit=this.translationUnit==='sentence'?'句':'段',done=all.filter(r=>r.state==='done').length,progress=this.translationUnit==='sentence'?`已翻译 ${done} 句 · 已加载 ${all.length} 句`:`已翻译 ${done} / ${all.length} 段`,completed=all.filter(r=>r.state==='done'),example=completed.filter(r=>r.translationKind==='example').length,cached=completed.filter(r=>r.translationKind==='cache').length,provider=done-example-cached,source=[example&&`人工示例 ${example} ${unit}`,cached&&`本地缓存（${this.sourceName}） ${cached} ${unit}`,provider&&`${this.sourceName} 服务返回 ${provider} ${unit}`].filter(Boolean).join(' · ')||`当前引擎：${this.sourceName}`;this.report(`${progress} · ${all.filter(r=>r.state==='error').length} ${unit}失败${all.some(r=>r.state==='blocked')?' · 等待联网授权':''}${' · '+source}${this.online?'':' · 联网关闭（仅示例或缓存）'}${this.translationUnit==='sentence'?' · 随阅读继续翻译':''}${this.rateLimited?(this.pauseReason==='service'?' · 服务暂不可用，后续翻译已暂停；稍后重试':' · 服务限流，后续翻译已暂停；稍后重试'):''}`);}


 layout(change){
  // Keep the source near the reading position stable as earlier translations grow.
  if(typeof window.scrollBy!=='function')return change();
  const height=window.innerHeight||800;
  const candidates=this.records.map(r=>({r,rect:this.rect(r)})).filter(x=>x.rect&&x.rect.height>0&&x.rect.bottom>0&&x.rect.top<height);
  candidates.sort((a,b)=>{const distance=x=>Math.abs((Math.max(0,x.rect.top)+Math.min(height,x.rect.bottom))/2-height/2);return distance(a)-distance(b);});
  const anchor=candidates[0],result=change();
  if(anchor&&anchor.r.p.isConnected&&!anchor.r.p.hidden){const shift=this.rect(anchor.r).top-anchor.rect.top;if(Number.isFinite(shift)&&Math.abs(shift)>0.5)window.scrollBy({top:shift,left:0,behavior:'instant'});}
  return result;
 }
 node(r){
  if(r.node?.isConnected)return r.node;
  const css=r.p.ownerDocument?.defaultView?.getComputedStyle?.(r.p.parentElement);
  r.inside=!r.whole||r.p.matches('li,td,th,dt,dd,summary')||r.p.parentElement?.matches('p,h1,h2,h3,h4,h5,h6,span,a,em,strong')||['flex','inline-flex','grid','inline-grid'].includes(css?.display);
  const node=document.createElement(r.inside?'span':r.p.parentElement?.matches('ul,ol')?'li':'div');node.className='lextide-translation';node.setAttribute('lang','zh-Hans');if(r.sentence)node.dataset.translationUnit='sentence';
  node.style.cssText='all:initial;display:block;color:inherit;font:inherit;line-height:1.8;margin:0.5em 0 0.9em;padding:0.25em 0 0.25em 0.75em;border-left:2px solid #32AA9C;overflow-wrap:anywhere;white-space:normal;list-style:none;min-width:0';
  if(r.sentence){
   // Tight sentence pairs; larger space only at the original paragraph boundary.
   node.style.fontSize='0.94em';node.style.lineHeight='1.65';node.style.margin='0.12em 0 '+(r.paragraphEnd?'1.45em':'0.4em');node.style.padding='0.08em 0 0.08em 0.65em';node.style.borderLeftColor='#32AA9C80';
   if(r.paragraphEnd)node.dataset.paragraphEnd='true';
  }
  if(r.inside){const anchor=r.whole?r.p.lastChild:r.anchor;if(anchor&&r.p.contains(anchor))anchor.after(node);else r.p.append(node);}else r.p.after(node);
  r.node=node;return node;
 }
 render(r,value,source,kind='provider'){r.translationKind=kind;this.layout(()=>{
  const node=this.node(r);node.replaceChildren();const text=document.createElement(r.inside?'span':'p');text.className='lextide-translation-text';text.style.margin='0';text.textContent=value;node.append(text);node.dataset.translationSource=source;
  const rich=r.p.querySelector('a,img,picture,video,audio,svg,math,code,iframe,button,input,textarea,select')||[...r.p.querySelectorAll('[role="button"]')].some(e=>!this.demo||!e.dataset.word);
  if(this.mode==='translated'&&r.whole&&!r.inside&&!rich){
   r.changedHidden=true;this.hiddenByReader.add(r.p);r.p.hidden=true;const b=document.createElement('button');b.textContent='查看英文原文';b.style.cssText='display:block;min-height:44px;background:none;border:0;color:#223B55;cursor:pointer';
   b.onclick=()=>{r.p.hidden=!r.p.hidden;b.textContent=r.p.hidden?'查看英文原文':'收起英文原文';};node.append(b);
  }
 });}
 current(r,signal){return this.active&&!signal.aborted&&this.records.includes(r)&&this.root.contains(r.p)&&r.nodes.every(n=>r.p.contains(n))&&r.nodes.map(n=>n.textContent).join('').replace(/\s+/gu,' ').trim()===r.text&&readableSourceNodes(r.nodes,{demo:this.demo,hiddenByReader:this.hiddenByReader});}
 async pump(){
  if(this.pumping||!this.active||this.rateLimited)return;this.pumping=true;const session=this.controller,signal=session.signal,cacheNamespace=this.cacheNamespace,sourceName=this.sourceName;this.report('正在处理当前可视区域…');
  try{while(this.active&&!signal.aborted){
   if(this.translationUnit==='sentence')for(const item of this.records)item.eligible=this.eligible(item);
   const r=this.records.filter(r=>r.eligible&&r.state==='idle').sort((a,b)=>{const distance=r=>{const rect=this.rect(r),height=window.innerHeight||800;return rect?Math.abs((Math.max(0,rect.top)+Math.min(height,rect.bottom))/2-height/2):0;};return distance(a)-distance(b);})[0];if(!r){if(this.moreVisible){this.refresh([this.root],false,true);continue;}break;}
   const requestSignal=AbortSignal.any([signal,r.controller.signal]);r.state='loading';
   try{
    let value=this.demo&&r.whole?r.p.dataset.translation:null,fresh=false;let kind=value?'example':'cache',source='词汐 · 人工示例译文';
    if(!value){try{value=await abortable(this.store.cacheGet(r.text,cacheNamespace),requestSignal);}catch{requestSignal.throwIfAborted();value=null;}source='本地缓存 · '+sourceName+' 翻译';}
    if(!requestSignal.aborted)this.flushChanges();requestSignal.throwIfAborted();
    if(!this.current(r,requestSignal)){this.refresh([this.root],false);continue;}
    if(!value){
     if(!this.online){if(this.quietOffline){r.state='blocked';continue;}throw Error('当前无法联网翻译，请检查网络');}
     this.layout(()=>{this.node(r).textContent='正在翻译…';});
     for(let attempt=0;attempt<2;attempt++){
      try{const wait=Math.max(0,this.interval-(Date.now()-this.lastRequest));if(wait)await delay(wait,requestSignal);if(!requestSignal.aborted)this.flushChanges();requestSignal.throwIfAborted();if(!this.current(r,requestSignal))break;this.lastRequest=Date.now();value=await abortable(this.translate(r.text,{signal:requestSignal,engineKey:cacheNamespace}),requestSignal);break;}
      catch(e){if(requestSignal.aborted||e.retryable!==true||attempt===1)throw e;await delay(this.interval,requestSignal);}
     }
     if(!requestSignal.aborted)this.flushChanges();
     if(!this.current(r,requestSignal)){if(!requestSignal.aborted)this.refresh([this.root],false);continue;}
     if(typeof value!=='string'||!value.trim())throw Error('服务未返回有效译文');
     source=sourceName+' · 机器翻译';kind='provider';fresh=true;
    }
    if(!this.current(r,requestSignal)){if(!requestSignal.aborted)this.refresh([this.root],false);continue;}r.state='done';this.render(r,value,source,kind);
    // Persistence is optional: display the valid result first, and stop waiting
    // when this reading session is cancelled. A late write cannot update its UI.
    if(fresh)try{await abortable(Promise.resolve().then(()=>{
     if(!requestSignal.aborted)this.flushChanges();
     if(!this.current(r,requestSignal)){if(!requestSignal.aborted)this.refresh([this.root],false);return;}
     return this.store.cacheSet(r.text,value,cacheNamespace);
    }),requestSignal);}catch{if(this.current(r,requestSignal))this.report('缓存无法保存，译文仍可阅读');}
   }catch(e){
    if(!requestSignal.aborted)this.flushChanges();
    if(!this.current(r,requestSignal)){if(!requestSignal.aborted)this.refresh([this.root],false);continue;}r.state='error';const node=this.node(r);node.textContent='翻译失败：'+e.message;const retry=document.createElement('button');retry.textContent=r.sentence?'重试此句':'重试此段';retry.style.cssText='display:block;min-height:44px';retry.onclick=()=>void this.retry(r);node.append(retry);if(['RATE_LIMITED','TRANSLATION_UNAVAILABLE','TRANSLATION_BUSY','TRANSLATION_QUOTA_EXCEEDED','ENGINE_AUTH','ENGINE_CONFIG','ENGINE_CHANGED'].includes(e.code)){this.rateLimited=true;this.pauseReason=e.code==='RATE_LIMITED'?'rate':'service';break;}
   }
   if(!signal.aborted)this.summary();
  }}finally{if(this.controller===session){this.pumping=false;if(!signal.aborted)this.summary();}}
 }
 retry(record){
  // A host edit can precede the debounced mutation scan. Read the current source
  // before an explicit retry so replaced sentences are never sent again.
  this.refresh([this.root],false);this.rateLimited=false;
  for(const r of this.records)if((!record||r===record)&&(r.state==='error'||r.state==='blocked'))r.state='idle';
  return this.pump();
 }
}
