import {execFileSync} from 'node:child_process';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {containsCredential,isSensitivePath} from './source-audit.mjs';

const git=(root,args,input)=>execFileSync('git',args,{cwd:root,input,maxBuffer:64*1024*1024,stdio:['pipe','pipe','pipe']});
export async function auditHistory({root,reviewedFixtures=[]}){
 const temporary=await mkdtemp(join(tmpdir(),'lextide-history-audit-'));
 const report={scope:'all locally reachable commits and embedded Git bundles; not ignored files or remote unfetched refs',status:'failed',repositories:[],findings:[],reviewedFixtures:[],binaryExcluded:0,textBlobs:0};
 const bundles=new Set();let bundleIndex=0;
 async function scan(repository,scope){
  if(git(repository,['rev-parse','--is-shallow-repository']).toString().trim()!=='false')throw Error('shallow-history');
  const commits=git(repository,['rev-list','--all']).toString().trim().split('\n').filter(Boolean),blobs=new Map();
  if(!commits.length)throw Error('no-reachable-commits');
  for(const commit of commits){
   for(const record of git(repository,['ls-tree','-rz','--full-tree',commit]).toString().split('\0').filter(Boolean)){
    const tab=record.indexOf('\t'),[mode,type,object]=record.slice(0,tab).split(' '),path=record.slice(tab+1);
    if(type!=='blob')continue;
    if(!blobs.has(object))blobs.set(object,{paths:new Set(),symlink:false});
    const item=blobs.get(object);item.paths.add(path);item.symlink ||= mode==='120000';
   }
  }
  report.repositories.push({scope,commits:commits.length,uniqueBlobs:blobs.size});
  const readable=[];
  for(const [object,item] of blobs){
   const paths=[...item.paths].sort();let blocked=false;
   for(const path of paths)if(isSensitivePath(path)){report.findings.push({scope,object,path,reason:'sensitive-path'});blocked=true;}
   if(item.symlink){report.findings.push({scope,object,paths,reason:'symlink'});blocked=true;}
   if(!blocked)readable.push(object);
  }
  if(!readable.length)return;
  const data=git(repository,['cat-file','--batch'],Buffer.from(readable.join('\n')+'\n'));let offset=0;
  for(const expected of readable){
   const end=data.indexOf(10,offset);if(end<0)throw Error('invalid-object-stream');
   const [object,type,sizeText]=data.subarray(offset,end).toString().split(' '),size=Number(sizeText),start=end+1;
   if(object!==expected||type!=='blob'||!Number.isSafeInteger(size)||size<0||start+size>=data.length)throw Error('invalid-object-stream');
   const bytes=data.subarray(start,start+size);offset=start+size+1;const paths=[...blobs.get(object).paths].sort();
   if(bytes.subarray(0,20).toString().startsWith('# v2 git bundle')||bytes.subarray(0,20).toString().startsWith('# v3 git bundle')){
    if(bundles.has(object))continue;bundles.add(object);if(bundles.size>8)throw Error('nested-bundle-limit');
    const id=bundleIndex++,file=join(temporary,id+'.bundle'),nested=join(temporary,'repository-'+id);await writeFile(file,bytes);
    git(temporary,['clone','--mirror','--quiet',file,nested]);await scan(nested,scope+'/bundle:'+object);continue;
   }
   if(bytes.includes(0)){report.binaryExcluded++;continue;}
   report.textBlobs++;
   if(containsCredential(bytes.toString('utf8'))){
    const finding={scope,object,paths,reason:'credential-pattern'};
    const reviewed=reviewedFixtures.find(x=>x.object===object&&JSON.stringify(x.paths)===JSON.stringify(paths)&&typeof x.reason==='string'&&x.reason.length>0);
    if(reviewed)report.reviewedFixtures.push({...finding,review:reviewed.reason});else report.findings.push(finding);
   }
  }
 }
 try{await scan(root,'root');report.status=report.findings.length?'failed':'passed';return report;}
 finally{await rm(temporary,{recursive:true,force:true});}
}
