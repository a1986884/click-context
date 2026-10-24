// Retain public module-load outcomes without storing source bodies or URL queries.
export function observePreviewModules(page,previewURL,report){
 const origin=new URL(previewURL).origin;
 report.moduleResponses=[];report.moduleNetworkFailures=[];
 const path=url=>{const parsed=new URL(url);return parsed.origin===origin&&parsed.pathname.endsWith('.js')?parsed.pathname:null;};
 page.on('response',response=>{const modulePath=path(response.url());if(modulePath)report.moduleResponses.push({path:modulePath,httpStatus:response.status(),contentType:response.headers()['content-type']||null});});
 page.on('requestfailed',request=>{const modulePath=path(request.url());if(modulePath)report.moduleNetworkFailures.push({path:modulePath,error:request.failure()?.errorText||'Network failure'});});
}
