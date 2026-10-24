import {nativeVerdict,offscreenVerdict} from '../scripts/native-acceptance.mjs';
export {nativeVerdict,offscreenVerdict};
// Private source distribution and result collection, not a browser runner or proxy.
const json=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
async function authorised(request,secret){
 if(!secret)return false;
 const supplied=request.headers.get('Authorization')||'';
 const digest=text=>crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
 const [a,b]=await Promise.all([digest(supplied),digest('Bearer '+secret)]);
 if(typeof crypto.subtle.timingSafeEqual==='function')return crypto.subtle.timingSafeEqual(a,b);
 let difference=0;const aa=new Uint8Array(a),bb=new Uint8Array(b);for(let i=0;i<aa.length;i++)difference|=aa[i]^bb[i];return difference===0;
}
async function boundedJSON(request){
 const reader=request.body?.getReader();if(!reader)throw Error('Missing report');
 const chunks=[];let size=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>128*1024)throw Error('Report exceeds 128 KiB');chunks.push(value);}}
 finally{void reader.cancel().catch(()=>{});}
 const bytes=new Uint8Array(size);let at=0;for(const value of chunks){bytes.set(value,at);at+=value.length;}return JSON.parse(new TextDecoder().decode(bytes));
}
export function createCloudQA({manifest,bundle}){
 return {async fetch(request,env){
  const path=new URL(request.url).pathname;
  if(path==='/health'&&request.method==='GET')return json({ok:true,role:'private notebook test bridge',version:manifest.version,sourceCommit:manifest.sourceCommit});
  if(!await authorised(request,env.QA_TOKEN))return json({error:'Private test endpoint'},401);
  if(request.method==='GET'&&path==='/manifest')return json(manifest);
  if(request.method==='GET'&&path==='/bundle')return new Response(Uint8Array.from(atob(bundle),c=>c.charCodeAt(0)),{headers:{'Content-Type':'application/zip','Cache-Control':'no-store'}});
  if(request.method==='GET'&&path==='/latest'){
   const report=await env.QA_STORE.get('latest','json');
   if(!report||report.sourceCommit!==manifest.sourceCommit)return json({status:'waiting_for_notebook',version:manifest.version,nativeAcceptancePassed:false,...(report?{previousRun:{sourceCommit:report.sourceCommit,status:report.status,receivedAt:report.receivedAt}}:{})});
   return json({...report,nativeAcceptancePassed:report.status==='finished'&&report.exitCode===0&&nativeVerdict(report.nativeReport,manifest,report.offscreenReport)});
  }
  if(request.method==='POST'&&path==='/report'){
   let data;try{data=await boundedJSON(request);}catch(error){return json({error:error.message},400);}
   if(data.sourceCommit!==manifest.sourceCommit||!['preparing','running','finished','error'].includes(data.status))return json({error:'Invalid source or report state'},400);
   const accepted={...data,receivedAt:new Date().toISOString(),nativeAcceptancePassed:data.status==='finished'&&data.exitCode===0&&nativeVerdict(data.nativeReport,manifest,data.offscreenReport)};
   await env.QA_STORE.put('latest',JSON.stringify(accepted),{expirationTtl:7*24*3600});return json({ok:true,nativeAcceptancePassed:accepted.nativeAcceptancePassed});
  }
  return json({error:'Not found'},404);
 }};
}
