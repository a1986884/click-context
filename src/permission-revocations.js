// Host permissions ignore paths, but explicit ports and scheme boundaries still
// matter. Unknown events/patterns remain conservative. No raw event data is logged.
function originRule(pattern){
 if(pattern==='<all_urls>')return {all:true};
 if(typeof pattern!=='string')return null;
 if(/^file:\/\/\/.*$/u.test(pattern))return {scheme:'file:'};
 const match=/^(\*|https?):\/\/([^/]+)\/.*$/u.exec(pattern);if(!match)return null;
 const authority=match[2],parts=authority.startsWith('[')?/^(\[[\da-f:.]+\])(?::(\*|\d+))?$/iu.exec(authority):/^([^:]+)(?::(\*|\d+))?$/u.exec(authority);if(!parts)return null;
 const port=parts[2]&&parts[2]!=='*'?Number(parts[2]):null;if(port!==null&&(!Number.isInteger(port)||port<0||port>65535))return null;
 const subdomains=parts[1].startsWith('*.'),host=subdomains?parts[1].slice(2):parts[1];let hostname=host;
 if(host!=='*'){try{const u=new URL('https://'+host+'/');if(u.username||u.password||u.port||u.search||u.hash||u.pathname!=='/'||host.includes('*'))return null;hostname=u.hostname;}catch{return null;}}
 return {scheme:match[1]==='*'?'*':match[1]+':',hostname,subdomains,port};
}
export function permissionRemoval(change){
 let unknown=!change||typeof change!=='object'||Array.isArray(change)||Object.keys(change).some(key=>!['origins','permissions'].includes(key)),rules=[];
 if(!unknown){
  if(change.permissions!==undefined&&(!Array.isArray(change.permissions)||change.permissions.some(p=>typeof p!=='string')||change.permissions.includes('activeTab')))unknown=true;
  if(change.origins===undefined){if(!Array.isArray(change.permissions))unknown=true;}
  else if(!Array.isArray(change.origins)||change.origins.length>256)unknown=true;
  else{rules=change.origins.map(originRule);if(rules.some(r=>!r))unknown=true;}
 }
 return {empty:!unknown&&!rules.length,affects(value){
  if(unknown)return true;let url;try{url=new URL(value);}catch{return true;}
  return rules.some(r=>r.all||(r.scheme==='*'?['http:','https:'].includes(url.protocol):r.scheme===url.protocol)&&r.hostname!==undefined&&(r.hostname==='*'||url.hostname===r.hostname||r.subdomains&&url.hostname.endsWith('.'+r.hostname))&&(r.port===null||Number(url.port||(url.protocol==='https:'?443:80))===r.port));
 }};
}
export function createPermissionRevocations(limit=32){
 let revision=0;const events=[];
 return {get revision(){return revision;},record(change){const removal=permissionRemoval(change);if(!removal.empty){events.push({revision:++revision,removal});if(events.length>limit)events.shift();}return removal;},affectsSince(before,url){
  if(before===revision)return false;if(!Number.isInteger(before)||before<revision-events.length||before>revision)return true;
  return events.some(e=>e.revision>before&&e.removal.affects(url));
 }};
}
