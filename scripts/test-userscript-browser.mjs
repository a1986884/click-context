// Run every ordinary userscript suite and retain each failure for CI diagnosis.
// Real manager, native extension, vendor API and iPhone acceptance are separate.
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {USERSCRIPT_VERSION} from '../userscript/version.js';
const run=promisify(execFile),suites=["userscript", "userscript-class", "userscript-engines", "userscript-diagnostics", "userscript-dialogs", "userscript-install", "userscript-storage", "userscript-lifecycle", "userscript-introduction", "userscript-panel-switching", "userscript-late-introduction", "userscript-dialog-focus", "userscript-client-signs", "userscript-output-shapes", "userscript-magnitude-signs", "userscript-temperature-units", "userscript-context-engines", "userscript-unsupported-retention", "userscript-engine-sync", "userscript-site-controls"];
await mkdir('test-results/userscript-suite',{recursive:true});
const report={version:USERSCRIPT_VERSION,scriptSHA256:createHash('sha256').update(await readFile('build/userscript/click-context.user.js')).digest('hex'),kind:'ordinary browser userscript regressions with synthetic services',tampermonkeyInstalled:false,iPhoneTested:false,realVendorAPIsTested:false,status:'running',suites:[]};
const save=()=>writeFile('test-results/userscript-suite.json',JSON.stringify(report,null,2)+'\n');
await save();
for(const name of suites){
 const started=Date.now();let status='passed',output='';
 try{const result=await run(process.execPath,['tests/browser/'+name+'.mjs'],{env:process.env,timeout:180000,maxBuffer:4*1024*1024});output=result.stdout+result.stderr;}
 catch(error){status='failed';output=(error.stdout||'')+(error.stderr||'')+'\n'+error.message;}
 const log='test-results/userscript-suite/'+name+'.log';await writeFile(log,output);
 report.suites.push({name,status,elapsedMs:Date.now()-started,log});await save();
 console.log(status.toUpperCase()+' '+name);if(status==='failed')console.error(output.slice(-6000));
}
report.status=report.suites.every(s=>s.status==='passed')?'passed':'failed';await save();
console.log(JSON.stringify({status:report.status,ordinaryUserscriptSuites:report.suites.length,tampermonkeyInstalled:false,iPhoneTested:false}));
if(report.status!=='passed')process.exitCode=1;
