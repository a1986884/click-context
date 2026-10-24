import {phraseLemma} from './phrases.js';
import {collinsQuery} from './collins-sources.js';
import {resolveForm} from './morphology.js';
// Candidate cache only: sentences and selected senses never enter shared storage.
// Persist LRU order separately: a cache hit must not renew its TTL timestamp.
const PREFIX='dict:',ORDER_KEY='dict:lru';
// Missing entries must remain retryable even when an older transport omits partial.
const cacheable=value=>Boolean(value)&&value.partial!==true&&value.kind!=='unavailable'&&(!Array.isArray(value.senses)||value.senses.length>0);
const dictionaryKey=key=>key.startsWith(PREFIX+'session:')||key.startsWith(PREFIX+'anonymous:');
// The ordinary website preview has no extension storage API.
function memoryStorage(){const data={};return {
 async get(){return structuredClone(data);},
 async set(values){Object.assign(data,structuredClone(values));},
 async remove(keys){for(const key of Array.isArray(keys)?keys:[keys])delete data[key];}
};}
export function cacheWordLookup(lookup,{maxEntries=32,ttlMs=10*60*1000,now=Date.now,storage=globalThis.browser?.storage?.session??globalThis.chrome?.storage?.session}={}){
 storage??=memoryStorage();
 const pending=new Map();let queue=Promise.resolve();
 const serial=fn=>{const result=queue.then(fn);queue=result.catch(()=>{});return result;};
 async function snapshot(){
  const data=await storage.get(null),keys=Object.keys(data).filter(dictionaryKey);
  const valid=key=>Number.isFinite(data[key]?.at)&&cacheable(data[key]?.value)&&now()-data[key].at<ttlMs;
  const recorded=Array.isArray(data[ORDER_KEY])?data[ORDER_KEY].filter(key=>typeof key==='string'&&dictionaryKey(key)&&keys.includes(key)):[];
  const order=[...new Set([...recorded,...keys.sort((a,b)=>(data[a]?.at||0)-(data[b]?.at||0))])].filter(valid);
  while(order.length>maxEntries)order.shift();
  const removed=keys.filter(key=>!order.includes(key));if(removed.length)await storage.remove(removed);
  return {data,order};
 }
 const read=key=>serial(async()=>{
  const {data,order}=await snapshot(),hit=order.includes(key)?data[key]:null;
  await storage.set({[ORDER_KEY]:hit?[...order.filter(item=>item!==key),key]:order});
  return hit;
 }).catch(()=>null);
 const write=(key,value,signal)=>serial(async()=>{
  const {order}=await snapshot();signal.throwIfAborted();if(maxEntries<1)return;
  const next=[...order.filter(item=>item!==key),key],removed=[];
  while(next.length>maxEntries)removed.push(next.shift());
  if(removed.length)await storage.remove(removed);signal.throwIfAborted();
  await storage.set({[key]:{at:now(),value:structuredClone(value)},[ORDER_KEY]:next});
  // Chrome storage writes cannot be aborted; remove a result cancelled mid-write.
  if(signal.aborted){await storage.remove(key);await storage.set({[ORDER_KEY]:next.filter(item=>item!==key)});}
 }).catch(()=>{});
 const clear=()=>serial(async()=>{
  const data=await storage.get(null);await storage.remove([...Object.keys(data).filter(dictionaryKey),ORDER_KEY]);
 }).catch(()=>{});
 const forCaller=(value,word)=>({...structuredClone(value),original:word,morphology:value.phraseSource?value.morphology:word.includes(' ')&&phraseLemma(word)!==String(word).toLowerCase()?'短语词形：'+word+' → '+phraseLemma(word)+'；按完整原形查询 Collins。':word.includes(' ')?'按完整短语查询 Collins。':value.morphology||resolveForm(String(word).toLowerCase()).note});
 return async function(word,options={}){
  options.signal?.throwIfAborted();
  if(options.online!==true){
   await clear();
   // An offline caller must not cancel another tab's authorized subscription.
   return lookup(word,options);
  }
  const key=PREFIX+(options.useSession===true?'session:':'anonymous:')+phraseLemma(collinsQuery(word));
  let job=pending.get(key);
  if(!job){
   const controller=new AbortController();job={controller,users:new Set(),word};pending.set(key,job);
   const current=job;
   // Each subscriber owns its cancellation, independently of the source request.
   job.promise=Promise.resolve().then(async()=>{
    controller.signal.throwIfAborted();const hit=await read(key);controller.signal.throwIfAborted();
    if(hit){current.cached=true;return hit.value;}
    const value=await lookup(word,{...options,signal:controller.signal});controller.signal.throwIfAborted();
    if(cacheable(value)&&pending.get(key)===current)await write(key,value,controller.signal);
    controller.signal.throwIfAborted();return value;
   }).finally(()=>{if(pending.get(key)===current)pending.delete(key);});
  }
  const current=job,signal=options.signal,user={};current.users.add(user);
  return new Promise((resolve,reject)=>{
   let finished=false;
   const finish=(fn,value)=>{if(finished)return;finished=true;signal?.removeEventListener('abort',cancel);current.users.delete(user);fn(value);};
   const cancel=()=>{
    finish(reject,signal.reason??new DOMException('Lookup cancelled','AbortError'));
    if(!current.users.size){if(pending.get(key)===current)pending.delete(key);current.controller.abort();}
   };
   signal?.addEventListener('abort',cancel,{once:true});
   // Observe late failures too, even if all subscribers have already cancelled.
   current.promise.then(value=>{if(finished)return;try{finish(resolve,!current.cached&&word===current.word?structuredClone(value):forCaller(value,word));}catch(error){finish(reject,error);}},error=>finish(reject,error));
   if(signal?.aborted)cancel();
  });
 };
}
