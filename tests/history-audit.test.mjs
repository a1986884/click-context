import {test} from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,writeFile,unlink,symlink,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {auditHistory} from '../scripts/source-history.mjs';
const git=(root,args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
const commit=root=>{git(root,['add','-A']);git(root,['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','-c','commit.gpgsign=false','commit','-qm','fixture']);};
async function fixture(run){const root=await mkdtemp(join(tmpdir(),'lextide-history-test-'));try{git(root,['init','-q']);await writeFile(join(root,'public.txt'),'public');await run(root);}finally{await rm(root,{recursive:true,force:true});}}
const fake='x'.repeat(36),config='const api'+'Token = "'+fake+'";';
test('history audit finds credentials deleted from the current tree without disclosing them',()=>fixture(async root=>{
 await writeFile(join(root,'config.js'),config);commit(root);await unlink(join(root,'config.js'));commit(root);
 const result=await auditHistory({root});assert.equal(result.status,'failed');assert.equal(result.findings.length,1);assert.deepEqual(result.findings[0].paths,['config.js']);assert.ok(!JSON.stringify(result).includes(fake));
}));
test('history audit traverses embedded bundles as isolated bare repositories',()=>fixture(async root=>{
 const nested=await mkdtemp(join(tmpdir(),'lextide-inner-history-'));
 try{git(nested,['init','-q']);await writeFile(join(nested,'config.js'),config);commit(nested);git(nested,['bundle','create',join(root,'old.bundle'),'--all']);commit(root);
  const result=await auditHistory({root});assert.equal(result.status,'failed');assert.equal(result.repositories.length,2);assert.match(result.findings[0].scope,/bundle:/);assert.ok(!JSON.stringify(result).includes(fake));
 }finally{await rm(nested,{recursive:true,force:true});}
}));
test('history audit accepts only an exact reviewed blob and complete path set',()=>fixture(async root=>{
 await writeFile(join(root,'config.js'),config);commit(root);const object=git(root,['rev-parse','HEAD:config.js']);
 const reviewedFixtures=[{object,paths:['config.js'],reason:'Original synthetic fixture verified for this object.'}];
 const first=await auditHistory({root,reviewedFixtures});assert.equal(first.status,'passed');assert.equal(first.reviewedFixtures.length,1);
 await writeFile(join(root,'other.js'),config);commit(root);assert.equal((await auditHistory({root,reviewedFixtures})).status,'failed');
}));
test('history audit rejects sensitive historical filenames',()=>fixture(async root=>{
 await writeFile(join(root,'.env'),'synthetic public marker');commit(root);await unlink(join(root,'.env'));commit(root);
 const result=await auditHistory({root});assert.equal(result.status,'failed');assert.equal(result.findings[0].reason,'sensitive-path');assert.equal(result.textBlobs,1);
}));
test('history audit flags symlink objects without following external paths',()=>fixture(async root=>{
 await symlink('/does-not-exist/private',join(root,'linked'));commit(root);const result=await auditHistory({root});assert.equal(result.status,'failed');assert.equal(result.findings[0].reason,'symlink');
}));
test('history audit refuses shallow history rather than returning a complete pass',()=>fixture(async root=>{
 commit(root);await writeFile(join(root,'public.txt'),'changed');commit(root);const shallow=await mkdtemp(join(tmpdir(),'lextide-shallow-test-'));
 try{git(root,['clone','--quiet','--depth=1','file://'+root,shallow]);await assert.rejects(auditHistory({root:shallow}),/shallow-history/);}finally{await rm(shallow,{recursive:true,force:true});}
}));
test('history audit refuses to claim coverage for an empty repository',()=>fixture(async root=>{
 await assert.rejects(auditHistory({root}),/no-reachable-commits/);
}));
