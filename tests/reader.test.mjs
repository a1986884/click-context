import{test}from'node:test';import assert from'node:assert/strict';import{parseHTML}from'linkedom';import{mountReader}from'../src/reader.js';import{lookup,tokenize}from'../src/core.js';import{articles}from'../src/data.js';
function setup(){const{window}=parseHTML('<html><body><article id="article"></article></body></html>');window.getSelection=()=>({isCollapsed:true});globalThis.window=window;globalThis.document=window.document;globalThis.localStorage={getItem:()=>null,setItem(){}};return document.querySelector('article');}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('every word can be clicked and resolved through the shared reader',async()=>{const root=setup();for(const a of articles)for(const t of tokenize([a.title,...a.paragraphs.map(p=>p[0])].join(' ')).filter(t=>t.word)){const span=document.createElement('span');span.dataset.word=t.text;span.textContent=t.text;root.append(span);}const reader=mountReader({root,demo:true});await reader.setEnabled(true);reader.shadow.querySelector('#words').checked=true;for(const span of root.children){span.dispatchEvent(new window.Event('click',{bubbles:true}));await tick();assert.equal(reader.shadow.querySelector('.word').textContent,(await lookup(span.textContent)).word);assert.equal(reader.shadow.querySelector('.zh').textContent,(await lookup(span.textContent)).zh);}reader.destroy();assert.equal(document.querySelector('lextide-reader'),null);});
test('bilingual insert and restore leaves original paragraph intact',async()=>{const root=setup();root.innerHTML='<p class="english" data-translation="海洋">The ocean.</p>';const original=root.firstChild;const reader=mountReader({root,demo:true});await reader.bilingual();assert.equal(root.querySelector('.lextide-translation p').textContent,'海洋');reader.restore();assert.equal(root.firstChild,original);assert.equal(root.children.length,1);reader.destroy();});
test('enabling bilingual translation sends custom text without a separate networking switch',async()=>{const root=setup();root.innerHTML='<p class="english">Private article.</p>';let calls=0;const reader=mountReader({root,demo:true,transport:async()=>{calls++;return '译文';}});await reader.bilingual();assert.equal(calls,1);assert.equal(reader.shadow.querySelector('#online'),null);reader.destroy();});
test('last click wins and close invalidates pending lookup',async()=>{const root=setup();const tasks=[];const reader=mountReader({root,transport:()=>new Promise(resolve=>tasks.push(resolve))});await reader.ready;const first=reader.show('first');await tick();const second=reader.show('second');await tick();tasks[1]({zh:'第二',source:'test'});await second;tasks[0]({zh:'第一',source:'test'});await first;assert.equal(reader.shadow.querySelector('.zh').textContent,'第二');const third=reader.show('third');await tick();reader.shadow.querySelector('.dict .close').click();tasks[2]({zh:'第三'});await third;assert.equal(reader.shadow.querySelector('.dict').hidden,true);reader.destroy();});
test('translation cancellation does not leave stale nodes',async()=>{const root=setup();root.innerHTML='<p class="english">The ocean.</p>';let done;const reader=mountReader({root,demo:true,transport:()=>new Promise(resolve=>done=resolve)});await allowOnline(reader);const pending=reader.bilingual();await tick();reader.restore();done('海洋');await pending;assert.equal(root.querySelector('.lextide-translation'),null);reader.destroy();});
test('API text renders as text, never HTML',async()=>{const root=setup();const reader=mountReader({root,transport:async()=>({zh:'<img src=x onerror=alert(1)>',definitions:['<script>evil()</script>']})});await reader.show('test');assert.equal(reader.shadow.querySelector('.zh img'),null);assert.match(reader.shadow.querySelector('.zh').textContent,/<img/);reader.destroy();});

async function allowOnline(reader){await reader.ready;}
function pointer(target,type,props={}){const e=new window.Event(type,{bubbles:true,cancelable:true});Object.assign(e,{button:0,pointerId:1,clientX:20,clientY:20,...props});target.dispatchEvent(e);}
test('main bubble pauses both features, keeps paused settings and restores the chosen combination',async()=>{
 const root=setup();root.innerHTML='<p class="english" data-translation="海洋"><span data-word="ocean" tabindex="0">ocean</span></p>';
 const reader=mountReader({root,demo:true}),bubble=reader.shadow.querySelector('.bubble'),translation=reader.shadow.querySelector('#bilingual-enabled'),word=root.querySelector('span');
 try{
  await reader.ready;word.click();await tick();assert.equal(reader.shadow.querySelector('.dict').hidden,false);
  bubble.click();await tick();assert.equal(reader.preferences.words,false);assert.equal(bubble.getAttribute('aria-pressed'),'false');assert.equal(reader.shadow.querySelector('.dict').hidden,true);assert.equal(reader.enabled,false);
  translation.checked=true;translation.dispatchEvent(new window.Event('change'));await tick();assert.equal(root.querySelector('.lextide-translation'),null);assert.equal(reader.preferences.words,false);assert.equal(translation.checked,true);
  bubble.click();await tick();assert.equal(reader.preferences.words,true);assert.equal(reader.enabled,true);assert.ok(root.querySelector('.lextide-translation'));word.click();await tick();assert.equal(reader.shadow.querySelector('.zh').textContent,'海洋');
  translation.checked=false;translation.dispatchEvent(new window.Event('change'));await tick();assert.equal(root.querySelector('.lextide-translation'),null);assert.equal(reader.preferences.words,true);assert.equal(reader.shadow.querySelector('.dict').hidden,false);
 }finally{reader.destroy();}
});

test('long press opens settings without toggling, including the following release click',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const root=setup();const reader=mountReader({root,demo:true});const bubble=reader.shadow.querySelector('.bubble');
 pointer(bubble,'pointerdown');t.mock.timers.tick(549);assert.equal(reader.shadow.querySelector('.panel').hidden,true);
 t.mock.timers.tick(1);assert.equal(reader.shadow.querySelector('.panel').hidden,false);assert.equal(reader.enabled,false);
 pointer(bubble,'pointerup');bubble.click();assert.equal(reader.enabled,false);
 pointer(bubble,'pointerdown');pointer(bubble,'pointerup');bubble.click();await tick();assert.equal(reader.preferences.words,false);
 pointer(bubble,'pointerdown');t.mock.timers.tick(550);pointer(bubble,'pointerup');bubble.click();assert.equal(reader.preferences.words,false);assert.equal(reader.shadow.querySelector('.panel').hidden,false);reader.destroy();
});
test('cancel, movement and destruction cancel pending long presses',t=>{
 t.mock.timers.enable({apis:['setTimeout']});const root=setup();const reader=mountReader({root,demo:true});const bubble=reader.shadow.querySelector('.bubble');
 pointer(bubble,'pointerdown');pointer(bubble,'pointercancel');t.mock.timers.tick(600);bubble.click();assert.equal(reader.shadow.querySelector('.panel').hidden,true);assert.equal(reader.enabled,false);
 pointer(bubble,'pointerdown');pointer(bubble,'pointermove',{clientX:50});t.mock.timers.tick(600);pointer(bubble,'pointerup');bubble.click();assert.equal(reader.shadow.querySelector('.panel').hidden,true);assert.equal(reader.enabled,false);
 pointer(bubble,'pointerdown');reader.destroy();t.mock.timers.tick(600);assert.equal(document.querySelector('lextide-reader'),null);
});
test('turning off translation discards its late response without cancelling independent lookup',async()=>{
 const root=setup();root.innerHTML='<p class="english"><span data-word="ocean">ocean</span></p>';const tasks={};
 const reader=mountReader({root,demo:true,transport:type=>new Promise(resolve=>tasks[type]=resolve)});await allowOnline(reader);
 const pending=reader.setEnabled(true);await tick();root.querySelector('span').click();await tick();await reader.setEnabled(false);tasks.translate('海洋');tasks.lookup({zh:'海洋'});await pending;await tick();assert.equal(root.querySelector('.lextide-translation'),null);assert.equal(reader.shadow.querySelector('.dict').hidden,false);assert.equal(reader.preferences.words,true);assert.equal(reader.enabled,false);reader.destroy();
});
test('translation is off initially and the settings switch enables direct networking, then restores original',async()=>{
 const root=setup();root.innerHTML='<p>Some English.</p>';let calls=0;const reader=mountReader({root,transport:async()=>{calls++;return '中文';}});await reader.ready;assert.equal(calls,0);assert.equal(reader.shadow.querySelector('#online'),null);assert.equal(reader.shadow.querySelector('#bilingual-toggle'),null);
 await reader.setBilingual(true);assert.equal(calls,1);assert.equal(root.querySelector('.lextide-translation p').textContent,'中文');await reader.setBilingual(false);assert.equal(root.querySelector('.lextide-translation'),null);assert.equal(reader.preferences.words,true);reader.destroy();
});
test('main shutdown cancels pending translation and prevents late Chinese from returning',async()=>{
 const root=setup();root.innerHTML='<p class="english">A paragraph still being translated.</p>';let finish,signal;
 const reader=mountReader({root,demo:true,transport:async(type,text,online,options)=>{signal=options.signal;return await new Promise(resolve=>finish=resolve);}});await reader.ready;
 const translating=reader.bilingual();await tick();reader.shadow.querySelector('.bubble').click();await tick();assert.equal(reader.preferences.words,false);assert.equal(reader.enabled,false);assert.ok(signal.aborted);assert.equal(root.querySelector('.lextide-translation'),null);
 finish('迟到的中文译文');await translating;await tick();assert.equal(root.querySelector('.lextide-translation'),null);
 reader.shadow.querySelector('.bubble').click();await tick();assert.equal(reader.preferences.words,true);assert.equal(reader.enabled,true);reader.shadow.querySelector('.bubble').click();await tick();assert.equal(reader.enabled,false);assert.ok(signal.aborted);reader.destroy();
});

test('dictionary failure does not block independent context and preserves its real source error',async()=>{
 const root=setup(),calls=[];const reader=mountReader({root,transport:async(type,word,online,options)=>{calls.push(type);if(type==='lookup')throw Object.assign(Error('Collins 来源拒绝（HTTP 403）'),{code:'COLLINS_ACCESS_DENIED',sourceUrls:['https://dict.youdao.com/w/eng/class/']});assert.deepEqual(options.context.senses,[]);return {senseId:null,zh:'课程'};}});
 await reader.show('class',root,'This class is taught here.',5);assert.deepEqual(calls,['lookup','context']);assert.equal(reader.shadow.querySelector('.zh').textContent,'课程');assert.match(reader.shadow.querySelector('.dictionary-label').textContent,/AI/);assert.match(reader.shadow.querySelector('.defs').textContent,/HTTP 403/);assert.equal(reader.shadow.querySelector('.source a').href,'https://dict.youdao.com/w/eng/class/');reader.destroy();
});
test('missing sentence, invalid words and denied networking do not trigger context fallback',async()=>{
 for(const [word,sentence,code]of [['class','','COLLINS_ACCESS_DENIED'],['class','This class is here.','ONLINE_REQUIRED'],['class','This class is here.','INVALID_WORD'],['---','This --- is here.','COLLINS_UNAVAILABLE']]){
  const root=setup(),calls=[];const reader=mountReader({root,transport:async type=>{calls.push(type);throw Object.assign(Error('Synthetic failure'),{code});}});await reader.show(word,root,sentence,5);assert.deepEqual(calls,['lookup']);reader.destroy();
 }
});
test('closed failed lookup cannot start context from a late dictionary rejection',async()=>{
 const root=setup(),calls=[];let reject;const reader=mountReader({root,transport:async type=>{calls.push(type);return new Promise((_resolve,r)=>reject=r);}});const pending=reader.show('class',root,'This class is here.',5);await tick();reader.shadow.querySelector('.dict .close').click();reject(Error('Late source failure'));await pending;assert.deepEqual(calls,['lookup']);assert.equal(reader.shadow.querySelector('.dict').hidden,true);reader.destroy();
});
test('context after dictionary failure cannot overwrite a newer word or reopen a closed card',async()=>{
 for(const action of ['new-word','close']){
  const root=setup();let finish,signal;const reader=mountReader({root,transport:async(type,word,_online,options)=>{if(type==='lookup'){if(word==='bank')return {word,zh:'银行',kind:'collins'};throw Error('Source unavailable');}signal=options.signal;return new Promise(resolve=>finish=resolve);}});
  const pending=reader.show('class',root,'This class is here.',5);await tick();if(action==='close')reader.shadow.querySelector('.dict .close').click();else await reader.show('bank',root);assert.ok(signal.aborted);finish({senseId:null,zh:'迟到课程'});await pending;if(action==='close')assert.equal(reader.shadow.querySelector('.dict').hidden,true);else assert.equal(reader.shadow.querySelector('.zh').textContent,'银行');reader.destroy();
 }
});

test('repeating the same pending occurrence does not cancel or restart dictionary and context requests',async()=>{
 const root=setup();let finishLookup,finishContext,lookupSignal,contextSignal;const calls=[];const reader=mountReader({root,transport:async(type,_word,_online,{signal})=>{calls.push(type);if(type==='lookup'){lookupSignal=signal;return new Promise(resolve=>finishLookup=resolve);}contextSignal=signal;return new Promise(resolve=>finishContext=resolve);}});
 try{const a=reader.show('class',root,'This class is here.',5);await tick();const b=reader.show('class',root,'This class is here.',5);await tick();assert.deepEqual(calls,['lookup']);assert.equal(lookupSignal.aborted,false);finishLookup({word:'class',kind:'collins',senses:[{id:'course',zh:'课程',definition:'A course.'}]});await tick();const c=reader.show('class',root,'This class is here.',5);await tick();assert.deepEqual(calls,['lookup','context']);assert.equal(contextSignal.aborted,false);finishContext({senseId:'course',zh:'课程'});await Promise.all([a,b,c]);assert.equal(reader.shadow.querySelector('.zh').textContent,'课程');}finally{reader.destroy();}
});
test('different targets, sentences and occurrences keep independent lookup cancellation',async()=>{
 for(const variant of ['target','sentence','offset']){
  const root=setup(),other=document.createElement('b');root.append(other);const jobs=[];const reader=mountReader({root,transport:async(_type,_word,_online,{signal})=>new Promise(resolve=>jobs.push({signal,resolve}))});
  const a=reader.show('class',root,'The class and the class are here.',4);await tick();const b=reader.show('class',variant==='target'?other:root,variant==='sentence'?'This class is here.':'The class and the class are here.',variant==='offset'?18:variant==='sentence'?5:4);await tick();assert.equal(jobs.length,2);assert.equal(jobs[0].signal.aborted,true);assert.equal(jobs[1].signal.aborted,false);jobs[1].resolve({word:'class',zh:'新课程'});jobs[0].resolve({word:'class',zh:'旧课程'});await Promise.all([a,b]);assert.equal(reader.shadow.querySelector('.zh').textContent,'新课程');reader.destroy();
 }
});
test('failure retry starts fresh even while favorite status is still being read',async()=>{
 const root=setup(),reads=[],calls=[];const store={prefs:async()=>({words:true,enabled:false,mode:'original'}),savePrefs:async()=>{},words:()=>new Promise(resolve=>reads.push(resolve))};const reader=mountReader({root,store,transport:async type=>{calls.push(type);if(type==='lookup')return {word:'class',kind:'unavailable',senses:[]};throw Error('Context unavailable');}});
 const a=reader.show('class',root,'This class is here.',5);await tick();assert.equal(reader.shadow.querySelector('#retry').hidden,false);reader.shadow.querySelector('#retry').click();await tick();assert.deepEqual(calls,['lookup','context','lookup','context']);for(const finish of reads)finish([]);await a;await tick();reader.destroy();
});
test('closing a shared pending lookup cancels once and reopening starts fresh',async()=>{
 const root=setup(),jobs=[];let aborts=0;const reader=mountReader({root,transport:async(_type,_word,_online,{signal})=>{signal.addEventListener('abort',()=>aborts++);return new Promise(resolve=>jobs.push(resolve));}});const a=reader.show('class',root);await tick();const b=reader.show('class',root);await tick();assert.equal(jobs.length,1);reader.shadow.querySelector('.dict .close').click();assert.equal(aborts,1);const c=reader.show('class',root);await tick();assert.equal(jobs.length,2);jobs[0]({word:'class',zh:'迟到旧义'});jobs[1]({word:'class',zh:'课程'});await Promise.all([a,b,c]);assert.equal(reader.shadow.querySelector('.zh').textContent,'课程');reader.destroy();
});

test('sentence highlights only the selected occurrence and retains its exact text, with a safe fallback',async()=>{
 const root=setup(),reader=mountReader({root,transport:async()=>({word:'bank',zh:'河岸',definitions:['land beside a river']})});
 try{
  const sentence='The bank near the bank is quiet.';
  await reader.show('bank',root,sentence,18);
  const el=reader.shadow.querySelector('.sentence');
  assert.equal(el.textContent,'当前句子：'+sentence);
  assert.equal(el.querySelectorAll('mark').length,1);
  assert.equal(el.querySelector('mark').textContent,'bank');
  assert.equal(el.querySelector('mark').previousSibling.textContent,'The bank near the ');
  await reader.show('bank',root,sentence,3);
  assert.equal(el.textContent,'当前句子：'+sentence);
  assert.equal(el.querySelector('mark'),null);
 }finally{reader.destroy();}
});
