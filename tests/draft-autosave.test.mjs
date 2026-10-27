import {test} from 'node:test';import assert from 'node:assert/strict';import {createDraftAutosave} from '../src/draft-autosave.js';
const tick=()=>new Promise(r=>setImmediate(r));
test('slow storage writes the in-flight text followed by only the latest complete input',async()=>{
 const writes=[],saved=[],gates=[];const writer=createDraftAutosave({write:text=>{writes.push(text);return new Promise(resolve=>gates.push(resolve));},onSaved:(_result,text)=>saved.push(text)});
 writer.schedule('开始');await tick();for(let i=1;i<=200;i++)writer.schedule('完整输入 '+i);assert.deepEqual(writes,['开始']);gates.shift()('first snapshot');await tick();assert.deepEqual(writes,['开始','完整输入 200']);assert.deepEqual(saved,[]);gates.shift()('final snapshot');await writer.flush();assert.deepEqual(saved,['完整输入 200']);
});
test('an obsolete failed write does not replace feedback for newer pending input',async()=>{
 let rejectFirst;const errors=[],saved=[],calls=[];const writer=createDraftAutosave({write:text=>{calls.push(text);return calls.length===1?new Promise((_,reject)=>{rejectFirst=reject;}):Promise.resolve(text);},onSaved:(_value,text)=>saved.push(text),onError:e=>errors.push(e.message)});writer.schedule('旧输入');await tick();writer.schedule('新输入');rejectFirst(Error('旧失败'));await writer.flush();assert.deepEqual(calls,['旧输入','新输入']);assert.deepEqual(errors,[]);assert.deepEqual(saved,['新输入']);
});
test('failed latest write reports once and explicit retry can save the identical text',async()=>{
 let fail=true;const saved=[],errors=[];const writer=createDraftAutosave({write:async text=>{if(fail)throw Error('模拟写入失败');return text;},onSaved:value=>saved.push(value),onError:e=>errors.push(e.message)});writer.schedule('保留输入');await writer.flush();assert.deepEqual(errors,['模拟写入失败']);fail=false;writer.schedule('保留输入');await writer.flush();assert.deepEqual(saved,['保留输入']);
});
test('flush waits for input queued during an in-flight write and the next cycle still runs',async()=>{
 const gates=[],calls=[];const writer=createDraftAutosave({write:text=>{calls.push(text);return new Promise(resolve=>gates.push(resolve));}});writer.schedule('一');await tick();let flushed=false;const flushing=writer.flush().then(()=>{flushed=true;});writer.schedule('二');gates.shift()();await tick();assert.equal(flushed,false);gates.shift()();await flushing;writer.schedule('三');await tick();gates.shift()();await writer.flush();assert.deepEqual(calls,['一','二','三']);
});
