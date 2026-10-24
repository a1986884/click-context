import {test} from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';import {execFileSync} from 'node:child_process';import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';
test('cloud source bundle includes the build-required license and excludes private or generated files',async()=>{
 const root=await mkdtemp(join(tmpdir(),'lextide-cloud-source-'));const builder=resolve('cloud-qa/build.py');
 try{await mkdir(join(root,'cloud-qa'),{recursive:true});await mkdir(join(root,'build/packages'),{recursive:true});for(const [name,value]of Object.entries({'LICENSE':'MIT test license','package.json':'{}','package-lock.json':'{}','cloud-qa/runner.py':'# test runner','private.txt':'not part of the source allowlist','build/packages/release.json':JSON.stringify({version:'0.0.1',extensionFingerprint:'a'.repeat(64)})}))await writeFile(join(root,name),value);
 const git=(...args)=>execFileSync('git',args,{cwd:root,stdio:'pipe'});git('init','-q');git('add','.');git('-c','user.name=Test','-c','user.email=test@example.invalid','commit','-qm','Fixture');
 execFileSync('python3',[builder,'--out',join(root,'out')],{cwd:root,stdio:'pipe'});const names=JSON.parse(execFileSync('python3',['-c','import zipfile,json,sys; print(json.dumps(zipfile.ZipFile(sys.argv[1]).namelist()))',join(root,'out/source.zip')],{encoding:'utf8'}));assert.deepEqual(names.sort(),['LICENSE','cloud-qa/runner.py','package-lock.json','package.json']);
 }finally{await rm(root,{recursive:true,force:true});}
});
