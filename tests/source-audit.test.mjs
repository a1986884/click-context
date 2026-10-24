import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,mkdir,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {auditSource} from '../scripts/source-audit.mjs';

async function fixture(run){const root=await mkdtemp(join(tmpdir(),'lextide-audit-'));try{await run(root);}finally{await rm(root,{recursive:true,force:true});}}
test('audit accepts public URLs, license prose and non-secret build hashes',()=>fixture(async root=>{
 await writeFile(join(root,'README.md'),'MIT License\nhttps://example.test/\nSHA256 '+ 'a'.repeat(64));
 const result=await auditSource({root,paths:['README.md']});assert.deepEqual(result.findings,[]);assert.equal(result.scanned,1);
}));
test('audit finds token/private-key patterns without returning credential text',()=>fixture(async root=>{
 const tokens=['gh'+'p_'+'a'.repeat(36),'gl'+'pat-'+'b'.repeat(24),'-----BEGIN '+'PRIVATE KEY-----','AK'+'IA'+'C'.repeat(16)];
 for(let i=0;i<tokens.length;i++)await writeFile(join(root,`${i}.txt`),tokens[i]);
 const result=await auditSource({root,paths:tokens.map((_,i)=>`${i}.txt`)});
 assert.equal(result.findings.length,4);for(const token of tokens)assert.ok(!JSON.stringify(result).includes(token));
}));
test('audit flags configured secrets while accepting explicit empty/example placeholders',()=>fixture(async root=>{
 await writeFile(join(root,'config.js'),'const api'+'Token = "'+'x'.repeat(36)+'";');
 await writeFile(join(root,'.env.example'),'API_TOKEN=\nAPI_KEY=YOUR_API_KEY\n');
 const result=await auditSource({root,paths:['config.js','.env.example']});assert.deepEqual(result.findings,[{path:'config.js',reason:'credential-pattern'}]);
}));
test('audit rejects credential filenames without opening their contents',()=>fixture(async root=>{
 await mkdir(join(root,'secret.json')); // A directory proves the content is not opened.
 const result=await auditSource({root,paths:['secret.json','.env','.env.production','account.p12','id_rsa','credentials.json']});
 assert.equal(result.findings.length,6);assert.ok(result.findings.every(x=>x.reason==='sensitive-path'));assert.equal(result.scanned,0);
}));
test('audit recognizes quoted JSON and bearer header configuration',()=>fixture(async root=>{
 await writeFile(join(root,'config.json'),JSON.stringify({['api'+'Token']:'x'.repeat(36)}));
 await writeFile(join(root,'headers.js'),JSON.stringify({['Author'+'ization']:'Bearer '+'y'.repeat(36)}));
 const result=await auditSource({root,paths:['config.json','headers.js']});assert.equal(result.findings.length,2);assert.ok(result.findings.every(x=>x.reason==='credential-pattern'));
}));
test('audit rejects traversal and absolute paths before filesystem reads',()=>fixture(async root=>{
 const result=await auditSource({root,paths:['../outside.txt','/outside.txt','nested/../../outside.txt']});
 assert.equal(result.findings.length,3);assert.ok(result.findings.every(x=>x.reason==='unsafe-path'));
}));
test('audit never follows a source symlink',()=>fixture(async root=>{
 await symlink('/does-not-exist/private',join(root,'linked.txt'));
 const result=await auditSource({root,paths:['linked.txt']});assert.deepEqual(result.findings,[{path:'linked.txt',reason:'symlink'}]);
}));
test('audit also rejects a symlink in a parent directory',()=>fixture(async root=>{
 await symlink('/does-not-exist/private',join(root,'nested'));
 const result=await auditSource({root,paths:['nested/file.txt']});assert.deepEqual(result.findings,[{path:'nested/file.txt',reason:'symlink'}]);
}));
test('audit reports unavailable inputs rather than silently passing',()=>fixture(async root=>{
 const result=await auditSource({root,paths:['missing.txt']});assert.deepEqual(result.findings,[{path:'missing.txt',reason:'unreadable'}]);
}));
test('audit scans each input once and explicitly counts binary exclusions',()=>fixture(async root=>{
 await writeFile(join(root,'icon.png'),Buffer.from([137,80,0,78]));await writeFile(join(root,'ok.txt'),'public');
 const result=await auditSource({root,paths:['ok.txt','icon.png','ok.txt']});assert.equal(result.scanned,1);assert.equal(result.binaryExcluded,1);assert.deepEqual(result.findings,[]);
}));
