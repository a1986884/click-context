import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {validateExtension} from '../scripts/validate-extension.mjs';
test('package validation distinguishes module imports from strings and comments and rejects missing or escaping dependencies',async()=>{
 const root=await mkdtemp(join(tmpdir(),'lextide-package-'));
 try{
  await writeFile(join(root,'manifest.json'),JSON.stringify({manifest_version:3,version:'0.5.0',background:{service_worker:'background.js'},action:{default_popup:'popup.html'}}));
  await writeFile(join(root,'popup.html'),'<html><body>Package validation fixture</body></html>');
  await writeFile(join(root,'background.js'),`const text="import './not-a-dependency.js'";\n// from './also-not-a-module.js'\nawait Promise.resolve();console.log(text);`);
  await validateExtension(root);
  await writeFile(join(root,'background.js'),"import './missing.js';");await assert.rejects(validateExtension(root));
  await writeFile(join(root,'background.js'),"import '../outside.js';");await assert.rejects(validateExtension(root),/Resource escapes extension/);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('Chromium validator rejects bundled parser markers; Safari allowance must be explicit',async()=>{
 const root=await mkdtemp(join(tmpdir(),'lextide-parser-package-'));
 try{await writeFile(join(root,'manifest.json'),JSON.stringify({manifest_version:3,version:'test',background:{service_worker:'background.js'},action:{default_popup:'popup.html'}}));await writeFile(join(root,'popup.html'),'<html></html>');await writeFile(join(root,'background.js'),'// node_modules/linkedom/worker.js\nexport const fixture=true;');await assert.rejects(validateExtension(root),/linkedom/);await validateExtension(root,{allowLinkedom:true});}finally{await rm(root,{recursive:true,force:true});}
});
