// Parser-side DOM projection. Extractors receive only this four-member interface;
// no parser-specific node mutation, parent links or cloning reaches that layer.
export function dictionaryDocumentView(document,{stripLabels=false}={}){
 const wrappers=new WeakMap(),inert='script,style,iframe,noscript,template';
 function wrap(node){
  if(!node)return null;if(wrappers.has(node))return wrappers.get(node);
  const query=selector=>[...node.querySelectorAll(selector)].filter(item=>!item.closest?.(inert));
  const view={
   querySelector:selector=>wrap(query(selector)[0]),
   querySelectorAll:selector=>query(selector).map(wrap),
   get textContent(){
    const copy=node.cloneNode(true);
    for(const item of copy.querySelectorAll(inert))item.remove();
    // Label text remains queryable through its own node; definition paragraphs
    // expose precisely the former clone-with-labels-removed text, in DOM order.
    if(stripLabels&&node.localName?.toLowerCase()==='p'&&node.closest('.collinsMajorTrans')?.querySelector('p')===node)for(const item of copy.querySelectorAll('.additional,.collinsOrder'))item.remove();
    return copy.textContent;
   },
   getAttribute:name=>node.getAttribute?.(name)??null
  };wrappers.set(node,view);return view;
 }
 return wrap(document);
}
