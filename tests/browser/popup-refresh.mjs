// Actual packaged popup HTML/JS with delayed Chrome API/close fixtures; no installation.
import {chromium} from 'playwright';import {createServer} from 'node:http';import {readFile,mkdir,writeFile} from 'node:fs/promises';import {resolve,extname} from 'node:path';import assert from 'node:assert/strict';
import {sourceState,extensionFingerprint} from '../../scripts/build-evidence.mjs';
const root=resolve('build/extension'),pkg=JSON.parse(await readFile('package.json')),testedFingerprint=await extensionFingerprint(root);
const server=createServer(async(req,res)=>{try{const file=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!file.startsWith(root+'/'))throw Error('Invalid path');const body=await readFile(file);res.writeHead(200,{'Content-Type':{'.js':'application/javascript','.html':'text/html','.css':'text/css','.png':'image/png'}[extname(file)]||'application/octet-stream'});res.end(body);}catch{res.writeHead(404);res.end();}}).listen(0,'127.0.0.1');await new Promise(r=>server.on('listening',r));
const origin='http://127.0.0.1:'+server.address().port;
await mkdir('test-results',{recursive:true});const report={kind:'packaged popup event/control races; Chrome API and window.close fixtures',nativeExtensionInstalled:false,version:pkg.version,source:sourceState(),extensionFingerprint:testedFingerprint,status:'failed',checks:[]};let browser;
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||'/usr/bin/chromium'});
 const unrelated=['dict:anonymous:bank','dict:lru','v2:translation-cache:v3:0','v2:words'];
 const permissionScenarios=['remember','enable'].flatMap(flow=>['current','new-tab','pending-tab'].flatMap(state=>(state==='pending-tab'?['grant']:['grant','deny','reject']).map(outcome=>'permission:'+flow+':'+state+':'+outcome)));
 const permissionIntentScenarios=['remember','enable'].flatMap(flow=>['withdraw','replace'].flatMap(kind=>['grant','deny','reject'].map(outcome=>'permission-intent:'+flow+':'+kind+':'+outcome)));
 const navigationScenarios=['url','loading','complete','background','irrelevant','pending-first','pending-activated','busy-success','busy-failure',...['remember','enable'].flatMap(flow=>['grant','deny','reject'].map(outcome=>'permission-'+flow+'-'+outcome))].map(kind=>'navigation:'+kind);
 const targetPendingScenarios=['initial','activation','navigation','query-failure','get-failure','busy-success','busy-failure','storage'].map(kind=>'target-pending:'+kind);
 const controlTargetScenarios=['activation-success','navigation-success','reload-success','activation-failure','navigation-failure','path-failure','current-failure','current-success'].map(kind=>'control-target:'+kind);
 const settingsResultScenarios=['initial-rejected','busy-rejected','target-rejected','current-success','storage-success','current-failure','activation-success','navigation-success','activation-failure','navigation-failure'].map(kind=>'settings-result:'+kind);
 const wrongAreaScenarios=['v3:policy','v3:tabs','v2:prefs'].flatMap(key=>['local','session','sync','managed','missing'].filter(area=>area!==(key==='v3:tabs'?'session':'local')).flatMap(area=>['idle','busy'].map(mode=>mode+'-wrong-area:'+area+':'+key)));
 const tabGrantScenarios=[...['other-update','other-add','other-delete','absent-current','current-update','current-add','current-delete','missing-old','map-delete','malformed'].flatMap(kind=>['idle','busy'].map(mode=>'tab-grant:'+mode+':'+kind)),...['initial-pending','activation-pending','refresh-error','busy-failure'].map(kind=>'tab-grant:'+kind)];
 const policyScenarios=[...['other-update','other-add','other-delete','absent-current','current-update','current-add','current-delete','global-pause','global-collins-session','future-global','missing-old','malformed','schema-other'].flatMap(kind=>['idle','busy'].map(mode=>'policy-scope:'+mode+':'+kind)),...['initial-pending','activation-pending','refresh-error','busy-failure','missing-url','unsupported-url','mixed-prefs'].map(kind=>'policy-scope:'+kind)];
 for(const scenario of [...policyScenarios,...tabGrantScenarios,...wrongAreaScenarios,...settingsResultScenarios,...controlTargetScenarios,...targetPendingScenarios,...navigationScenarios,...permissionIntentScenarios,...permissionScenarios,'stale-query-target','stale-get-error','current-error-recovery','busy-storage-change','busy-control-failure','superseded-control-error','superseded-control-cleanup',...unrelated.flatMap(key=>['idle-unrelated:'+key,'busy-unrelated:'+key]),...['v3:policy','v3:tabs','v2:prefs'].map(key=>'related:'+key)]){
  const context=await browser.newContext(),errors=[];let result={scenario,status:'failed'};
  try{
   await context.addInitScript(version=>{
    const event=()=>({listeners:[],addListener(fn){this.listeners.push(fn);},fire(...args){for(const fn of this.listeners)fn(...args);}});
    globalThis.__closeCalls=0;globalThis.close=()=>{__closeCalls++;};globalThis.__permissions=[];globalThis.__holdPermissions=false;globalThis.__queries=[];globalThis.__gets=[];globalThis.__messages=[];globalThis.__controls=[];globalThis.__holdControls=false;globalThis.__updated=event();globalThis.__activation=event();globalThis.__storage=event();
    globalThis.__snapshot=(id,prefs={})=>({supported:true,running:true,hostname:'tab-'+id,pattern:'https://tab-'+id+'.test/*',prefs:{enabled:false,mode:'original',words:true,...prefs}});
    globalThis.chrome={runtime:{id:'test-extension',getManifest:()=>({version}),getURL:p=>'chrome-extension://test-extension/'+p,sendMessage:async m=>{__messages.push(m);if(m.action==='get')return new Promise((resolve,reject)=>__gets.push({message:m,resolve,reject}));if(__holdControls)return new Promise((resolve,reject)=>__controls.push({message:m,resolve,reject}));return {ok:true,data:__snapshot(m.tabId,m.prefs)};}},tabs:{query:()=>new Promise((resolve,reject)=>__queries.push({resolve,reject})),onUpdated:__updated,onActivated:__activation,create:async()=>{}},storage:{onChanged:__storage},permissions:{request:async message=>{if(__holdPermissions)return new Promise((resolve,reject)=>__permissions.push({message,resolve,reject}));return true;}}};
   },pkg.version);
   const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(5000);await page.goto(origin+'/popup.html',{waitUntil:'commit'});await page.waitForFunction(()=>__queries.length===1);
   if(scenario.startsWith('tab-grant:')||scenario.startsWith('policy-scope:')){
    const policy=scenario.startsWith('policy-scope:'),kind=scenario.slice(policy?'policy-scope:'.length:'tab-grant:'.length),initial=kind==='initial-pending',activation=kind==='activation-pending',failed=kind==='refresh-error',controlFailure=kind==='busy-failure',unsupported=policy&&kind==='unsupported-url',uncertain=policy&&['missing-url','unsupported-url','mixed-prefs'].includes(kind),busy=kind.startsWith('busy:')||controlFailure,mode=kind.includes(':')?kind.split(':')[1]:'other-update';
    if(!initial){await page.evaluate(({missing,unsupported})=>__queries[0].resolve([{id:22,...(missing?{}:{url:unsupported?'chrome://settings/':'https://tab-22.test/article'})}]),{missing:policy&&kind==='missing-url',unsupported});await page.waitForFunction(()=>__gets.length===1);await page.evaluate(unsupported=>__gets[0].resolve({ok:true,data:{...__snapshot(22),...(unsupported?{supported:false,running:false}:{})}}),unsupported);await page.locator('#site').filter({hasText:'tab-22'}).waitFor();}
    if(activation){await page.evaluate(()=>__activation.fire());await page.waitForFunction(()=>__queries.length===2);}
    if(failed){await page.evaluate(()=>__storage.fire({'v3:policy':{newValue:{}}},'local'));await page.waitForFunction(()=>__queries.length===2);await page.evaluate(()=>__queries[1].resolve([{id:22}]));await page.waitForFunction(()=>__gets.length===2);await page.evaluate(()=>__gets[1].reject(Error('State read failed')));await page.locator('#error').filter({hasText:'State read failed'}).waitFor();}
    if(busy){await page.evaluate(()=>__holdControls=true);await page.locator('#words').uncheck();await page.waitForFunction(()=>__controls.length===1);}
    const baseline=await page.evaluate(()=>({queries:__queries.length,gets:__gets.length}));
    await page.evaluate(({mode,policy,mixed})=>{
     if(policy){
      const origin='https://tab-22.test',otherOrigin='https://tab-33.test',current={allowed:true,prefs:{words:true}},other={allowed:true};
      let oldValue={schema:3,paused:false,collinsSession:false,sites:{[origin]:current,[otherOrigin]:other}},newValue={...oldValue,sites:{[origin]:current,[otherOrigin]:{...other,excluded:true}}};
      if(mode==='other-add'){oldValue={...oldValue,sites:{[origin]:current}};newValue={...oldValue,sites:{[origin]:current,[otherOrigin]:other}};}
      if(mode==='other-delete')newValue={...oldValue,sites:{[origin]:current}};
      if(mode==='absent-current'){oldValue={...oldValue,sites:{[otherOrigin]:other}};newValue={...oldValue,sites:{[otherOrigin]:{...other,excluded:true}}};}
      if(mode==='current-update')newValue={...oldValue,sites:{[origin]:{...current,prefs:{words:false}},[otherOrigin]:other}};
      if(mode==='current-add'){oldValue={...oldValue,sites:{[otherOrigin]:other}};newValue={...oldValue,sites:{[origin]:current,[otherOrigin]:other}};}
      if(mode==='current-delete')newValue={...oldValue,sites:{[otherOrigin]:other}};
      if(mode==='global-pause')newValue={...oldValue,paused:true};
      if(mode==='global-collins-session')newValue={...oldValue,collinsSession:true};
      if(mode==='future-global'){oldValue={...oldValue,futureGlobal:{value:1}};newValue={...oldValue,futureGlobal:{value:2}};}
      if(mode==='schema-other'){oldValue={...oldValue,schema:4};newValue={...newValue,schema:4};}
      const change=mode==='missing-old'?{newValue}:{oldValue,newValue:mode==='malformed'?{...newValue,sites:null}:newValue};
      __storage.fire({'v3:policy':change,...(mixed?{'v2:prefs':{newValue:{words:false}}}:{})},'local');return;
     }
     const current={origin:'https://tab-22.test',allowed:true,prefs:{words:true}},other={origin:'https://tab-33.test',allowed:true};
     let oldValue={22:current,33:other},newValue={22:current,33:{...other,allowed:false}};
     if(mode==='other-add'){oldValue={22:current};newValue={22:current,33:other};}
     if(mode==='other-delete')newValue={22:current};
     if(mode==='absent-current'){oldValue={33:other};newValue={33:{...other,allowed:false}};}
     if(mode==='current-update')newValue={22:{...current,prefs:{words:false}},33:other};
     if(mode==='current-add'){oldValue={33:other};newValue={22:current,33:other};}
     if(mode==='current-delete')newValue={33:other};
     const change=mode==='missing-old'?{newValue}:mode==='map-delete'?{oldValue}:{oldValue,newValue:mode==='malformed'?null:newValue};
     __storage.fire({'v3:tabs':change},'session');
    },{mode,policy,mixed:policy&&kind==='mixed-prefs'});
    await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    const unrelated=['other-update','other-add','other-delete','absent-current'].includes(mode)&&!initial&&!activation&&!failed&&!controlFailure&&!uncertain;
    if(busy){assert.equal(await page.evaluate(()=>__queries.length),baseline.queries,'Busy state changes wait for control completion');await page.evaluate(fail=>fail?__controls[0].reject(Error('Control failed')):__controls[0].resolve({ok:true,data:__snapshot(22,{words:false})}),controlFailure);if(!controlFailure)await page.waitForFunction(()=>!document.getElementById('controls').disabled);}
    if(!unrelated){
     await page.waitForFunction(expected=>__queries.length===expected,baseline.queries+1);const queryIndex=baseline.queries,getIndex=baseline.gets,id=activation?33:22;
     await page.evaluate(({queryIndex,id,unsupported})=>__queries[queryIndex].resolve([{id,url:unsupported?'chrome://settings/':'https://tab-'+id+'.test/article'}]),{queryIndex,id,unsupported});await page.waitForFunction(expected=>__gets.length===expected,baseline.gets+1);await page.evaluate(({getIndex,id,unsupported})=>__gets[getIndex].resolve({ok:true,data:{...__snapshot(id),...(unsupported?{supported:false,running:false}:{})}}),{getIndex,id,unsupported});await page.locator('#site').filter({hasText:'tab-'+id}).waitFor();
     if(initial)await page.evaluate(()=>__queries[0].resolve([{id:99}]));if(activation)await page.evaluate(()=>__queries[1].resolve([{id:99}]));
     await page.waitForFunction(expected=>document.getElementById('controls').disabled===expected,unsupported);assert.equal(await page.locator('#error').isVisible(),controlFailure,'Recovery clears refresh failures while preserving the current control error');
    }else{
     // Drain unwanted work so the red test proves actual extra backend reads.
     await page.evaluate(async()=>{for(const q of __queries.slice(1))q.resolve([{id:22}]);await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));for(const g of __gets.slice(1))g.resolve({ok:true,data:__snapshot(22)});});
    }
    await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));result.readCounts=await page.evaluate(()=>({queries:__queries.length,gets:__gets.length}));
    assert.deepEqual(result.readCounts,unrelated?baseline:{queries:baseline.queries+1,gets:baseline.gets+1},'Only an affected or uncertain current target may cause another state read');
   }else if(scenario.startsWith('settings-result:')){
    const kind=scenario.slice('settings-result:'.length),changed=kind.startsWith('activation-')||kind.startsWith('navigation-'),fail=kind.endsWith('-failure');
    if(kind!=='initial-rejected'){await page.evaluate(()=>__queries[0].resolve([{id:22,url:'https://tab-22.test/article'}]));await page.waitForFunction(()=>__gets.length===1);await page.evaluate(()=>__gets[0].resolve({ok:true,data:__snapshot(22)}));await page.locator('#site').filter({hasText:'tab-22'}).waitFor();}
    if(kind.endsWith('-rejected')){
     if(kind==='busy-rejected'){await page.evaluate(()=>__holdControls=true);await page.locator('#words').uncheck();await page.waitForFunction(()=>__controls.length===1);}
     if(kind==='target-rejected'){await page.evaluate(()=>__activation.fire());await page.waitForFunction(()=>__queries.length===2);}
     await page.evaluate(()=>{void document.getElementById('settings').onclick();});await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));result.closeCalls=await page.evaluate(()=>__closeCalls);assert.equal(result.closeCalls,0,'An unaccepted settings action must not close the popup');assert.equal(await page.evaluate(()=>__messages.filter(m=>m.action==='settings').length),0);
     if(kind==='busy-rejected')await page.evaluate(()=>__controls[0].resolve({ok:true,data:__snapshot(22,{words:false})}));
    }else{
     await page.evaluate(()=>__holdControls=true);await page.locator('#settings').click();await page.waitForFunction(()=>__controls.length===1);assert.equal(await page.evaluate(()=>__controls[0].message.action),'settings');
     if(changed)await page.evaluate(kind=>{if(kind.startsWith('activation-'))__activation.fire({tabId:33,windowId:1});else __updated.fire(22,{url:'https://new-site.test/next'},{id:22});},kind);
     if(kind==='storage-success')await page.evaluate(()=>__storage.fire({'v3:policy':{newValue:{}}},'local'));
     await page.evaluate(fail=>{if(fail)__controls[0].reject(Error('Settings failed'));else __controls[0].resolve({ok:true,data:__snapshot(22)});},fail);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
     if(changed&&!fail)assert.equal(await page.evaluate(()=>__closeCalls),0,'A settings success for a superseded target must not close the popup');
     if(changed||fail||kind==='storage-success'){
      await page.waitForFunction(()=>__queries.length===2);const id=kind.startsWith('activation-')?33:22;await page.evaluate(({id,changed})=>__queries[1].resolve([{id,url:changed?'https://new-site.test/next':'https://tab-22.test/article'}]),{id,changed});await page.waitForFunction(()=>__gets.length===2);await page.evaluate(({id,changed})=>__gets[1].resolve({ok:true,data:changed?{...__snapshot(id),hostname:'new-site',pattern:'https://new-site.test/*',path:'/next'}:__snapshot(id)}),{id,changed});await page.locator('#site').filter({hasText:changed?'new-site':'tab-22'}).waitFor();
     }
     await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));result.closeCalls=await page.evaluate(()=>__closeCalls);assert.equal(result.closeCalls,!changed&&!fail?1:0,'Only a current successful settings action closes exactly once');if(fail&&!changed)await page.locator('#error').filter({hasText:'Settings failed'}).waitFor();if(changed)assert.equal(await page.locator('#error').isVisible(),false,'An obsolete failure stays hidden while the popup remains open');
    }
   }else if(scenario.startsWith('control-target:')){
    const kind=scenario.slice('control-target:'.length),current=kind.startsWith('current-'),fail=kind.endsWith('-failure');
    const oldUrl='https://old-site.test/article',id=kind.startsWith('activation-')?33:22,nextUrl=kind==='path-failure'?'https://old-site.test/account':current||kind==='reload-success'?oldUrl:'https://new-site.test/next';
    await page.evaluate(url=>__queries[0].resolve([{id:22,url}]),oldUrl);await page.waitForFunction(()=>__gets.length===1);await page.evaluate(()=>__gets[0].resolve({ok:true,data:{...__snapshot(22),hostname:'old-site.test',pattern:'https://old-site.test/*',path:'/article'}}));await page.locator('#site').filter({hasText:'old-site.test'}).waitFor();
    await page.evaluate(()=>__holdControls=true);await page.locator('#words').uncheck();await page.waitForFunction(()=>__controls.length===1);
    if(!current)await page.evaluate(({kind,nextUrl})=>{if(kind.startsWith('activation-'))__activation.fire({tabId:33,windowId:1});else __updated.fire(22,kind==='reload-success'?{status:'loading'}:{url:nextUrl},{id:22,url:nextUrl});},{kind,nextUrl});
    await page.evaluate(fail=>{if(fail)__controls[0].reject(Error('Old target control failed'));else __controls[0].resolve({ok:true,data:{...__snapshot(22,{words:false}),hostname:'old-control-response',pattern:'https://old-site.test/*',path:'/article'}});},fail);
    await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    if(current&&!fail){assert.equal(await page.locator('#site').textContent(),'old-control-response','A current successful response still renders');assert.equal(await page.evaluate(()=>__queries.length),1,'Current success does not add a refresh');}
    else{
     await page.waitForFunction(()=>__queries.length===2);
     if(!fail){result.waitingLabel=await page.locator('#site').textContent();assert.equal(result.waitingLabel,'正在读取网站…','Old control responses must not replace the new target waiting state');assert.equal(await page.locator('#error').isVisible(),false);assert.equal(await page.locator('#controls').evaluate(e=>e.disabled),true);}
     await page.evaluate(({id,nextUrl})=>__queries[1].resolve([{id,url:nextUrl}]),{id,nextUrl});await page.waitForFunction(()=>__gets.length===2);await page.evaluate(({id,nextUrl})=>{const u=new URL(nextUrl);__gets[1].resolve({ok:true,data:{...__snapshot(id),hostname:u.hostname,pattern:u.origin+'/*',path:u.pathname}});},{id,nextUrl});await page.locator('#site').filter({hasText:new URL(nextUrl).hostname}).waitFor();
     await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));result.errorVisible=await page.locator('#error').isVisible();assert.equal(result.errorVisible,current&&fail,'A recovered error belongs only to its original tab, URL and path');if(current&&fail)assert.equal(await page.locator('#error').textContent(),'Old target control failed');assert.equal(await page.evaluate(()=>__queries.length),2,'Target change and control failure recovery coalesce');
    }
   }else if(scenario.startsWith('target-pending:')){
    const kind=scenario.slice('target-pending:'.length);
    if(kind==='initial'){assert.equal(await page.locator('#controls').evaluate(e=>e.disabled),true);assert.equal(await page.locator('#paused').isDisabled(),true,'Initial target discovery disables pause as well');}
    else{
     await page.evaluate(()=>__queries[0].resolve([{id:22}]));await page.waitForFunction(()=>__gets.length===1);await page.evaluate(()=>__gets[0].resolve({ok:true,data:__snapshot(22)}));await page.locator('#site').filter({hasText:'tab-22'}).waitFor();
     const busy=kind.startsWith('busy-');if(busy){await page.evaluate(()=>__holdControls=true);await page.locator('#words').uncheck();await page.waitForFunction(()=>__controls.length===1);}
     const before=await page.evaluate(()=>__messages.filter(m=>m.action!=='get').length);
     await page.evaluate(kind=>{if(kind==='navigation')__updated.fire(22,{url:'https://new-site.test/'},{id:22});else if(kind==='storage')__storage.fire({'v3:policy':{newValue:{}}},'local');else __activation.fire();},kind);
     if(busy)await page.evaluate(fail=>{if(fail)__controls[0].reject(Error('Pending target control failed'));else __controls[0].resolve({ok:true,data:__snapshot(22,{words:false})});},kind==='busy-failure');
     await page.waitForFunction(()=>__queries.length===2);
     if(kind==='query-failure'){await page.evaluate(()=>__queries[1].reject(Error('Target query failed')));await page.locator('#error').filter({hasText:'Target query failed'}).waitFor();}
     if(kind==='get-failure'){await page.evaluate(()=>__queries[1].resolve([{id:33}]));await page.waitForFunction(()=>__gets.length===2);await page.evaluate(()=>__gets[1].reject(Error('Target read failed')));await page.locator('#error').filter({hasText:'Target read failed'}).waitFor();}
     if(kind==='storage'){assert.equal(await page.locator('#controls').evaluate(e=>e.disabled),false,'Same-target storage refresh keeps controls available');assert.equal(await page.locator('#paused').isDisabled(),false);}
     else{
      // Disabled DOM events are dispatched deliberately to verify the handler guard too.
      await page.evaluate(()=>{const e=document.getElementById('words');e.checked=!e.checked;e.dispatchEvent(new Event('change'));});await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await page.evaluate(()=>{__holdPermissions=true;const e=document.getElementById('remember');e.checked=true;e.dispatchEvent(new Event('change'));});await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
      result.pendingState=await page.evaluate(before=>({controlsDisabled:document.getElementById('controls').disabled,pausedDisabled:document.getElementById('paused').disabled,extraCommands:__messages.filter(m=>m.action!=='get').length-before,permissionRequests:__permissions.length}),before);
      assert.deepEqual(result.pendingState,{controlsDisabled:true,pausedDisabled:true,extraCommands:0,permissionRequests:0},'An unresolved target must not expose or operate the old controls');
     }
     let qi=1;if(kind==='query-failure'||kind==='get-failure'){await page.evaluate(()=>__activation.fire());await page.waitForFunction(()=>__queries.length===3);qi=2;}
     const gi=await page.evaluate(()=>__gets.length),id=kind==='navigation'||kind==='storage'?22:33;
     await page.evaluate(({qi,id})=>__queries[qi].resolve([{id}]),{qi,id});await page.waitForFunction(n=>__gets.length===n,gi+1);await page.evaluate(({gi,id})=>__gets[gi].resolve({ok:true,data:__snapshot(id)}),{gi,id});await page.locator('#site').filter({hasText:'tab-'+id}).waitFor();await page.waitForFunction(()=>!document.getElementById('controls').disabled&&!document.getElementById('paused').disabled);
     await page.evaluate(()=>__holdControls=false);await page.locator('#words').uncheck();await page.waitForFunction(()=>__messages.filter(m=>m.action==='prefs').length>=1);assert.equal(await page.evaluate(()=>__messages.filter(m=>m.action==='prefs').at(-1).tabId),id,'Successful target recovery enables controls for the latest tab');
    }
   }else if(scenario.startsWith('navigation:')){
    const kind=scenario.slice('navigation:'.length),pending=kind==='pending-first'||kind==='pending-activated';
    await page.evaluate(()=>__queries[0].resolve([{id:22}]));await page.waitForFunction(()=>__gets.length===1);
    if(kind!=='pending-first'){await page.evaluate(kind=>__gets[0].resolve({ok:true,data:{...__snapshot(22),running:!kind.startsWith('permission-enable-')}}),kind);await page.locator('#site').filter({hasText:'tab-22'}).waitFor();}
    if(kind==='pending-activated'){await page.evaluate(()=>__activation.fire());await page.waitForFunction(()=>__queries.length===2);await page.evaluate(()=>__queries[1].resolve([{id:33}]));await page.waitForFunction(()=>__gets.length===2);}
    if(kind.startsWith('permission-')){
     const [,flow,outcome]=kind.split('-');
     await page.evaluate(()=>__holdPermissions=true);await page.locator('#remember').check();if(flow==='enable')await page.locator('#enabled').check();await page.waitForFunction(()=>__permissions.length===1);
     await page.evaluate(()=>__updated.fire(22,{url:'https://new-site.test/private'},{id:22,url:'https://new-site.test/private'}));await page.evaluate(outcome=>{if(outcome==='reject')__permissions[0].reject(Error('Old navigation permission failure'));else __permissions[0].resolve(outcome==='grant');},outcome);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
     result.permissionCommands=await page.evaluate(()=>__messages.filter(m=>m.action==='enable').map(m=>({tabId:m.tabId,remember:m.remember})));assert.deepEqual(result.permissionCommands,[],'Navigation invalidates the old permission intent before its callback');assert.equal(await page.locator('#error').isVisible(),false,'Old permission errors must not cover navigation');
    }else if(kind.startsWith('busy-')){
     await page.evaluate(()=>__holdControls=true);await page.locator('#words').uncheck();await page.waitForFunction(()=>__controls.length===1);await page.evaluate(()=>{for(const change of [{status:'loading'},{url:'https://new-site.test/private'},{status:'complete'}])__updated.fire(22,change,{id:22});});assert.equal(await page.evaluate(()=>__queries.length),1,'Navigation waits for the pending control');await page.evaluate(fail=>{if(fail)__controls[0].reject(Error('Navigation control failed'));else __controls[0].resolve({ok:true,data:__snapshot(22,{words:false})});},kind==='busy-failure');
    }else{
     await page.evaluate(kind=>{if(kind==='background'){for(const change of [{url:'https://background.test/'},{status:'loading'},{status:'complete'}])__updated.fire(99,change,{id:99});}else if(kind==='irrelevant'){for(const change of [{title:'Changed title'},{audible:true},{favIconUrl:'https://tab-22.test/icon.png'},{}])__updated.fire(22,change,{id:22});}else __updated.fire(kind==='pending-activated'?33:22,kind==='loading'||kind==='complete'?{status:kind}:{url:'https://new-site.test/private'},{id:kind==='pending-activated'?33:22});},kind);
    }
    if(kind==='background'||kind==='irrelevant'){await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));assert.equal(await page.evaluate(()=>__queries.length),1,'Unrelated tab updates do not query or read state');assert.equal(await page.evaluate(()=>__gets.length),1);}
    else{
     const nextQuery=kind==='pending-activated'?2:1,nextGet=kind==='pending-activated'?2:1,id=kind==='pending-activated'?33:22;
     await page.waitForFunction(n=>__queries.length===n,nextQuery+1,{timeout:1500});await page.evaluate(({nextQuery,id})=>__queries[nextQuery].resolve([{id}]),{nextQuery,id});await page.waitForFunction(n=>__gets.length===n,nextGet+1);await page.evaluate(({nextGet,id})=>__gets[nextGet].resolve({ok:true,data:{...__snapshot(id,{words:false}),hostname:'new-site',pattern:'https://new-site.test/*',remembered:true}}),{nextGet,id});await page.locator('#site').filter({hasText:'new-site'}).waitFor();
     if(pending){await page.evaluate(i=>__gets[i].resolve({ok:true,data:__snapshot(i===1?33:22)}),kind==='pending-activated'?1:0);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));assert.equal(await page.locator('#site').textContent(),'new-site','Old navigation response cannot overwrite the new site');assert.equal(await page.locator('#words').isChecked(),false);}
     await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));assert.equal(await page.evaluate(()=>__queries.length),nextQuery+1,'Busy navigation events and failure recovery do not refresh twice');
    }
   }else if(scenario.startsWith('permission-intent:')){
    const [,flow,kind,outcome]=scenario.split(':');
    await page.evaluate(()=>__queries[0].resolve([{id:22}]));await page.waitForFunction(()=>__gets.length===1);await page.evaluate(flow=>__gets[0].resolve({ok:true,data:{...__snapshot(22),running:flow==='remember'}}),flow);await page.locator('#site').filter({hasText:'tab-22'}).waitFor();
    await page.evaluate(()=>__holdPermissions=true);await page.locator('#remember').check();if(flow==='enable')await page.locator('#enabled').check();await page.waitForFunction(()=>__permissions.length===1);
    await page.locator('#remember').uncheck();
    if(kind==='replace'){await page.locator('#remember').check();if(flow==='enable')await page.locator('#enabled').check();await page.waitForFunction(()=>__permissions.length===2);}
    await page.evaluate(outcome=>{if(outcome==='reject')__permissions[0].reject(Error('Withdrawn permission failure'));else __permissions[0].resolve(outcome==='grant');},outcome);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    result.permissionCommands=await page.evaluate(()=>__messages.filter(m=>m.action==='enable').map(m=>({tabId:m.tabId,remember:m.remember})));
    assert.deepEqual(result.permissionCommands,[],'A withdrawn permission intent must not enable or remember the site');assert.equal(await page.locator('#error').isVisible(),false,'Withdrawn permission failures must stay hidden');assert.equal(await page.locator('#remember').isChecked(),kind==='replace','The latest remember choice is preserved');
    if(kind==='replace'){await page.evaluate(()=>__permissions[1].resolve(true));await page.waitForFunction(()=>__messages.filter(m=>m.action==='enable').length===1);assert.equal(await page.evaluate(()=>__messages.find(m=>m.action==='enable').tabId),22,'Only the newest approved intent enables the original site');}
    else assert.equal(await page.locator('#enabled').isChecked(),flow==='remember','Cancelling permission restores the actual enabled state');
   }else if(scenario.startsWith('permission:')){
    const [,flow,state,outcome]=scenario.split(':');
    await page.evaluate(()=>__queries[0].resolve([{id:22}]));await page.waitForFunction(()=>__gets.length===1);await page.evaluate(flow=>__gets[0].resolve({ok:true,data:{...__snapshot(22),running:flow==='remember'}}),flow);await page.locator('#site').filter({hasText:'tab-22'}).waitFor();
    await page.evaluate(()=>__holdPermissions=true);await page.locator('#remember').check();if(flow==='enable')await page.locator('#enabled').check();await page.waitForFunction(()=>__permissions.length===1);
    assert.deepEqual(await page.evaluate(()=>__permissions[0].message),{origins:['https://tab-22.test/*']},'Permission uses the originally displayed site');
    assert.equal(await page.evaluate(()=>__messages.filter(m=>m.action==='enable').length),0,'Control waits for permission');
    if(state!=='current'){
     await page.evaluate(()=>__activation.fire());await page.waitForFunction(()=>__queries.length===2);
     if(state==='new-tab'){await page.evaluate(()=>__queries[1].resolve([{id:33}]));await page.waitForFunction(()=>__gets.length===2);await page.evaluate(()=>__gets[1].resolve({ok:true,data:{...__snapshot(33),remembered:true}}));await page.locator('#site').filter({hasText:'tab-33'}).waitFor();}
    }
    await page.evaluate(outcome=>{if(outcome==='reject')__permissions[0].reject(Error('Permission request failed'));else __permissions[0].resolve(outcome==='grant');},outcome);
    await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    const commands=await page.evaluate(()=>__messages.filter(m=>m.action==='enable'));result.permissionCommands=commands.map(m=>({tabId:m.tabId,remember:m.remember}));
    if(state==='current'){
     if(outcome==='grant'){assert.equal(commands.length,1,'Current permission grant enables exactly once');assert.equal(commands[0].tabId,22);assert.equal(commands[0].remember,true);assert.equal(await page.locator('#error').isVisible(),false);}
     else{assert.equal(commands.length,0);await page.locator('#error').filter({hasText:outcome==='reject'?'Permission request failed':'网站授权未获允许'}).waitFor();assert.equal(await page.locator('#'+(flow==='enable'?'enabled':'remember')).isChecked(),false);}
    }else{
     assert.equal(commands.length,0,'A superseded permission result must not control any tab');
     if(state==='pending-tab'){await page.evaluate(()=>__queries[1].resolve([{id:33}]));await page.waitForFunction(()=>__gets.length===2);await page.evaluate(()=>__gets[1].resolve({ok:true,data:{...__snapshot(33),remembered:true}}));await page.locator('#site').filter({hasText:'tab-33'}).waitFor();}
     assert.equal(await page.locator('#error').isVisible(),false,'Old permission failures must not cover the newer site');assert.equal(await page.locator('#enabled').isChecked(),true);assert.equal(await page.locator('#remember').isChecked(),true,'Old permission failure must not uncheck the newer site');
     await page.locator('#words').uncheck();await page.waitForFunction(()=>__messages.some(m=>m.action==='prefs'));assert.equal(await page.evaluate(()=>__messages.find(m=>m.action==='prefs').tabId),33,'Later user actions still target the newer tab');
    }
   }else if(scenario==='stale-query-target'){
    await page.evaluate(()=>__activation.fire());await page.waitForFunction(()=>__queries.length===2);
    await page.evaluate(()=>__queries[1].resolve([{id:22}]));await page.waitForFunction(()=>__gets.length===1);await page.evaluate(()=>__gets[0].resolve({ok:true,data:__snapshot(22)}));await page.locator('#site').filter({hasText:'tab-22'}).waitFor();
    await page.evaluate(()=>__queries[0].resolve([{id:11}]));await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await page.evaluate(()=>__gets.find(g=>g.message.tabId===11)?.resolve({ok:true,data:__snapshot(11)}));
    await page.locator('#words').uncheck();await page.waitForFunction(()=>__messages.some(m=>m.action==='prefs'));assert.equal(await page.evaluate(()=>__messages.find(m=>m.action==='prefs').tabId),22,'An old query cannot silently retarget a displayed popup control');
   }else if(scenario==='superseded-control-error'){
    await page.evaluate(()=>__queries[0].resolve([{id:22}]));await page.waitForFunction(()=>__gets.length===1);await page.evaluate(()=>__gets[0].resolve({ok:true,data:__snapshot(22)}));await page.locator('#site').filter({hasText:'tab-22'}).waitFor();
    await page.evaluate(()=>__holdControls=true);await page.locator('#words').uncheck();await page.waitForFunction(()=>__controls.length===1);await page.evaluate(()=>__controls[0].reject(Error('Old control failed')));await page.waitForFunction(()=>__queries.length===2);
    // A later activation refresh succeeds before the failed control's recovery completes.
    await page.evaluate(()=>__activation.fire());await page.waitForFunction(()=>__queries.length===3);await page.evaluate(()=>__queries[2].resolve([{id:33}]));await page.waitForFunction(()=>__gets.length===2);await page.evaluate(()=>__gets[1].resolve({ok:true,data:__snapshot(33)}));await page.locator('#site').filter({hasText:'tab-33'}).waitFor();
    await page.evaluate(()=>__queries[1].resolve([{id:22}]));await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    assert.equal(await page.locator('#error').isVisible(),false,'An older control failure must not cover a newer successful refresh');
    assert.equal(await page.evaluate(()=>__gets.length),2,'The superseded recovery must not read the old tab state');
    await page.evaluate(()=>__holdControls=false);await page.locator('#words').uncheck();await page.waitForFunction(()=>__messages.filter(m=>m.action==='prefs').length===2);assert.equal(await page.evaluate(()=>__messages.filter(m=>m.action==='prefs')[1].tabId),33,'The newer tab remains the control target');
   }else if(scenario==='superseded-control-cleanup'){
    await page.evaluate(()=>__queries[0].resolve([{id:22}]));await page.waitForFunction(()=>__gets.length===1);await page.evaluate(()=>__gets[0].resolve({ok:true,data:__snapshot(22)}));await page.locator('#site').filter({hasText:'tab-22'}).waitFor();
    await page.evaluate(()=>__holdControls=true);await page.locator('#words').uncheck();await page.waitForFunction(()=>__controls.length===1);await page.evaluate(()=>__controls[0].reject(Error('Old control failed')));await page.waitForFunction(()=>__queries.length===2);
    // A later activation refresh succeeds before the failed control's recovery completes.
    await page.evaluate(()=>__activation.fire());await page.waitForFunction(()=>__queries.length===3);await page.evaluate(()=>__queries[2].resolve([{id:33}]));await page.waitForFunction(()=>__gets.length===2);await page.evaluate(()=>__gets[1].resolve({ok:true,data:__snapshot(33)}));await page.locator('#site').filter({hasText:'tab-33'}).waitFor();
    await page.locator('#words').uncheck();await page.waitForFunction(()=>__controls.length===2);
    await page.evaluate(()=>__queries[1].resolve([{id:22}]));await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    result.pendingState={controlsDisabled:await page.locator('#controls').evaluate(e=>e.disabled),pausedDisabled:await page.locator('#paused').isDisabled()};
    assert.deepEqual(result.pendingState,{controlsDisabled:true,pausedDisabled:true},'Old recovery cleanup must not unlock a newer pending control');
    assert.equal(await page.locator('#error').isVisible(),false,'The superseded control error stays hidden');
    await page.evaluate(()=>document.getElementById('words').dispatchEvent(new Event('change')));assert.equal(await page.evaluate(()=>__controls.length),2,'Pending newer control still rejects duplicate commands');
    await page.evaluate(()=>__storage.fire({'v2:prefs':{newValue:{words:true}}},'local'));assert.equal(await page.evaluate(()=>__queries.length),3,'New control keeps refresh events queued');
    await page.evaluate(()=>__controls[1].resolve({ok:true,data:__snapshot(33,{words:false})}));await page.waitForFunction(()=>__queries.length===4);await page.evaluate(()=>__queries[3].resolve([{id:33}]));await page.waitForFunction(()=>__gets.length===3);await page.evaluate(()=>__gets[2].resolve({ok:true,data:__snapshot(33)}));await page.waitForFunction(()=>!document.getElementById('controls').disabled);
   }else if(scenario.includes('-unrelated:')||scenario.includes('-wrong-area:')||scenario.startsWith('related:')){
    await page.evaluate(()=>__queries[0].resolve([{id:22}]));await page.waitForFunction(()=>__gets.length===1);await page.evaluate(()=>__gets[0].resolve({ok:true,data:__snapshot(22)}));await page.locator('#site').filter({hasText:'tab-22'}).waitFor();
    const busy=scenario.startsWith('busy-'),related=scenario.startsWith('related:'),wrongArea=scenario.includes('-wrong-area:'),suffix=scenario.slice(scenario.indexOf(':')+1),areaOverride=wrongArea?suffix.slice(0,suffix.indexOf(':')):null,key=wrongArea?suffix.slice(suffix.indexOf(':')+1):suffix;
    if(wrongArea)Object.assign(result,{key,storageArea:areaOverride});
    if(busy){await page.evaluate(()=>__holdControls=true);await page.locator('#words').uncheck();await page.waitForFunction(()=>__controls.length===1);}
    // Real change maps and areas, including deletion and mixed relevant/unrelated events.
    await page.evaluate(({key,related,areaOverride})=>{
     const area=areaOverride==='missing'?undefined:areaOverride||(key.startsWith('dict:')||key==='v3:tabs'?'session':'local');
     __storage.fire({[key]:{oldValue:{before:true},newValue:{after:true}}},area);
     __storage.fire({[key]:{oldValue:{before:true}}},area);
     if(related)__storage.fire({[key]:{newValue:{}},'v2:words':{newValue:[]}},area);
    },{key,related,areaOverride});
    await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    if(related){
     assert.equal(await page.evaluate(()=>__queries.length),4,'Every relevant change, deletion and mixed event refreshes');
     await page.evaluate(()=>__queries[3].resolve([{id:33}]));await page.waitForFunction(()=>__gets.length===2);await page.evaluate(()=>__gets[1].resolve({ok:true,data:__snapshot(33)}));await page.locator('#site').filter({hasText:'tab-33'}).waitFor();
    }else{
     if(busy){assert.equal(await page.evaluate(()=>__queries.length),1,'Events wait for the running control');await page.evaluate(()=>__controls[0].resolve({ok:true,data:__snapshot(22,{words:false})}));await page.waitForFunction(()=>!document.getElementById('controls').disabled);}
     // Finish any unwanted queries so the red test measures actual background reads too.
     await page.evaluate(async()=>{for(const q of __queries.slice(1))q.resolve([{id:22}]);await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));for(const g of __gets.slice(1))g.resolve({ok:true,data:__snapshot(22)});});
     result.readCounts=await page.evaluate(()=>({queries:__queries.length,gets:__gets.length}));
     assert.deepEqual(result.readCounts,{queries:1,gets:1},'Unrelated writes must neither refresh nor queue background reads');
    }
   }else if(scenario.startsWith('busy-')){
    await page.evaluate(()=>__queries[0].resolve([{id:22}]));await page.waitForFunction(()=>__gets.length===1);await page.evaluate(()=>__gets[0].resolve({ok:true,data:__snapshot(22)}));await page.locator('#site').filter({hasText:'tab-22'}).waitFor();
    await page.evaluate(()=>__holdControls=true);await page.locator('#words').uncheck();await page.waitForFunction(()=>__controls.length===1);await page.evaluate(()=>{for(let i=0;i<6;i++){const key=['v3:policy','v3:tabs','v2:prefs'][i%3];__storage.fire({[key]:{newValue:{}}},key==='v3:tabs'?'session':'local');}__activation.fire();});assert.equal(await page.evaluate(()=>__queries.length),1,'Refresh events wait for the running control');
    const fail=scenario==='busy-control-failure';await page.evaluate(fail=>{if(fail)__controls[0].reject(Error('Control failed'));else __controls[0].resolve({ok:true,data:__snapshot(22,{words:false})});},fail);
    await page.waitForFunction(()=>__queries.length===2,null,{timeout:1500});const next=fail?22:33;await page.evaluate(next=>__queries[1].resolve([{id:next}]),next);await page.waitForFunction(()=>__gets.length===2);await page.evaluate(next=>__gets[1].resolve({ok:true,data:__snapshot(next)}),next);await page.locator('#site').filter({hasText:'tab-'+next}).waitFor();
    if(fail)await page.locator('#error').filter({hasText:'Control failed'}).waitFor();else assert.equal(await page.locator('#words').isChecked(),true,'The queued refresh restores the newer external setting');
    await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));assert.equal(await page.evaluate(()=>__queries.length),2,'Busy events coalesce and failure recovery does not refresh twice');
   }else{
    await page.evaluate(()=>__queries[0].resolve([{id:11}]));await page.waitForFunction(()=>__gets.length===1);
    if(scenario==='current-error-recovery'){await page.evaluate(()=>__gets[0].reject(Error('Current temporary failure')));await page.locator('#error').filter({hasText:'Current temporary failure'}).waitFor();}
    await page.evaluate(()=>__storage.fire({'v3:policy':{newValue:{paused:false}}},'local'));await page.waitForFunction(()=>__queries.length===2);await page.evaluate(()=>__queries[1].resolve([{id:22}]));await page.waitForFunction(()=>__gets.length===2);await page.evaluate(()=>__gets[1].resolve({ok:true,data:__snapshot(22)}));await page.locator('#site').filter({hasText:'tab-22'}).waitFor();
    if(scenario==='stale-get-error'){await page.evaluate(()=>__gets[0].reject(Error('Stale temporary failure')));await page.evaluate(()=>new Promise(r=>requestAnimationFrame(r)));}
    assert.equal(await page.locator('#error').isVisible(),false,'An outdated or recovered error must not cover a newer successful state');
   }
   assert.equal(await page.locator('.version').textContent(),pkg.version);assert.deepEqual(errors,[]);result.status='passed';
  }catch(error){result.error=error.message;}finally{await context.close();report.checks.push(result);console.log(JSON.stringify(result));}
 }
 assert.ok(report.checks.every(c=>c.status==='passed'),'Popup refresh acceptance failed');report.status='passed';
}catch(error){report.error=error.stack;throw error;}finally{await browser?.close();await new Promise(r=>server.close(r));await writeFile('test-results/popup-refresh-report.json',JSON.stringify(report,null,2));}
