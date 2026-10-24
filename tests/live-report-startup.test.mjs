import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
// An intentionally absent executable must replace an old passed report without
// launching a browser, contacting a provider, or changing managed policies.
for(const name of ['api','reader','conditions'])test(`live ${name}: startup failure replaces stale passed evidence`,async()=>{
 const cwd=await mkdtemp(join(tmpdir(),'lextide-live-startup-'));
 try{
  await mkdir(join(cwd,'test-results'));
  const target=join(cwd,'test-results',`live-translation-${name}.json`);
  await writeFile(target,JSON.stringify({status:'passed',staleSentinel:true}));
  const started=Date.now(),result=spawnSync(process.execPath,[fileURLToPath(new URL(`./live/translation-${name}.mjs`,import.meta.url))],{cwd,env:{...process.env,CHROMIUM_EXECUTABLE_PATH:join(cwd,'absent-chromium')},encoding:'utf8',timeout:15000});
  assert.equal(result.error,undefined);assert.equal(result.status,1);
  const report=JSON.parse(await readFile(target,'utf8'));
  assert.equal(report.status,'failed');assert.equal(report.staleSentinel,undefined);
  assert.equal(report.version,null);assert.equal(report.previewVerified,false);assert.equal(report.previewCommitVerified,false);
  assert.equal(report.activePhase,'browser-launch');assert.equal(report.nativeExtensionInstalled,false);
  assert.ok(Date.parse(report.startedAt)>=started);assert.ok(Date.parse(report.finishedAt)>=Date.parse(report.startedAt));
  assert.match(report.error,/executable doesn't exist/i);assert.ok(report.localVersion);
  assert.deepEqual(name==='reader'?report.phases:report.samples,[]);
 }finally{await rm(cwd,{recursive:true,force:true});}
});

test('live word context: startup failure replaces stale passed evidence',async()=>{
 const cwd=await mkdtemp(join(tmpdir(),'lextide-word-startup-'));
 try{
  await mkdir(join(cwd,'test-results'));const target=join(cwd,'test-results','live-reader-context.json');
  await writeFile(target,JSON.stringify({status:'passed',staleSentinel:true}));
  const started=Date.now(),result=spawnSync(process.execPath,[fileURLToPath(new URL('./live/reader-context.mjs',import.meta.url))],{cwd,env:{...process.env,CHROMIUM_EXECUTABLE_PATH:join(cwd,'absent-chromium')},encoding:'utf8',timeout:15000});
  assert.equal(result.error,undefined);assert.equal(result.status,1);
  const report=JSON.parse(await readFile(target,'utf8'));assert.equal(report.status,'failed');assert.equal(report.staleSentinel,undefined);
  assert.equal(report.activePhase,'browser-launch');assert.equal(report.published,false);assert.equal(report.nativeExtensionInstalled,false);
  assert.ok(Date.parse(report.startedAt)>=started);assert.ok(Date.parse(report.finishedAt)>=Date.parse(report.startedAt));assert.match(report.error,/executable doesn't exist/i);
  assert.deepEqual(report.samples,[]);assert.deepEqual(report.contextInputs,[]);assert.deepEqual(report.dictionaryEntries,[]);assert.deepEqual(report.dictionaryResponses,[]);
 }finally{await rm(cwd,{recursive:true,force:true});}
});
