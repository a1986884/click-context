/** @typedef {'original'|'bilingual'|'translated'} ReadingMode
 * @typedef {{type:'control',tabId:number,action:'get'|'enable'|'disable'|'prefs'|'settings'|'exclude'|'revoke'|'forget'|'pause',prefs?:object,remember?:boolean,value?:boolean}} ControlMessage
 * @typedef {{type:'lookup'|'translate',text:string,online:boolean,requestId:string}} QueryMessage
 * Replies: {ok:true,data:unknown} | {ok:false,error:string,retryable?:boolean}.
 * Content sender identity is provided by Chrome; UI requires our extension URL.
 */
export const MODES=['original','bilingual','translated'];
export function cleanBubblePosition(p){return p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1?{x:p.x,y:p.y}:null;}
export function cleanPrefs(p={}){const result={};if(!p||typeof p!=='object')return result;if(MODES.includes(p.mode))result.mode=p.mode;for(const k of ['enabled','words','online'])if(typeof p[k]==='boolean')result[k]=p[k];if(['left','right'].includes(p.side))result.side=p.side;if(['paragraph','sentence'].includes(p.translationUnit))result.translationUnit=p.translationUnit;if(p.bubblePosition===null||cleanBubblePosition(p.bubblePosition))result.bubblePosition=cleanBubblePosition(p.bubblePosition);return result;}
export function pageInfo(url=''){
 try{const u=new URL(url);if(!['http:','https:'].includes(u.protocol)||u.username||u.password||['chromewebstore.google.com','chrome.google.com'].includes(u.hostname)&&/webstore|chromewebstore/.test(u.href)||/\.pdf(?:$|[?#])/i.test(u.href))return {supported:false,reason:'此页面不支持扩展（内部页面、商店、PDF 或受限地址）'};
 return {supported:true,origin:u.origin,hostname:u.hostname,pattern:u.origin+'/*',sensitive:/\/(?:log-?in|sign-?in|sign-?up|auth|account|checkout|payment|billing)(?:[/.?]|$)/i.test(u.pathname),path:u.pathname};
 }catch{return {supported:false,reason:'无法取得当前网页地址，请从网页工具栏打开扩展'};}
}
export function validRequest(m){return typeof m?.requestId==='string'&&/^[\w-]{1,80}$/.test(m.requestId)&&typeof m.text==='string'&&m.text.length>0&&m.text.length<=(m.type==='lookup'?100:m.type==='selection'?2000:20000);}
