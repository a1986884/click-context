import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {build} from 'esbuild';
import {parseHTML} from 'linkedom';
const source=await readFile(new URL('../demo/app.js',import.meta.url),'utf8');
const bundle=await build({stdin:{contents:source+'\nglobalThis.__demoReader=reader;',resolveDir:process.cwd(),loader:'js'},bundle:true,format:'iife',write:false});
const tick=()=>new Promise(setImmediate);
async function fixture({fetchResponse,contextEndpoint}={}){
 const {window}=parseHTML(await readFile(new URL('../demo/index.html',import.meta.url),'utf8'));
 if(contextEndpoint){const meta=window.document.createElement('meta');meta.name='click-context-endpoint';meta.setAttribute('content',contextEndpoint);window.document.head.append(meta);const version=window.document.createElement('meta');version.name='click-context-candidate-version';version.setAttribute('content','0.7.146');window.document.head.append(version);}
 const values=new Map(),scrolls=[],focuses=[],requests=[];
 window.getSelection=()=>({isCollapsed:true,removeAllRanges(){}});
 window.Element.prototype.scrollIntoView=function(options){scrolls.push({target:this,options});};
 window.HTMLElement.prototype.focus=function(options){focuses.push({target:this,options});};
 const context=vm.createContext({window,document:window.document,localStorage:{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)},location:{href:'https://preview.example/',origin:'https://preview.example'},URL,URLSearchParams,TextEncoder,TextDecoder,AbortController,AbortSignal,DOMException,Request,Response,structuredClone,setTimeout,clearTimeout,queueMicrotask,console,fetch:async(...args)=>{requests.push(args);if(fetchResponse)return fetchResponse(...args);throw Error('Synthetic transport must not be used by this flow');}});
 vm.runInContext(bundle.outputFiles[0].text,context);const reader=context.__demoReader;await reader.ready;await tick();return {reader,window,document:window.document,scrolls,focuses,requests};
}
for(const custom of [false,true])test('demo reading navigation settles immediately and focuses article: '+(custom?'custom article':'example article'),async()=>{
 const f=await fixture();try{if(custom){f.document.querySelector('#custom-text').value='The station is closed today.';f.document.querySelector('#load-custom').click();}else f.document.querySelector('#read-start').click();await tick();
 const article=f.document.querySelector('#article');assert.equal(f.scrolls.length,1);assert.equal(f.scrolls[0].target,article);assert.notEqual(f.scrolls[0].options.behavior,'smooth');assert.equal(f.focuses.at(-1)?.target,article);assert.equal(article.tabIndex,-1);assert.equal(f.requests.length,0);}finally{f.reader.destroy();}
});
test('preview pause, article replacement and toolbar resume retain independent choices',async()=>{
 const f=await fixture();try{await f.reader.setMode('bilingual');f.reader.shadow.querySelector('.bubble').click();await tick();const select=f.document.querySelector('#article-select');for(const option of select.options)option.selected=option.value==='1';select.dispatchEvent(new f.window.Event('change'));await tick();assert.equal(f.reader.paused,true);assert.equal(f.reader.shadow.querySelector('#bilingual-enabled').checked,true);assert.equal(f.document.querySelectorAll('.lextide-translation').length,0);
 const lookup=f.document.querySelector('#demo-words');lookup.checked=true;lookup.dispatchEvent(new f.window.Event('change'));await tick();assert.equal(f.reader.paused,false);assert.equal(f.reader.preferences.words,true);assert.equal(f.reader.enabled,false);assert.equal(f.document.querySelectorAll('.lextide-translation').length,0);assert.equal(f.requests.length,0);}finally{f.reader.destroy();}
});
test('custom article category is metadata and does not initiate a dictionary request',async()=>{
 const f=await fixture();try{f.document.querySelector('#custom-text').value='The station is closed today.';f.document.querySelector('#load-custom').click();await tick();const category=f.document.querySelector('.category');f.document.caretPositionFromPoint=()=>({offsetNode:category.firstChild,offset:0});category.click();await tick();assert.equal(f.requests.length,0);assert.equal(f.reader.shadow.querySelector('.dict').hidden,true);}finally{f.reader.destroy();}
});

for(const contextEndpoint of [undefined,'https://click-context-accuracy-145.aa1986884.workers.dev/meaning'])test('preview context uses independent interpretation and its configured endpoint: '+(contextEndpoint||'default'),async()=>{
 const f=await fixture({contextEndpoint,fetchResponse:async(url,options)=>String(url).includes('/api/dictionary')?Response.json({ok:true,data:{word:'ocean',lemma:'ocean',kind:'collins',source:'Synthetic Collins fixture',senses:[{id:'ocean',lemma:'ocean',pos:'NOUN',zh:'海洋',definition:'A large body of salt water.'}]}}):Response.json({ok:true,data:{lemma:'ocean',pos:'NOUN',senseId:'ocean',zh:'海洋',method:'ai-context-v6'}})});
 try{f.document.querySelector('[data-word="ocean"]').click();await tick();await tick();await tick();const call=f.requests.find(([url])=>String(url).endsWith('/meaning'));assert.ok(call);if(contextEndpoint){assert.equal(call[0],contextEndpoint);assert.match(f.document.querySelector('footer small').textContent,/0\.7\.146/);}assert.ok(f.requests.some(([url])=>String(url).includes('/api/dictionary')));assert.equal(JSON.parse(call[1].body).senses.length,1);assert.equal(JSON.parse(call[1].body).contextRevision,'ai-context-v6');assert.equal(f.reader.shadow.querySelector('.zh').textContent,'海洋');}finally{f.reader.destroy();}
});
