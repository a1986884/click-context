import {nativeVerdict} from './native-acceptance.mjs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readdir,readFile} from 'node:fs/promises';
import {join} from 'node:path';

// Identify the actual unpacked files, including their paths, independently of Git.
export async function extensionFingerprint(root){
 const hash=createHash('sha256');
 async function visit(dir,relative=''){
  const entries=await readdir(dir,{withFileTypes:true});
  entries.sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0);
  for(const entry of entries){
   const path=relative?relative+'/'+entry.name:entry.name;
   if(entry.isDirectory())await visit(join(dir,entry.name),path);
   else if(entry.isFile()){
    const bytes=await readFile(join(dir,entry.name));
    hash.update(JSON.stringify([path,bytes.length])+'\n');hash.update(bytes);
   }else throw Error('Unsupported extension resource: '+path);
  }
 }
 await visit(root);return hash.digest('hex');
}

export function matchesBuild(report,{fingerprint,version}){
 return /^[a-f0-9]{64}$/.test(fingerprint)&&report?.extensionFingerprint===fingerprint&&report.extensionVersion===version;
}

// A source ZIP has no Git history. Never invent clean provenance for an archive
// or attach an unrelated parent repository's HEAD to an untracked project.
export function sourceState({cwd=process.cwd(),env=process.env}={}){
 const supplied=[env.RELEASE_COMMIT,env.CI_COMMIT_SHA,env.GITHUB_SHA].find(value=>typeof value==='string'&&/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(value));
 const unknown={commit:supplied||'unknown',dirty:null};
 try{
  const git=args=>execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();
  git(['ls-files','--error-unmatch','package.json']);
  return {commit:git(['rev-parse','HEAD']),dirty:Boolean(git(['status','--porcelain']))};
 }catch{return unknown;}
}

export function nativeEvidence(report,offscreen,{fingerprint,version}){
 const expected={fingerprint,version},extensionMatches=matchesBuild(report,expected),offscreenMatches=matchesBuild(offscreen,expected);
 return {extensionTests:extensionMatches?report.status:'not run for this build',offscreenTests:offscreenMatches?offscreen.status:'not run for this build',nativeAcceptancePassed:extensionMatches&&offscreenMatches&&nativeVerdict(report,{version,extensionFingerprint:fingerprint,dictionaryProvider:'youdao-collins-public-page'},offscreen)};
}
