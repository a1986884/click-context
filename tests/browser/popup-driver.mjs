// Chromium exposes action popups as type "other", which Playwright pages() omits.
// Attach to that real browser UI target using public CDP, never a copied popup page.
export async function popupDriver(cdp,targetId,until){
 const {sessionId}=await cdp.send('Target.attachToTarget',{targetId,flatten:false});let next=0;const pending=new Map();
 const receive=event=>{if(event.sessionId!==sessionId)return;const reply=JSON.parse(event.message);const p=pending.get(reply.id);if(p){clearTimeout(p.timer);pending.delete(reply.id);reply.error?p.reject(Error(reply.error.message)):p.resolve(reply.result);}};
 cdp.on('Target.receivedMessageFromTarget',receive);
 async function send(method,params={}){const id=++next;const promise=new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(Error('Popup CDP timeout: '+method));},15000);pending.set(id,{resolve,reject,timer});});await cdp.send('Target.sendMessageToTarget',{sessionId,message:JSON.stringify({id,method,params})});return promise;}
 async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;}
 function locator(selector){const element='document.querySelector('+JSON.stringify(selector)+')';return {
  isVisible:()=>evaluate(`!!(${element} && ${element}.getBoundingClientRect().height && getComputedStyle(${element}).visibility!=='hidden')`),
  isEnabled:()=>evaluate(`!!(${element} && !${element}.matches(':disabled'))`),
  isChecked:()=>evaluate(`!!${element}?.checked`),
  textContent:()=>evaluate(`${element}?.textContent||''`),
  waitFor:()=>until(()=>evaluate(`!!${element}`),'Popup element missing: '+selector),
  async setChecked(value){await until(()=>evaluate(`!!(${element} && !${element}.matches(':disabled'))`),'Popup control disabled: '+selector);if(await evaluate(`!!${element}.checked`)===value)return;const rect=await evaluate(`(()=>{const e=${element};e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...rect});await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...rect});},
  async click(){await until(()=>evaluate(`!!(${element} && !${element}.matches(':disabled'))`),'Popup control disabled: '+selector);const rect=await evaluate(`(()=>{const e=${element};e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...rect});await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...rect});},
  async selectOption(value){await until(()=>evaluate(`!!(${element} && !${element}.matches(':disabled'))`),'Popup select disabled: '+selector);return evaluate(`(()=>{const e=${element};e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('change',{bubbles:true}));})()`);}
 };}
 async function detach(){cdp.off('Target.receivedMessageFromTarget',receive);for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('Target detached'));}pending.clear();await cdp.send('Target.detachFromTarget',{sessionId}).catch(()=>{});}
 return {locator,evaluate,send,detach,async close(){await detach();await cdp.send('Target.closeTarget',{targetId}).catch(()=>{});await until(async()=>!(await cdp.send('Target.getTargets',{filter:[{}]})).targetInfos.some(t=>t.targetId===targetId),'Popup target did not close');}};
}
