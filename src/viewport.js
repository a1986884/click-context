/** Layout coordinates of Safari's visible viewport, including pinch zoom and browser UI. */
export function visibleViewport(win){
 const v=win.visualViewport;
 return {left:v?.offsetLeft||0,top:v?.offsetTop||0,width:v?.width||win.innerWidth,height:v?.height||win.innerHeight};
}
export function dictionaryBounds(view,x,y,height=300){
 const margin=12,width=Math.max(1,Math.min(352,view.width-2*margin));
 const left=view.left+margin,right=view.left+view.width-margin,top=view.top+margin,bottom=view.top+view.height-margin;
 const below=Math.max(0,bottom-y-24),above=Math.max(0,y-top-24),maxHeight=Math.max(1,Math.min(440,view.height-2*margin,Math.max(below,above,100)));
 const h=Math.min(height,maxHeight),preferred=below>=h||below>=above?y+24:y-h-24;
 const placedTop=Math.max(top,Math.min(preferred,bottom-h));
 return {width,maxHeight:Math.max(1,Math.min(maxHeight,bottom-placedTop)),left:Math.max(left,Math.min(x-width/2,right-width)),top:placedTop};
}
export function movableBounds(view,x,y,width,height){
 const margin=12,left=view.left+margin,top=view.top+margin;
 return {left:Math.max(left,Math.min(x,view.left+view.width-margin-width)),top:Math.max(top,Math.min(y,view.top+view.height-margin-height))};
}

/** Keep auxiliary panels inside the visible area when a keyboard or zoom reduces it. */
export function auxiliaryPanelBounds(view,layoutHeight){
 if(!Number.isFinite(view.height)||view.height<=0||!Number.isFinite(layoutHeight)||layoutHeight<=0)return null;
 const reduced=view.height<240||view.height<=layoutHeight-120,gap=reduced?12:86;
 return {bottom:Math.max(0,layoutHeight-view.top-view.height)+gap,maxHeight:Math.max(1,view.height-(reduced?24:120))};
}
