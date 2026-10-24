import {execFileSync} from 'node:child_process';
import {auditSource} from './source-audit.mjs';
const paths=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
const result=await auditSource({root:process.cwd(),paths});
console.log(JSON.stringify({scope:'tracked and nonignored working files; not Git history or ignored private files',...result,limitations:'Finite credential patterns; binary content excluded. Not a complete security or licensing audit.'},null,2));
if(result.findings.length)process.exitCode=1;
