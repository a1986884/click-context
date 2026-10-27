import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {auditHistory} from '../scripts/source-history.mjs';

test('history audit scans incremental bundles using prerequisite objects from containing repository',async()=>{
 const root=await mkdtemp(join(tmpdir(),'incremental-bundle-test-'));
 const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
 const commit=message=>git('-c','user.name=Test','-c','user.email=test@example.com','commit','-qm',message);
 try{
  git('init','-q');await writeFile(join(root,'example.txt'),'base\n');git('add','.');commit('base');
  const base=git('rev-parse','HEAD');
  await writeFile(join(root,'example.txt'),'candidate\n');git('add','.');commit('candidate');
  git('bundle','create','candidate.bundle',base+'..HEAD');
  git('add','candidate.bundle');commit('preserve incremental history');
  const report=await auditHistory({root});
  assert.equal(report.status,'passed');
  assert.equal(report.repositories.length,2);
  assert.equal(report.repositories[1].commits,2);
 }finally{await rm(root,{recursive:true,force:true});}
});
