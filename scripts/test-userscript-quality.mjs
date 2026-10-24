// Explicit, finite live QA. Every independent stage runs once, serially. Preserve
// every run before replacing latest-report pointers; never retry to obtain green.
import {execFile} from 'node:child_process';
import {readFile,writeFile,appendFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {USERSCRIPT_VERSION} from '../userscript/version.js';
import {sourceState} from './build-evidence.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const runId=USERSCRIPT_VERSION+'-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+process.pid;
const directory=join('test-results','quality-live',runId);await mkdir('test-results/quality-live',{recursive:true});await mkdir(directory);
const remoteHash=/^[a-f0-9]{64}$/.test(process.env.QUALITY_AI_SHA||'')?process.env.QUALITY_AI_SHA:undefined;
const report={version:USERSCRIPT_VERSION,runId,runDirectory:directory,source:sourceState(),kind:'finite serial live QA; generated userscript in ordinary Chromium with simulated GM; not native installation',scriptSHA256:sha(await readFile('build/userscript/click-context.user.js')),backendSourceSHA256:sha(await readFile('build/context-worker/worker.mjs')),backendModuleSHA256:remoteHash,freshBackendModuleReadback:Boolean(remoteHash),status:'running',startedAt:new Date().toISOString(),nativeExtensionInstalled:false,iPhoneTested:false,stages:[]};
const stages=[
 ['basic','tests/live/userscript.mjs',[],'userscript-live-report.json'],
 ['class-fresh-5','tests/live/userscript-context-cohort.mjs',['--class-stability'],'userscript-class-stability-report.json'],
 ['context-24','tests/live/userscript-context-cohort.mjs',[],'userscript-context-cohort-report.json'],
 ['science-9','tests/live/userscript-science.mjs',[],'userscript-science-report.json'],
 ['protocols-5','tests/live/userscript-legacy.mjs',[],'userscript-legacy-report.json']
];
const save=async()=>{const bytes=JSON.stringify(report,null,2)+'\n';await writeFile('test-results/userscript-quality-report.json',bytes);await writeFile(join(directory,'quality-report.json'),bytes);};await save();
for(const [id,file,args,name]of stages){
 const started=Date.now(),log=id+'.log';await writeFile(join(directory,log),JSON.stringify({id,runId,status:'running',startedAt:new Date(started).toISOString(),scriptSHA256:report.scriptSHA256})+'\n');
 // A running placeholder prevents a previous version's completed report from
 // being mistaken for this stage while the child has not produced output yet.
 await writeFile(join('test-results',name),JSON.stringify({version:report.version,scriptSHA256:report.scriptSHA256,status:'running',runId,stage:id},null,2)+'\n');console.log(JSON.stringify({id,runId,status:'running'}));
 const result=await new Promise(resolve=>execFile(process.execPath,[file,...args],{maxBuffer:16*1024*1024},(error,stdout,stderr)=>resolve({code:error?.code??0,stdout,stderr})));
 await appendFile(join(directory,log),result.stdout+result.stderr);
 let snapshot,valid=false;try{const bytes=await readFile(join('test-results',name));snapshot=JSON.parse(bytes);await writeFile(join(directory,name),bytes);valid=snapshot.version===report.version&&(id==='protocols-5'||snapshot.scriptSHA256===report.scriptSHA256)&&snapshot.status==='passed';}catch{/* The failed stage still remains in the aggregate report. */}
 const stage={id,status:result.code===0&&valid?'passed':'failed',exitCode:result.code,ms:Date.now()-started,log,report:name,reportStatus:snapshot?.status};report.stages.push(stage);await save();console.log(JSON.stringify(stage));
}
report.status=report.stages.every(stage=>stage.status==='passed')?'passed':'failed';report.finishedAt=new Date().toISOString();await save();console.log(JSON.stringify({version:report.version,runId,status:report.status,stages:report.stages.length}));if(report.status!=='passed')process.exitCode=1;
