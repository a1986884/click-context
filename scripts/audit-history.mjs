import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {auditHistory} from './source-history.mjs';
const report={startedAt:new Date().toISOString(),kind:'finite credential checks on locally reachable history and nested Git bundles',status:'failed',nativeExtensionInstalled:false};
try{
 const reviewedFixtures=JSON.parse(await readFile(new URL('./reviewed-history-fixtures.json',import.meta.url),'utf8'));
 Object.assign(report,await auditHistory({root:process.cwd(),reviewedFixtures}));
}catch(error){
 report.error=['shallow-history','nested-bundle-limit','invalid-object-stream','no-reachable-commits'].includes(error.message)?error.message:'history-audit-error';
}finally{
 report.finishedAt=new Date().toISOString();report.limitations='Finite patterns; non-bundle binary content excluded. Locally reachable objects only; no ignored files, platform credentials, unfetched remote refs or unreachable objects. Not a complete security audit.';
 await mkdir('test-results',{recursive:true});await writeFile('test-results/history-audit.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 if(report.status!=='passed')process.exitCode=1;
}
