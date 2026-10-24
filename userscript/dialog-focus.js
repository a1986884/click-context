// Keyboard focus stays inside the active closed-shadow dialog. No input values
// are read; the opener is retained only as an element reference.
export function createDialogFocus({host,root,initialFocus,onEscape,fallbackFocus=()=>null}){
 let active=false,opener=null;
 const visible=element=>Boolean(element?.isConnected&&typeof element.focus==='function'&&element.getClientRects().length&&!element.matches(':disabled')&&getComputedStyle(element).visibility!=='hidden');
 const controls=()=>[...root.querySelectorAll('button,input,select,textarea,a[href],[tabindex]')].filter(element=>element.tabIndex>=0&&visible(element));
 function pageFocus(){let element=document.activeElement;while(element?.shadowRoot?.activeElement)element=element.shadowRoot.activeElement;return element;}
 function open(){if(!active)opener=pageFocus();active=true;document.addEventListener('keydown',keydown,true);const first=initialFocus?.()||controls()[0];if(visible(first))first.focus();}
 function close({restoreFocus=true}={}){if(!active)return;active=false;document.removeEventListener('keydown',keydown,true);const previous=opener;opener=null;if(!restoreFocus)return;const target=visible(previous)&&previous.tabIndex>=0?previous:fallbackFocus();if(visible(target))target.focus({preventScroll:true});}
 function keydown(event){
  if(!active||host.hidden||event.defaultPrevented)return;
  if(event.key==='Escape'&&onEscape){event.preventDefault();event.stopImmediatePropagation();onEscape();return;}
  if(event.key!=='Tab'||event.altKey||event.ctrlKey||event.metaKey)return;
  const available=controls(),at=available.indexOf(root.activeElement);
  if(!available.length)return;
  if(event.shiftKey?at<=0:at<0||at===available.length-1){event.preventDefault();available[event.shiftKey?available.length-1:0].focus();}
 }
 return {open,close,destroy(){close({restoreFocus:false});}};
}
