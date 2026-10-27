import {lookupCollinsBilingual as lookupCollins} from '../src/collins-bilingual.js';
import {previewConnectOrigins} from './preview-context-config.mjs';
// Small, temporary Pages previews can carry their public files in a Worker.
// Normal production output remains static dist/; this handler needs no bindings.
export function createPreviewWorker(files,{dictionary=lookupCollins,contextOrigin}={}){
 const policy="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' "+previewConnectOrigins(contextOrigin)+"; frame-ancestors 'none'; base-uri 'self'; object-src 'none'";
 return {async fetch(request){
  const headers=new Headers({'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':policy});
  if(!['GET','HEAD'].includes(request.method)){headers.set('Allow','GET, HEAD');return new Response('Method not allowed',{status:405,headers});}
  let path;try{path=decodeURIComponent(new URL(request.url).pathname);}catch{return new Response('Bad request',{status:400,headers});}
  if(path==='/api/dictionary'){
   if(request.method==='HEAD')return new Response(null,{status:405,headers});
   headers.set('Content-Type','application/json; charset=utf-8');
   try{const result=await dictionary(new URL(request.url).searchParams.get('word')||'',{online:true,signal:request.signal});return new Response(JSON.stringify({ok:true,data:result}),{headers});}
   catch(error){return new Response(JSON.stringify({ok:false,error:error.message,code:error.code,upstreamStatus:error.upstreamStatus,sourceUrls:error.sourceUrls}),{status:error.code==='INVALID_WORD'?400:error.code==='NOT_FOUND'?404:503,headers});}
  }
  if(path==='/')path='/index.html';
  if(!Object.hasOwn(files,path))return new Response(request.method==='HEAD'?null:'Not found',{status:404,headers});
  const file=files[path];headers.set('Content-Type',file.type);
  const body=Uint8Array.from(atob(file.base64),char=>char.charCodeAt(0));
  headers.set('Content-Length',String(body.length));
  return new Response(request.method==='HEAD'?null:body,{headers});
 }};
}
