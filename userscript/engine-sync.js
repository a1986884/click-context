// Only the privileged GM configuration key is observed. Callback payloads may
// contain keys; ignore them and reread through the validated repository.
const ENGINE_KEY='click-context:v1:engines';
export function createEngineSettingsSync({addListener,removeListener,engines,onChange=()=>{}}){
 let session=null;
 const remove=id=>{try{Promise.resolve(removeListener(id)).catch(()=>{});}catch{/* Optional manager cleanup must not break reading. */}};
 function refresh(token){
  if(session!==token)return;
  const job=engines.refresh();if(token.job===job)return;token.job=job;
  const notify=()=>{if(session===token)return onChange(engines.publicSettings());};
  // Failed reads expose unreadable descriptors, never defaults. Errors and
  // callback payloads are deliberately not printed or copied to the page.
  void job.then(notify,notify).catch(()=>{});
 }
 function start({refreshNow=false}={}){
  if(session)return;
  const token={id:null,registered:false,job:null};session=token;
  if(typeof addListener==='function'&&typeof removeListener==='function'){
   try{const result=addListener(ENGINE_KEY,(key,_old,_next,remote)=>{if(key===ENGINE_KEY&&remote===true)refresh(token);});
    Promise.resolve(result).then(id=>{if(id===undefined||id===null)return;if(session!==token)remove(id);else{token.id=id;token.registered=true;}},()=>{});
   }catch{/* No listener capability: existing explicit settings reads remain. */}
  }
  if(refreshNow)refresh(token);
 }
 function stop(){const old=session;session=null;if(old?.registered)remove(old.id);}
 return {start,stop};
}
