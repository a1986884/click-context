import {lstat,readFile} from 'node:fs/promises';
import {isAbsolute,resolve,sep} from 'node:path';

// Deliberately finite patterns. Findings contain paths/categories, never excerpts.
const credentialPattern=/(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|glpat-[A-Za-z0-9_-]{20,}|AKIA[A-Z0-9]{16}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/;
const configuredSecret=/(?:api[_-]?(?:key|token)|access[_-]?token|qa[_-]?token|client[_-]?secret|authorization)["']?[ \t]*[=:][ \t]*["']?(?:Bearer[ \t]+)?([A-Za-z0-9_./+\-=]{20,})/gi;
const sensitivePath=/(?:^|\/)(?:\.env(?:\..+)?|\.dev\.vars(?:\..+)?|(?:secret|secrets|credentials)\.json|id_(?:rsa|ecdsa|ed25519)|[^/]+\.(?:pem|key|p12|pfx))$/i;
const examplePath=/(?:^|\/)(?:\.env|\.dev\.vars)\.example$/;
export function containsCredential(text){
 if(credentialPattern.test(text))return true;
 for(const match of text.matchAll(configuredSecret)){
  if(!/^(?:YOUR[_-]|REPLACE[_-]|EXAMPLE[_-]|PLACEHOLDER|CHANGEME)/i.test(match[1]))return true;
 }
 return false;
}
export const isSensitivePath=path=>sensitivePath.test(path)&&!examplePath.test(path);
export async function auditSource({root,paths}){
 const base=resolve(root),result={scanned:0,binaryExcluded:0,findings:[]};
 for(const path of new Set(paths)){
  const finding=reason=>result.findings.push({path,reason});
  const target=resolve(base,path);
  if(isAbsolute(path)||path.split(/[\\/]/).includes('..')||!target.startsWith(base+sep)){finding('unsafe-path');continue;}
  if(isSensitivePath(path)){finding('sensitive-path');continue;}
  try{
   // Check every component so a nested directory symlink cannot escape the root.
   let cursor=base,linked=false;
   for(const part of path.split('/')){cursor=resolve(cursor,part);if((await lstat(cursor)).isSymbolicLink()){linked=true;break;}}
   if(linked){finding('symlink');continue;}
   const bytes=await readFile(target);
   if(bytes.includes(0)){result.binaryExcluded++;continue;}
   result.scanned++;if(containsCredential(bytes.toString('utf8')))finding('credential-pattern');
  }catch{finding('unreadable');}
 }
 return result;
}
