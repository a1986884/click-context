import {DEFAULT_ENGINE_SETTINGS,normalizeEngineSettings} from './engine-profiles.js';
const storageError=()=>Object.assign(Error('无法读取或保存引擎配置，未重置已有设置'),{code:'ENGINE_STORAGE',retryable:false});
export function createEngineRepository(adapter){
 let queue=Promise.resolve();
 async function read(){
  try{const state=await adapter.get();if(state==null)return structuredClone(DEFAULT_ENGINE_SETTINGS);
   if(state.schema!==1||!Array.isArray(state.profiles)||state.profiles.some(p=>typeof p.cacheRevision!=='string'||!/^[\da-f-]{36}$/i.test(p.cacheRevision)))throw storageError();
   return normalizeEngineSettings(state,state);
  }catch{throw storageError();}
 }
 // Optional policy checks run synchronously against the fresh record before
 // persistence. Callers without a check retain the existing write timing.
 return {read,save(input,{onCommit,beforeWrite}={}){const job=queue.then(async()=>{const previous=await read(),state=normalizeEngineSettings(input,previous);beforeWrite?.(state,previous);try{await adapter.set(state);}catch{throw storageError();}onCommit?.(state,previous);return state;});queue=job.catch(()=>{});return job;}};
}
export function createEngineVault(indexedDB=globalThis.indexedDB){
 let opening;
 const database=()=>opening||=(new Promise((resolve,reject)=>{
  if(!indexedDB){reject(storageError());return;}
  const request=indexedDB.open('lextide-engine-settings',1);
  request.onupgradeneeded=()=>request.result.createObjectStore('settings');
  request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>{db.close();opening=null;};resolve(db);};
  request.onerror=()=>{opening=null;reject(storageError());};request.onblocked=()=>{opening=null;reject(storageError());};
 }));
 const access=async(mode,value)=>{
  const db=await database();return new Promise((resolve,reject)=>{
   const transaction=db.transaction('settings',mode),store=transaction.objectStore('settings');
   const request=mode==='readonly'?store.get('active'):store.put(value,'active');let result;
   request.onsuccess=()=>{result=request.result;};
   transaction.oncomplete=()=>resolve(result);transaction.onerror=transaction.onabort=()=>reject(storageError());
  });
 };
 return createEngineRepository({get:()=>access('readonly'),set:value=>access('readwrite',value)});
}
