// Build a public Worker artifact and provenance; no credentials are read.
import {build} from 'esbuild';import {readFile,mkdir,writeFile} from 'node:fs/promises';import {createHash} from 'node:crypto';import {sourceState} from './build-evidence.mjs';
const pkg=JSON.parse(await readFile('package.json')),config=JSON.parse(await readFile(process.argv[2]||'workers/context/wrangler.jsonc'));
await mkdir('build/context-worker',{recursive:true});
await build({entryPoints:['workers/context/index.js'],bundle:true,format:'esm',outfile:'build/context-worker/worker.mjs'});
const bytes=await readFile('build/context-worker/worker.mjs'),source=sourceState();
const metadata={main_module:'worker.mjs',compatibility_date:config.compatibility_date,compatibility_flags:[],bindings:[{type:'ai',name:config.ai.binding},...config.ratelimits.map(({name,namespace_id,simple})=>({type:'ratelimit',name,namespace_id,simple}))],observability:config.observability,annotations:{'workers/tag':'lextide-'+pkg.version,'workers/message':'Closeread '+pkg.version+' '+source.commit}};
const report={kind:'public AI Worker artifact; not a deployment or live-provider acceptance',version:pkg.version,...source,script:config.name,sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,metadata};
await writeFile('build/context-worker/deployment.json',JSON.stringify(report,null,2));console.log(JSON.stringify({version:report.version,commit:report.commit,dirty:report.dirty,bytes:report.bytes,sha256:report.sha256}));
