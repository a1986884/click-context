import {TRANSLATION_CACHE_VERSION} from '../src/translation-service.js';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {ParagraphTranslator} from '../src/translation.js';
import {createStore} from '../src/storage.js';
import {mountReader} from '../src/reader.js';
import {dictionaryBounds,visibleViewport,movableBounds} from '../src/viewport.js';
import {createTranslationProvider,jsonFetch} from '../src/providers.js';
import {getExtensionAPI} from '../src/browser-api.js';
import {translate} from '../src/core.js';
const tick=()=>new Promise(setImmediate);
function setup(){const {window}=parseHTML('<html><body><main><p>Researchers are stu<strong>dy</strong>ing the ocean.</p></main></body></html>');globalThis.window=window;globalThis.document=window.document;window.getSelection=()=>({isCollapsed:true});const values={};return {root:document.querySelector('main'),store:createStore({get:async k=>values[k],set:async(k,v)=>{values[k]=v;}})};}
test('stopping during a scheduled mutation scan does not disable later SPA scans',async()=>{const {root,store}=setup();const t=new ParagraphTranslator({root,store,interval:0,translate:async()=> '译文'});await t.start('bilingual',true);root.append(document.createElement('p'));await tick();assert.ok(t.scanTimer);await t.start('bilingual',true);const p=document.createElement('p');p.textContent='New visible paragraph after restart.';root.append(p);await new Promise(r=>setTimeout(r,230));assert.equal(p.nextElementSibling?.className,'lextide-translation');t.stop();});
test('extension offline cache miss does not change article DOM or call any provider',async()=>{const {root,store}=setup();const before=root.innerHTML;let calls=0,status='';const t=new ParagraphTranslator({root,store,quietOffline:true,report:s=>status=s,translate:async()=>{calls++;}});await t.start('bilingual',false);assert.equal(calls,0);assert.equal(root.innerHTML,before);assert.match(status,/等待联网授权/);t.stop();});
test('extension offline cache hit renders and repeated disable restores node identity',async()=>{const {root,store}=setup();const p=root.querySelector('p');await store.cacheSet(p.textContent.trim(),'缓存译文');const t=new ParagraphTranslator({root,store,quietOffline:true,translate:async()=>{throw Error('Network forbidden');}});for(let n=0;n<3;n++){await t.start('translated',false);assert.equal(p.hidden,true);assert.match(root.textContent,/缓存译文/);t.stop();assert.equal(root.querySelector('p'),p);assert.equal(p.hidden,false);assert.equal(root.querySelector('.lextide-translation'),null);}});
test('late failure of removed paragraph cannot reinsert an error node',async()=>{const {root,store}=setup();let reject;const t=new ParagraphTranslator({root,store,interval:0,translate:()=>new Promise((_,r)=>reject=r)});const pending=t.start('bilingual',true);await tick();const p=root.querySelector('p');p.remove();t.refresh();reject(Error('late outage'));await pending;assert.equal(root.querySelector('.lextide-translation'),null);t.stop();});
test('all plain and nested article tokens initiate lookup without predefined spans',async()=>{const {root,store}=setup();root.querySelector('p').innerHTML='Every, ordinary <em>English</em> token: unlistedwords and researchers!';const p=root.querySelector('p');const calls=[];const r=mountReader({root,store,promptOnline:false,transport:async(type,word)=>{calls.push([type,word]);throw Error('暂无可靠结果');}});await r.ready;for(const n of [p.firstChild,p.querySelector('em').firstChild,p.lastChild]){for(const m of n.textContent.matchAll(/[A-Za-z]+/g)){document.caretPositionFromPoint=()=>({offsetNode:n,offset:m.index});const e=new window.Event('click',{bubbles:true});Object.assign(e,{clientX:1,clientY:1});n.parentElement.dispatchEvent(e);await tick();}}assert.deepEqual(calls,['Every','ordinary','English','token','unlistedwords','and','researchers'].flatMap(word=>[['lookup',word],['context',word]]));r.destroy();});
test('touch scrolling or cancellation suppresses the following synthetic word click',async()=>{const {root,store}=setup();let calls=0;const r=mountReader({root,store,transport:async()=>{calls++;return {};}});await r.ready;const strong=root.querySelector('strong');document.caretPositionFromPoint=()=>({offsetNode:strong.firstChild,offset:1});function event(type,x=0){const e=new window.Event(type,{bubbles:true});Object.assign(e,{pointerType:'touch',pointerId:7,clientX:x,clientY:10,detail:1});strong.dispatchEvent(e);}event('pointerdown');event('pointermove',40);event('pointerup',40);event('click',40);await tick();assert.equal(calls,0);r.destroy();});
test('dictionary bounds fit narrow, zoomed, offset and resized visible viewports',()=>{for(const view of [{left:0,top:0,width:320,height:568},{left:80,top:140,width:195,height:320},{left:0,top:0,width:375,height:220}])for(const y of [view.top+5,view.top+view.height-5]){const b=dictionaryBounds(view,view.left+view.width-3,y,460);assert.ok(b.left>=view.left&&b.top>=view.top);assert.ok(b.left+b.width<=view.left+view.width);assert.ok(b.top+b.maxHeight<=view.top+view.height);}assert.deepEqual(visibleViewport({innerWidth:800,innerHeight:600,visualViewport:{width:320,height:200,offsetLeft:20,offsetTop:30}}),{width:320,height:200,left:20,top:30});});
test('provider can be substituted without credentials or changing the reader contract',async()=>{const requests=[];const p=createTranslationProvider({request:async(url,fetcher,options)=>{requests.push({url,options});return {ok:true,data:{text:'替换服务响应',version:TRANSLATION_CACHE_VERSION}};}});assert.equal(await p.translate('Reliable plain text.'),'替换服务响应');assert.equal(p.id,'cloudflare-ai');assert.equal(requests.length,1);assert.match(requests[0].url,/\/translate$/);assert.equal(requests[0].options.method,'POST');assert.deepEqual(JSON.parse(requests[0].options.body),{text:'Reliable plain text.',translationRevision:TRANSLATION_CACHE_VERSION});});
test('cancellation stays effective while reading a delayed JSON response body',async()=>{const c=new AbortController();let finish;const promise=jsonFetch('https://provider.test/',async()=>({ok:true,json:()=>new Promise(r=>finish=r)}),{signal:c.signal});await tick();c.abort();finish({value:'stale'});await assert.rejects(promise);});
test('HTTP quota rejection is not retried and omits cookies and referrer',async()=>{let options;await assert.rejects(jsonFetch('https://provider.test/',async(url,o)=>{options=o;return {ok:false,status:429};}),e=>e.retryable===false&&e.code==='RATE_LIMITED');assert.equal(options.credentials,'omit');assert.equal(options.referrerPolicy,'no-referrer');});
test('body timeout rejects even when a substituted fetcher ignores abort',async()=>{await assert.rejects(jsonFetch('https://provider.test/',async()=>({ok:true,json:()=>new Promise(()=>{})}),{timeoutMs:10}),e=>e.retryable===true&&/超时/.test(e.message));});
test('translation entry accepts an alternative provider without calling the default service',async()=>{const c=new AbortController();assert.equal(await translate('Article text',()=>{throw Error('Unexpected network');},{signal:c.signal,provider:{translate:async(text,{signal})=>{assert.equal(signal,c.signal);return 'Provider: '+text;}}}),'Provider: Article text');});
test('browser API adapter accepts Safari browser namespace and Chrome namespace',()=>{const browser={runtime:{id:'safari'}},chrome={runtime:{id:'chromium'}};assert.equal(getExtensionAPI({browser,chrome}),browser);assert.equal(getExtensionAPI({chrome}),chrome);assert.throws(()=>getExtensionAPI({}),/API 不可用/);});
test('demo word buttons support mouse lookup while host website buttons stay excluded',async()=>{
 for(const demo of [true,false]){
  const {root,store}=setup();root.querySelector('p').innerHTML='<span role="button" tabindex="0" data-word="ocean">ocean</span><button data-word="study">study</button>';
  const calls=[];const reader=mountReader({root,store,demo,transport:async(type,word)=>{calls.push(word);return {word,zh:'海洋'};}});await reader.ready;
  root.querySelector('span').dispatchEvent(new window.Event('click',{bubbles:true}));await tick();
  root.querySelector('button').dispatchEvent(new window.Event('click',{bubbles:true}));await tick();
  assert.deepEqual(calls,demo?['ocean']:[]);reader.destroy();
 }
});
test('legacy offline preferences migrate to direct lookup without a permission prompt',async()=>{
 const {root,store}=setup();await store.savePrefs({online:false});let calls=0;
 const reader=mountReader({root,store,transport:async(type,word,online)=>{calls++;assert.equal(online,true);return {word,zh:'词义'};}});await reader.show('unlistedword',root.querySelector('p'));
 assert.equal(calls,1);assert.equal(reader.preferences.online,true);assert.equal(reader.shadow.querySelector('#online'),null);assert.equal(reader.shadow.querySelector('#lookup-online'),null);reader.destroy();
});
test('dragged cards clamp to visible viewport edges including zoom offsets',()=>{
 for(const view of [{left:0,top:0,width:1280,height:900},{left:80,top:140,width:195,height:320}]){
  const width=Math.min(352,view.width-24),height=Math.min(440,view.height-24);
  for(const [x,y] of [[-1000,-1000],[9999,9999],[100,200]]){
   const r=movableBounds(view,x,y,width,height);
   assert.ok(r.left>=view.left+12&&r.top>=view.top+12);
   assert.ok(r.left+width<=view.left+view.width-12&&r.top+height<=view.top+view.height-12);
  }
 }
});
