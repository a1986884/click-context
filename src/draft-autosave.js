// Serialize writes, but replace waiting keystrokes with the latest complete value.
// The in-flight value is never canceled: its returned snapshot may be needed by
// the next write to detect conflicts correctly.
export function createDraftAutosave({write,onPending=()=>{},onSaved=()=>{},onError=()=>{}}){
 let pending=null,running=null,revision=0;
 function schedule(value){
  pending={value,revision:++revision};onPending(value);
  if(!running)running=Promise.resolve().then(async()=>{
   try{while(pending){const job=pending;pending=null;try{const result=await write(job.value);if(job.revision===revision)onSaved(result,job.value);}catch(error){if(job.revision===revision)onError(error,job.value);}}}
   finally{running=null;}
  });
  return running;
 }
 async function flush(){while(running)await running;}
 return {schedule,flush};
}
