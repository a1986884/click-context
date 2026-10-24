import {test} from 'node:test';
import assert from 'node:assert/strict';
import {extensionState} from '../src/extension-state.js';
import {pageInfo,cleanPrefs,validRequest} from '../src/protocol.js';
function area(initial={}){const data=structuredClone(initial);return {data,get:async key=>({[key]:structuredClone(data[key])}),set:async value=>Object.assign(data,structuredClone(value))};}
const a={id:1,url:'https://one.test/article'},b={id:2,url:'https://one.test/article'},c={id:3,url:'https://two.test/article'};
test('default has no website or network authorization; legacy vocabulary and preferences survive',async()=>{const local=area({'v2:words':[{word:'went',lemma:'go'}],'v2:prefs':{mode:'translated',words:false,online:true}}),session=area(),s=extensionState(local,session);const first=await s.get(a);assert.equal(first.authorized,false);assert.equal(first.prefs.online,false);assert.equal(first.prefs.mode,'translated');assert.equal(first.prefs.words,false);await s.change(a,'enable');assert.deepEqual(local.data['v2:words'],[{word:'went',lemma:'go'}]);assert.equal(local.data['v2:prefs'].online,true);assert.equal((await s.get(a)).prefs.online,true);});
test('temporary tab grants isolate tabs, survive worker restart and expire with browser session',async()=>{const local=area(),session=area();let s=extensionState(local,session);await s.change(a,'enable');assert.equal((await s.get(a)).authorized,true);assert.equal((await s.get(b)).authorized,false);assert.equal((await s.get(c)).authorized,false);s=extensionState(local,session);assert.equal((await s.get(a)).authorized,true);assert.equal((await extensionState(local,area()).get(a)).authorized,false);});
test('remembered origin restores only that origin; disabling one tab leaves another active',async()=>{const s=extensionState(area(),area());await s.change(a,'enable',{remember:true});assert.equal((await s.get(b)).authorized,true);assert.equal((await s.get(c)).authorized,false);await s.change(a,'disable');assert.equal((await s.get(a)).authorized,false);assert.equal((await s.get(b)).authorized,true);});
test('networking follows website activation and legacy offline flags cannot block active sites',async()=>{const s=extensionState(area(),area());await s.change(a,'enable');await s.change(c,'enable');await s.change(a,'prefs',{prefs:{online:false,mode:'translated',words:false,unknown:'bad'}});assert.equal((await s.get(a)).prefs.online,true);assert.equal((await s.get(c)).prefs.online,true);assert.deepEqual(cleanPrefs({online:'yes',enabled:3,mode:'bad',side:'evil',words:false}),{words:false});});
test('revoke removes persistent and temporary grants without deleting vocabulary',async()=>{const local=area({'v2:words':['kept']}),s=extensionState(local,area());await s.change(a,'enable',{remember:true,prefs:{online:true}});await s.change(b,'enable');await s.change(a,'revoke');assert.equal((await s.get(a)).authorized,false);assert.equal((await s.get(b)).authorized,false);assert.equal((await s.get(a)).prefs.online,false);assert.deepEqual(local.data['v2:words'],['kept']);});
test('global pause and exclusions gate every tab; resuming restores automatic networking',async()=>{const s=extensionState(area(),area());await s.change(a,'enable',{remember:true});await s.change(a,'pause',{value:true});assert.equal((await s.get(a)).authorized,false);assert.equal((await s.get(b)).authorized,false);await assert.rejects(s.change(c,'enable'));await s.change(a,'pause',{value:false});assert.equal((await s.get(b)).authorized,true);await s.change(a,'exclude',{value:true});assert.equal((await s.get(b)).authorized,false);await assert.rejects(s.change(a,'enable'));await s.change(a,'exclude',{value:false});assert.equal((await s.get(a)).authorized,false);});
test('sensitive routes require explicit per-page activation even on remembered origin',async()=>{const s=extensionState(area(),area()),login={id:1,url:'https://one.test/login'};await s.change(a,'enable',{remember:true});assert.equal((await s.get(login)).authorized,false);await s.change(login,'enable');assert.equal((await s.get(login)).authorized,true);assert.equal((await s.get({...login,url:'https://one.test/checkout'})).authorized,false);});
test('restricted protocols, stores, PDFs and embedded credentials are rejected',()=>{for(const url of ['chrome://settings','about:blank','file:///a','https://chromewebstore.google.com/detail/a','https://chrome.google.com/webstore/a','https://example.test/a.pdf','https://user:pass@example.test/'])assert.equal(pageInfo(url).supported,false,url);assert.equal(pageInfo(a.url).supported,true);});
test('query envelope is bounded and rejects missing, duplicate-capable or malformed IDs',()=>{assert.equal(validRequest({type:'lookup',requestId:'valid-id',text:'ocean'}),true);for(const m of [{text:'ocean'},{type:'lookup',requestId:'<bad>',text:'ocean'},{type:'lookup',requestId:'id',text:'a'.repeat(101)}])assert.equal(validRequest(m),false);});
test('concurrent policy updates are serialized and removed tab grants cannot reappear',async()=>{const s=extensionState(area(),area());await Promise.all([s.change(a,'enable'),s.change(c,'enable')]);assert.equal((await s.get(a)).authorized,true);assert.equal((await s.get(c)).authorized,true);await s.removeTab(a.id);assert.equal((await s.get(a)).authorized,false);});
test('temporary disable and re-enable preserve the last reading choices',async()=>{const s=extensionState(area(),area());await s.change(a,'enable');await s.change(a,'prefs',{prefs:{mode:'translated',words:false}});await s.change(a,'disable');assert.equal((await s.get(a)).authorized,false);await s.change(a,'enable');const current=await s.get(a);assert.equal(current.authorized,true);assert.equal(current.prefs.mode,'translated');assert.equal(current.prefs.words,false);});
test('forgetting a remembered site keeps the current temporary tab but ends future automatic access',async()=>{
 const local=area(),session=area(),s=extensionState(local,session);
 await s.change(a,'enable',{remember:true,prefs:{online:true,mode:'bilingual'}});
 assert.equal((await s.get(b)).authorized,true);
 await s.change(a,'forget');
 assert.equal((await s.get(a)).authorized,true);assert.equal((await s.get(a)).remembered,false);assert.equal((await s.get(a)).prefs.online,true);
 assert.equal((await s.get(b)).authorized,false);
 assert.equal((await extensionState(local,area()).get(a)).authorized,false);
});
test('Collins session setting is explicit global state and never granted by ordinary reading preferences',async()=>{
 const s=extensionState(area(),area());assert.equal((await s.get(a)).collinsSession,false);
 await s.change(a,'enable',{prefs:{collinsSession:true}});assert.equal((await s.get(a)).collinsSession,false);
 await s.change(a,'collins-session',{value:true});assert.equal((await s.get(a)).collinsSession,true);assert.equal((await s.get(c)).collinsSession,true);assert.equal((await s.get(a)).prefs.online,true);
 await s.change(a,'collins-session',{value:false});assert.equal((await s.get(a)).collinsSession,false);
});

test('bubble position is validated and survives extension preference persistence',async()=>{
 const position={x:0.25,y:0.7};assert.deepEqual(cleanPrefs({bubblePosition:{...position,extra:'ignored'}}),{bubblePosition:position});
 for(const value of [{x:-1,y:0},{x:0,y:Infinity},{x:'0',y:0},{x:0,y:2}])assert.deepEqual(cleanPrefs({bubblePosition:value}),{});
 const local=area(),s=extensionState(local,area());await s.change(a,'enable',{remember:true});await s.change(a,'prefs',{prefs:{bubblePosition:position}});
 assert.deepEqual((await extensionState(local,area()).get(b)).prefs.bubblePosition,position);
 await s.change(a,'prefs',{prefs:{bubblePosition:null}});assert.equal((await s.get(a)).prefs.bubblePosition,null);
});
