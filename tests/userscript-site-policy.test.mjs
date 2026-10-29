import test from 'node:test';
import assert from 'node:assert/strict';
import {createSitePolicy,PAUSE_KEY,sitePolicyKey} from '../userscript/site-controls.js';
const prefs={words:true,enabled:true,mode:'bilingual',translationUnit:'sentence',side:'left'};
function fixture(url='https://article.example/read',data=new Map()){
 const api={getValue:async(k,d)=>structuredClone(data.get(k)??d),setValue:async(k,v)=>data.set(k,structuredClone(v))};
 return {data,api,policy:createSitePolicy({...api,url})};
}
test('site memory is opt-in, retains reading options, and never changes vocabulary keys',async()=>{
 const {policy,data}=fixture();await policy.read();assert.deepEqual(policy.initialPrefs(prefs),{...prefs,words:false,enabled:false,mode:'original'});
 await policy.change('remember',true);assert.deepEqual(policy.initialPrefs(prefs),prefs);assert.deepEqual([...data.keys()],[sitePolicyKey('https://article.example')]);
 await policy.change('remember',false);assert.equal(policy.initialPrefs(prefs).enabled,false);assert.equal(policy.initialPrefs(prefs).translationUnit,'sentence');
});
test('remember and exclude are isolated by origin; global pause applies to every origin',async()=>{
 const a=fixture(),b=fixture('https://other.example/read',a.data);await a.policy.change('remember',true);await a.policy.change('excluded',true);
 await b.policy.read();assert.equal(b.policy.state.remember,false);assert.equal(b.policy.state.blocked,false);
 await a.policy.change('paused',true);await b.policy.read();assert.equal(b.policy.state.blocked,true);await b.policy.change('paused',false);await a.policy.read();assert.equal(a.policy.state.excluded,true);assert.equal(a.policy.state.remember,true);
 await a.policy.change('excluded',false);assert.equal(a.policy.state.blocked,false);
});
test('remembered sites still open account and payment pages inactive',async()=>{
 for(const path of ['/login','/account/profile','/checkout']){const {policy}=fixture('https://article.example'+path);await policy.change('remember',true);assert.equal(policy.initialPrefs(prefs).words,false);assert.equal(policy.initialPrefs(prefs).enabled,false);}
});
test('pausing blocks immediately while privileged storage is waiting',async()=>{
 let release;const {api}=fixture();const policy=createSitePolicy({...api,url:'https://article.example/',setValue:()=>new Promise(r=>release=r)});await policy.read();
 const pending=policy.change('paused',true);assert.equal(policy.state.blocked,true);await new Promise(r=>setImmediate(r));assert.equal(policy.state.blocked,true);release();await pending;assert.equal(policy.state.paused,true);assert.equal(policy.state.blocked,true);
});
test('read errors and manager timeouts stay inactive without resetting stored choices',async()=>{
 let writes=0;for(const getValue of [async()=>{throw Error('denied');},()=>new Promise(()=>{})]){
 const policy=createSitePolicy({url:'https://article.example/',getValue,setValue:()=>writes++,timeoutMs:5});await assert.rejects(policy.read());assert.equal(policy.state.blocked,true);assert.equal(policy.initialPrefs(prefs).words,false);
 }assert.equal(writes,0);
});
test('a failed policy write blocks activation and preserves existing preference data',async()=>{
 const data=new Map([[sitePolicyKey('https://article.example'),{remember:true,excluded:false}]]);const {api}=fixture('https://article.example/',data);
 const policy=createSitePolicy({...api,url:'https://article.example/',setValue:async()=>{throw Error('storage full');}});await policy.read();await assert.rejects(policy.change('paused',true),/storage full/);assert.equal(policy.state.blocked,true);assert.equal(policy.initialPrefs(prefs).enabled,false);assert.deepEqual(data.get(sitePolicyKey('https://article.example')),{remember:true,excluded:false});
});
