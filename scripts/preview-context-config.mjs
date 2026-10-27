export const DEFAULT_PREVIEW_CONTEXT_ORIGIN='https://lextide-context.aa1986884.workers.dev';
export function previewContextEndpoint(value){
 if(value===undefined||value==='')return null;
 let url;try{url=new URL(value);}catch{throw Error('Invalid preview context endpoint');}
 if(url.protocol!=='https:'||url.username||url.password||url.port||!/^[-a-z0-9]+\.[-a-z0-9]+\.workers\.dev$/.test(url.hostname)||url.pathname!=='/meaning'||url.search||url.hash)throw Error('Preview context endpoint must be a public HTTPS Workers /meaning URL');
 return url.href;
}
export function previewConnectOrigins(origin){
 if(!origin||origin===DEFAULT_PREVIEW_CONTEXT_ORIGIN)return DEFAULT_PREVIEW_CONTEXT_ORIGIN;
 const endpoint=previewContextEndpoint(origin+'/meaning');
 if(new URL(endpoint).origin!==origin)throw Error('Invalid preview context origin');
 return DEFAULT_PREVIEW_CONTEXT_ORIGIN+' '+origin;
}
export function configurePreviewContextFiles(files,{endpoint,candidateVersion}){
 const canonical=previewContextEndpoint(endpoint);if(!canonical)return {contextOrigin:undefined,contextEndpoint:undefined};
 if(!/^\d+\.\d+\.\d+$/.test(candidateVersion))throw Error('Invalid preview candidate version');
 const origin=new URL(canonical).origin,connect=previewConnectOrigins(origin);
 for(const path of ['/index.html','/mobile-reader.html']){
  const file=files[path];if(!file)continue;
  let html=Buffer.from(file.base64,'base64').toString('utf8');
  html=html.replaceAll(DEFAULT_PREVIEW_CONTEXT_ORIGIN,connect).replace('<head>','<head><meta name="click-context-candidate-version" content="'+candidateVersion+'"><meta name="click-context-endpoint" content="'+canonical+'">').replace(/<body(?:\s[^>]*)?>/i,tag=>tag+'<p class="preview-banner" role="note">释义准确度测试 · '+candidateVersion+'（候选）</p>');
  files[path]={...file,base64:Buffer.from(html).toString('base64')};
 }
 return {contextOrigin:origin,contextEndpoint:canonical};
}
