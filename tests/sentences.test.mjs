import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {sentenceRanges} from '../src/sentences.js';
import {ParagraphTranslator} from '../src/translation.js';
import {createStore} from '../src/storage.js';
import {cleanPrefs} from '../src/protocol.js';
function setup(html){const {window}=parseHTML('<html><body><main>'+html+'</main></body></html>');Object.assign(globalThis,{window,document:window.document});const data=new Map(),store=createStore({get:async k=>data.get(k),set:async(k,v)=>data.set(k,v)});return {root:document.querySelector('main'),store};}
const tick=()=>new Promise(setImmediate);
test('scientific sentences keep decimals, abbreviations, quoted endings and numbered references',()=>{
 const text='Dr. Smith et al. report a 3.14% gain (Fig. 2). This agrees with Eq. (3). [12, 14–16] “A clear result!” The U.S. team replicated it.';
 const sentences=sentenceRanges(text).map(r=>text.slice(r.start,r.end).trim());
 assert.deepEqual(sentences,['Dr. Smith et al. report a 3.14% gain (Fig. 2).','This agrees with Eq. (3). [12, 14–16]','“A clear result!”','The U.S. team replicated it.']);
 assert.equal(sentenceRanges(text).map(r=>text.slice(r.start,r.end)).join(''),text);
});
test('sentence translations retain original elements and text-node identity when disabled',async()=>{
 const {root,store}=setup('<p>First <em>important sentence.</em> Second sentence links to <a href="#paper">the paper</a>. Final sentence.</p>');
 const original=root.innerHTML,p=root.firstChild,em=p.querySelector('em'),link=p.querySelector('a'),text=p.lastChild,calls=[];
 const t=new ParagraphTranslator({root,store,interval:0,translate:async s=>{calls.push(s);return '中文 '+s;}});
 await t.start('bilingual',true,'sentence');assert.deepEqual(calls,['First important sentence.','Second sentence links to the paper.','Final sentence.']);assert.equal(root.querySelectorAll('[data-translation-unit=sentence]').length,3);
 assert.equal(em.nextElementSibling?.className,'lextide-translation');assert.equal(link.querySelector('.lextide-translation'),null);
 t.stop();assert.equal(root.innerHTML,original);assert.equal(p.lastChild,text);assert.equal(p.querySelector('em'),em);assert.equal(p.querySelector('a'),link);
 await t.start('bilingual',true,'sentence');assert.equal(calls.length,3,'per-sentence cache avoids repeat requests');t.stop();assert.equal(root.innerHTML,original);
});
test('a link spanning sentence boundaries is kept intact and never contains the Chinese translation',async()=>{
 const {root,store}=setup('<p>Read <a href="#paper">this result. Another finding</a> follows. Last sentence.</p>');const original=root.innerHTML,calls=[];
 const t=new ParagraphTranslator({root,store,interval:0,translate:async s=>{calls.push(s);return '中文';}});await t.start('bilingual',true,'sentence');assert.deepEqual(calls,['Read this result. Another finding follows.','Last sentence.']);assert.equal(root.querySelector('a .lextide-translation'),null);t.stop();assert.equal(root.innerHTML,original);
});
test('sentence mode handles a paragraph longer than 20000 characters without changing source text',async()=>{
 const text=Array.from({length:90},(_,i)=>'Sentence '+i+' describes '+('careful scientific measurements '.repeat(9)).trim()+'.').join(' '),{root,store}=setup('<p>'+text+'</p>');assert.ok(text.length>20000);let calls=0;
 const t=new ParagraphTranslator({root,store,interval:0,translate:async()=>{calls++;return '译文';}});await t.start('bilingual',true,'sentence');assert.equal(calls,90);assert.equal(root.querySelectorAll('.lextide-translation').length,90);t.stop();assert.equal(root.textContent,text);assert.equal(root.firstChild.childNodes.length,1);
});
test('switching granularity aborts pending sentences and never restores their late results',async()=>{
 const {root,store}=setup('<p>Pending sentence. Next sentence.</p>');let finish,signal;
 const t=new ParagraphTranslator({root,store,interval:0,translate:(s,o)=>{if(s==='Pending sentence.'){signal=o.signal;return new Promise(r=>finish=r);}return Promise.resolve('段落译文');}});
 const old=t.start('bilingual',true,'sentence');await tick();await t.start('bilingual',true,'paragraph');assert.ok(signal.aborted);finish('STALE');await old;assert.equal(root.querySelectorAll('.lextide-translation').length,1);assert.equal(root.querySelector('.lextide-translation').textContent,'段落译文');assert.equal(root.querySelector('[data-translation-unit=sentence]'),null);t.stop();assert.equal(root.textContent,'Pending sentence. Next sentence.');
});
test('translation granularity defaults to paragraph and accepts only explicit valid preferences',async()=>{
 const {store}=setup('');assert.equal((await store.prefs()).translationUnit,'paragraph');assert.deepEqual(cleanPrefs({translationUnit:'sentence'}),{translationUnit:'sentence'});assert.deepEqual(cleanPrefs({translationUnit:'other'}),{});await store.savePrefs({translationUnit:'sentence'});assert.equal((await store.prefs()).translationUnit,'sentence');
});

test('rate limiting pauses later sentences until explicit retry without adding repeated error nodes',async()=>{
 const {root,store}=setup('<p>First sentence. Second sentence. Third sentence.</p>');let calls=0,status='';
 const t=new ParagraphTranslator({root,store,interval:0,report:s=>status=s,translate:async()=>{calls++;if(calls===1)throw Object.assign(Error('服务限流'),{code:'RATE_LIMITED',retryable:false});return '译文';}});
 await t.start('bilingual',true,'sentence');assert.equal(calls,1);assert.match(status,/后续翻译已暂停/);assert.equal(root.querySelectorAll('.lextide-translation').length,1);await t.pump();assert.equal(calls,1);await t.retry();assert.equal(calls,4);assert.equal(root.querySelectorAll('.lextide-translation-text').length,3);t.stop();
});

test('visible sentence batches continue past 400 and retain all source text on stop',async()=>{
 const text=Array.from({length:620},(_,i)=>'Research sentence '+i+' reports a measurement.').join(' '),{root,store}=setup('<p>'+text+'</p>');let calls=0;
 const t=new ParagraphTranslator({root,store,interval:0,translate:async()=>{calls++;return '译文';}});await t.start('bilingual',true,'sentence');assert.equal(calls,620);assert.equal(t.records.length,620);assert.equal(root.querySelectorAll('.lextide-translation').length,620);t.stop();assert.equal(root.textContent,text);assert.equal(root.firstChild.childNodes.length,1);assert.equal(await store.cacheGet('Research sentence 0 reports a measurement.'),'译文');
});

test('a provider outage pauses following sentences instead of filling the article with repeated failures',async()=>{
 const {root,store}=setup('<p>First sentence. Another sentence.</p>');let calls=0,status='';const t=new ParagraphTranslator({root,store,interval:0,report:s=>status=s,translate:async()=>{calls++;throw Object.assign(Error('服务暂不可用'),{code:'TRANSLATION_UNAVAILABLE',retryable:false});}});await t.start('bilingual',true,'sentence');assert.equal(calls,1);assert.match(status,/服务暂不可用，后续翻译已暂停/);assert.equal(root.querySelectorAll('.lextide-translation').length,1);await t.pump();assert.equal(calls,1);t.stop();
});

test('adjacent bracket citations and superscript digits stay with the preceding sentence at exact source offsets',()=>{
 for(const [text,expected] of [
  ['First finding.[1] Second finding.',['First finding.[1]','Second finding.']],
  ['First finding.[1][2, 4–6] Second finding.',['First finding.[1][2, 4–6]','Second finding.']],
  ['The result was significant.¹ The estimate is uncertain.',['The result was significant.¹','The estimate is uncertain.']],
  ['First result.¹,² Next result.',['First result.¹,²','Next result.']],
  ['Dr.[1] Smith measured 3.14 volts.² Next finding.',['Dr.[1] Smith measured 3.14 volts.²','Next finding.']]
 ]){
  const ranges=sentenceRanges(text);assert.deepEqual(ranges.map(r=>text.slice(r.start,r.end).trim()),expected,text);assert.equal(ranges.map(r=>text.slice(r.start,r.end)).join(''),text);
 }
});

test('ordinary HTML superscript reference numbers do not merge findings or split decimals',async()=>{
 const {root,store}=setup('<p>First finding.<sup><a href="#ref">1,2</a></sup> The measured value is 3.14.</p>'),original=root.innerHTML,calls=[],link=root.querySelector('a');
 const t=new ParagraphTranslator({root,store,interval:0,translate:async text=>{calls.push(text);return '测试译文';}});
 try{await t.start('bilingual',true,'sentence');assert.deepEqual(calls,['First finding.1,2','The measured value is 3.14.']);assert.equal(root.querySelectorAll('sup .lextide-translation').length,0);}finally{t.stop();}
 assert.equal(root.innerHTML,original);assert.equal(root.querySelector('a')===link,true);
});

test('a host write to the original text node replaces old sentence fragments without moving cached translations',async()=>{
 const {root,store}=setup('<p>First sentence. Second sentence.</p>'),p=root.firstChild,original=p.firstChild,calls=[];
 const t=new ParagraphTranslator({root,store,interval:0,translate:async text=>{calls.push(text);return '译文：'+text;}});
 await t.start('bilingual',true,'sentence');const updated='First sentence. Updated second sentence.';original.nodeValue=updated;t.refresh([p]);await tick();
 try{assert.deepEqual(t.records.map(r=>r.text),['First sentence.','Updated second sentence.']);assert.deepEqual([...p.querySelectorAll('.lextide-translation')].map(n=>n.previousSibling.textContent.trim()),['First sentence.','Updated second sentence.']);assert.deepEqual(calls,['First sentence.','Second sentence.','Updated second sentence.']);}finally{t.stop();}
 assert.equal(root.innerHTML,'<p>'+updated+'</p>');assert.equal(p.firstChild===original,true);
});
test('immediate shutdown after an original text-node update preserves the new canonical source',async()=>{
 const {root,store}=setup('<p>First sentence. Second sentence.</p>'),p=root.firstChild,original=p.firstChild;
 const t=new ParagraphTranslator({root,store,interval:0,translate:async()=> '译文'});await t.start('bilingual',true,'sentence');original.nodeValue='Replacement sentence. Another replacement.';t.stop();
 assert.equal(root.innerHTML,'<p>Replacement sentence. Another replacement.</p>');assert.equal(p.firstChild===original,true);
});
test('host edits to generated sentence fragments are preserved when restoring original text',async()=>{
 const {root,store}=setup('<p>First sentence. Second sentence.</p>'),p=root.firstChild,original=p.firstChild;
 const t=new ParagraphTranslator({root,store,interval:0,translate:async()=> '译文'});await t.start('bilingual',true,'sentence');t.splits[0].right.nodeValue='Host-edited second sentence. New final sentence.';t.refresh([p]);await tick();t.stop();
 assert.equal(root.innerHTML,'<p>First sentence. Host-edited second sentence. New final sentence.</p>');assert.equal(p.firstChild===original,true);
});
test('canonical source replacement cancels pending old sentences and rejects their late cache writes',async()=>{
 const {root,store}=setup('<p>Old pending sentence. Old second sentence.</p>'),p=root.firstChild,original=p.firstChild;let finish,signal;
 const t=new ParagraphTranslator({root,store,interval:0,translate:(text,options)=>{if(text==='Old pending sentence.'){signal=options.signal;return new Promise(resolve=>finish=resolve);}return Promise.resolve('当前译文');}});
 const pending=t.start('bilingual',true,'sentence');await tick();original.nodeValue='Updated first sentence. Updated second sentence.';t.refresh([p]);await pending;await tick();
 try{assert.equal(signal.aborted,true);assert.deepEqual(t.records.map(r=>r.text),['Updated first sentence.','Updated second sentence.']);finish('迟到旧译文');await tick();assert.equal(await store.cacheGet('Old pending sentence.'),null);}finally{t.stop();}
 assert.equal(root.innerHTML,'<p>Updated first sentence. Updated second sentence.</p>');
});

test('removing or replacing the canonical text node also removes untouched generated fragments',async()=>{
 for(const replace of [false,true]){
  const {root,store}=setup('<p>First sentence. Second sentence.</p>'),p=root.firstChild,original=p.firstChild,replacement=document.createTextNode('Replacement first sentence. Replacement second sentence.');
  const t=new ParagraphTranslator({root,store,interval:0,translate:async()=> '译文'});await t.start('bilingual',true,'sentence');if(replace)original.replaceWith(replacement);else original.remove();t.refresh([p]);await tick();t.stop();
  assert.equal(root.innerHTML,replace?'<p>Replacement first sentence. Replacement second sentence.</p>':'<p></p>');if(replace)assert.equal(p.firstChild===replacement,true);
 }
});

test('detached cached paragraphs are restored before their split metadata is discarded',async()=>{
 const {root,store}=setup('<p>Cached first sentence. Cached second sentence.</p>'),p=root.firstChild,original=p.firstChild;
 const t=new ParagraphTranslator({root,store,interval:0,translate:async()=> '译文'});await t.start('bilingual',true,'sentence');p.remove();t.refresh([root]);await tick();
 try{assert.equal(p.childNodes.length,1);assert.equal(original.nodeValue,'Cached first sentence. Cached second sentence.');original.nodeValue='Restored first sentence. Restored second sentence.';root.append(p);t.refresh([root]);await tick();assert.deepEqual(t.records.map(r=>r.text),['Restored first sentence.','Restored second sentence.']);}finally{t.stop();}
 assert.equal(root.innerHTML,'<p>Restored first sentence. Restored second sentence.</p>');assert.equal(p.firstChild===original,true);
});

for(const kind of ['all','single'])test('explicit '+kind+' retry reconciles a source changed before the mutation scan',async()=>{
 const {root,store}=setup('<p>Original first sentence. Original second sentence.</p>'),p=root.firstChild,original=p.firstChild,calls=[];let outage=true;
 const t=new ParagraphTranslator({root,store,interval:0,translate:async text=>{calls.push(text);if(outage)throw Object.assign(Error('Service unavailable'),{code:'TRANSLATION_UNAVAILABLE',retryable:false});return '译文：'+text;}});
 try{
  await t.start('bilingual',true,'sentence');assert.deepEqual(calls,['Original first sentence.']);const button=root.querySelector('.lextide-translation button');outage=false;
  if(kind==='all'){p.textContent='Replacement first sentence. Replacement second sentence.';await t.retry();}
  else{original.nodeValue='Replacement first sentence. Replacement second sentence.';button.onclick();await tick();}
  assert.deepEqual(calls,['Original first sentence.','Replacement first sentence.','Replacement second sentence.']);
  assert.equal(await store.cacheGet('Original first sentence.'),null);assert.equal(await store.cacheGet('Original second sentence.'),null);
 }finally{t.stop();}
 assert.equal(root.innerHTML,'<p>Replacement first sentence. Replacement second sentence.</p>');
});

test('single-unit retry preserves other failed units until retry-all is requested',async()=>{
 const {root,store}=setup('<p>First sentence. Second sentence. Third sentence.</p>'),calls=[];let recovering=false;
 const t=new ParagraphTranslator({root,store,interval:0,translate:async text=>{calls.push(text);if(!recovering&&text!=='Third sentence.')throw Object.assign(Error('Unavailable unit'),{retryable:false});return '译文：'+text;}});
 try{
  await t.start('bilingual',true,'sentence');assert.equal(root.querySelectorAll('.lextide-translation button').length,2);recovering=true;
  root.querySelector('.lextide-translation button').onclick();await tick();assert.deepEqual(calls,['First sentence.','Second sentence.','Third sentence.','First sentence.']);assert.equal(root.querySelectorAll('.lextide-translation button').length,1);
  await t.retry();assert.equal(calls.length,5);assert.equal(calls.at(-1),'Second sentence.');assert.equal(root.querySelectorAll('.lextide-translation button').length,0);
 }finally{t.stop();}
 assert.equal(root.innerHTML,'<p>First sentence. Second sentence. Third sentence.</p>');
});

for(const unit of ['paragraph','sentence'])for(const change of ['hidden','changed'])test(unit+' cache wait rechecks '+change+' source before transport',async()=>{
 const {root}=setup('<p>Original first sentence. Original second sentence.</p>'),calls=[],saved=[];let release,reads=0;
 const t=new ParagraphTranslator({root,interval:0,store:{cacheGet:async()=>++reads===1?new Promise(resolve=>release=resolve):null,cacheSet:async text=>saved.push(text)},translate:async text=>{calls.push(text);return '译文：'+text;}});
 try{
  const pending=t.start('bilingual',true,unit);await tick();assert.equal(typeof release,'function');if(change==='hidden')root.firstChild.hidden=true;else root.firstChild.textContent='Replacement first sentence. Replacement second sentence.';release(null);await pending;
  assert.deepEqual(calls,change==='hidden'?[]:unit==='sentence'?['Replacement first sentence.','Replacement second sentence.']:['Replacement first sentence. Replacement second sentence.']);assert.ok(saved.every(text=>text.startsWith('Replacement')));
 }finally{t.stop();}
 assert.equal(root.firstChild.textContent,change==='changed'?'Replacement first sentence. Replacement second sentence.':'Original first sentence. Original second sentence.');if(change==='hidden')assert.equal(root.firstChild.hidden,true);
});
for(const outcome of ['success','failure'])test('hiding source before its '+outcome+' result settles blocks late DOM and cache writes',async()=>{
 const {root}=setup('<p>Original sentence.</p>'),saved=[];let finish,calls=0;
 const t=new ParagraphTranslator({root,interval:0,store:{cacheGet:async()=>null,cacheSet:async text=>saved.push(text)},translate:()=>{calls++;return new Promise((resolve,reject)=>finish=outcome==='failure'?reject:resolve);}});
 try{const pending=t.start('bilingual',true);await tick();root.firstChild.hidden=true;finish(outcome==='failure'?Error('Synthetic hidden-source failure'):'迟到译文');await pending;assert.equal(calls,1);assert.deepEqual(saved,[]);assert.equal(root.querySelectorAll('.lextide-translation').length,0);}finally{t.stop();}
 assert.equal(root.firstChild.hidden,true);assert.equal(root.firstChild.textContent,'Original sentence.');
});

test('a delayed cache hit cannot reveal a source hidden while waiting',async()=>{
 const {root}=setup('<p>Original cached sentence.</p>');let release,calls=0,saved=0;
 const t=new ParagraphTranslator({root,interval:0,store:{cacheGet:()=>new Promise(resolve=>release=resolve),cacheSet:async()=>{saved++;}},translate:async()=>{calls++;return '不应调用的译文';}});
 try{const pending=t.start('bilingual',true);await tick();root.firstChild.hidden=true;release('已有本地缓存译文');await pending;assert.equal(calls,0);assert.equal(saved,0);assert.equal(root.querySelectorAll('.lextide-translation').length,0);}finally{t.stop();}
 assert.equal(root.firstChild.hidden,true);assert.equal(root.firstChild.textContent,'Original cached sentence.');
});

for(const unit of ['paragraph','sentence'])for(const insertion of ['prefix','inline'])test(unit+' cache wait reconciles '+insertion+' nodes added without editing old text',async()=>{
 const {root}=setup('<p>Original <em>first</em> sentence. Original second sentence.</p>'),p=root.firstChild,original=p.firstChild,em=p.querySelector('em'),calls=[];let reads=0,release;
 const t=new ParagraphTranslator({root,interval:0,store:{cacheGet:async()=>++reads===1?new Promise(resolve=>release=resolve):null,cacheSet:async()=>{}},translate:async text=>{calls.push(text);return '译文：'+text;}});
 try{
  const pending=t.start('bilingual',true,unit);await tick();if(insertion==='prefix')p.prepend(document.createTextNode('Updated '));else{const span=document.createElement('span');span.textContent='updated ';p.insertBefore(span,em);}release(null);await pending;
  const first=insertion==='prefix'?'Updated Original first sentence.':'Original updated first sentence.';assert.deepEqual(calls,unit==='sentence'?[first,'Original second sentence.']:[first+' Original second sentence.']);
 }finally{t.stop();}
 assert.equal(p.contains(original),true);assert.equal(p.querySelector('em'),em);assert.match(p.textContent,insertion==='prefix'?/^Updated Original first sentence/:/^Original updated first sentence/);
});

test('unrelated pending DOM edits do not restart a valid cache-waiting unit',async()=>{
 const {root}=setup('<p>Current valid sentence.</p>'),calls=[];let reads=0,release;
 const t=new ParagraphTranslator({root,interval:0,store:{cacheGet:async()=>{reads++;return new Promise(resolve=>release=resolve);},cacheSet:async()=>{}},translate:async text=>{calls.push(text);return '当前有效译文';}});
 try{const pending=t.start('bilingual',true);await tick();const aside=document.createElement('aside');aside.textContent='Unrelated page control.';root.append(aside);release(null);await pending;assert.equal(reads,1);assert.deepEqual(calls,['Current valid sentence.']);assert.equal(root.querySelectorAll('.lextide-translation').length,1);}finally{t.stop();}
 assert.equal(root.querySelector('aside').textContent,'Unrelated page control.');
});

test('host edits after rendering are reconciled before a deferred cache write starts',async()=>{
 const {root}=setup('<p>Original source sentence.</p>'),p=root.firstChild,calls=[],saved=[];let changed=false;
 const host=new window.MutationObserver(()=>{if(!changed&&root.querySelector('.lextide-translation-text')){changed=true;p.prepend(document.createTextNode('Updated '));}});host.observe(root,{subtree:true,childList:true});
 const t=new ParagraphTranslator({root,interval:0,store:{cacheGet:async()=>null,cacheSet:async text=>saved.push(text)},translate:async text=>{calls.push(text);return '译文：'+text;}});
 try{await t.start('bilingual',true);assert.equal(changed,true);assert.deepEqual(saved,['Updated Original source sentence.']);assert.deepEqual(calls,['Original source sentence.','Updated Original source sentence.']);}finally{host.disconnect();t.stop();}
 assert.equal(p.textContent,'Updated Original source sentence.');
});
