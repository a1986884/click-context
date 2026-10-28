export const RELOAD_MESSAGE='语境精读连接已失效，可能是插件刚刚更新。请刷新当前网页后重新启用。';
export function createRuntimeConnection(api,{onInvalidated=()=>{}}={}){
 let expired=false;
 function invalidate(){if(!expired){expired=true;onInvalidated();}return Object.assign(Error(RELOAD_MESSAGE),{code:'EXTENSION_CONTEXT_INVALIDATED',retryable:false});}
 function available(){try{return Boolean(api.runtime.id);}catch{return false;}}
 function check(){if(expired)return false;if(!available()){invalidate();return false;}return true;}
 function error(reason){return expired||!available()||/extension context invalidated/i.test(reason?.message||String(reason))?invalidate():reason;}
 return {check,error,get expired(){return expired;},async send(message){if(!check())throw invalidate();try{return await api.runtime.sendMessage(message);}catch(reason){throw error(reason);}}};
}
export function showReloadNotice({doc=document,reload=()=>globalThis.location.reload()}={}){
 const previous=doc.querySelector('lextide-refresh-notice');if(previous)return previous;
 const host=doc.createElement('lextide-refresh-notice');host.style.cssText='all:initial;position:fixed;left:12px;right:12px;bottom:max(16px,env(safe-area-inset-bottom,0px));z-index:2147483647;display:block';
 const shadow=host.attachShadow({mode:'open'});
 shadow.innerHTML='<style>:host{color-scheme:light}section{box-sizing:border-box;max-width:420px;margin:auto;padding:16px;border:1px solid #cddbd6;border-radius:14px;background:#faf9f5;color:#213b52;box-shadow:0 8px 28px #213b5233;font:15px/1.6 system-ui}p{margin:0 0 12px}button{min-height:44px;margin-right:8px;padding:8px 14px;border:1px solid #abbfb8;border-radius:8px;background:#fff;color:#213b52;cursor:pointer;font:inherit}button:first-of-type{background:#213b52;color:#fff}</style><section role="alert"><p></p><button type="button" id="refresh">刷新当前网页</button><button type="button" id="dismiss">暂不刷新</button></section>';
 shadow.querySelector('p').textContent=RELOAD_MESSAGE;
 shadow.querySelector('#refresh').onclick=reload;shadow.querySelector('#dismiss').onclick=()=>host.remove();doc.body.append(host);return host;
}
