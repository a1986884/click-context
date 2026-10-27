import {readdir,readFile,mkdir,writeFile} from 'node:fs/promises';
import {sourceState} from './build-evidence.mjs';
import {extname,join} from 'node:path';
import {build} from 'esbuild';
import {configurePreviewContextFiles} from './preview-context-config.mjs';
import {USERSCRIPT_VERSION} from '../userscript/version.js';

const files={};let total=0;
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.json':'application/json; charset=utf-8'};
async function collect(dir,relative=''){
 for(const entry of await readdir(dir,{withFileTypes:true})){
  const name=relative?relative+'/'+entry.name:entry.name;
  if(entry.isDirectory()){await collect(join(dir,entry.name),name);continue;}
  if(entry.name.startsWith('_'))continue;
  if(!entry.isFile()||!types[extname(name)])throw Error('Unexpected public preview resource: '+name);
  const bytes=await readFile(join(dir,entry.name));total+=bytes.length;
  if(total>1024*1024)throw Error('Preview exceeds the 1 MiB inline-file budget; use normal static asset upload');
  files['/'+name]={type:types[extname(name)],base64:bytes.toString('base64')};
 }
}
await collect('dist');
const context=configurePreviewContextFiles(files,{endpoint:process.env.CLICK_CONTEXT_PREVIEW_ENDPOINT,candidateVersion:USERSCRIPT_VERSION});
const {version}=JSON.parse(await readFile('package.json','utf8'));
const {commit,dirty}=sourceState();
files['/version.json']={type:types['.json'],base64:Buffer.from(JSON.stringify({version,candidateVersion:USERSCRIPT_VERSION,commit,dirty,...context,kind:'web preview; not installed extension verification'})).toString('base64')};
total=Object.values(files).reduce((sum,file)=>sum+Buffer.from(file.base64,'base64').length,0);
if(total>1024*1024)throw Error('Configured preview exceeds the 1 MiB inline-file budget');
await mkdir('build/pages-preview',{recursive:true});
await build({stdin:{contents:`import {createPreviewWorker} from './scripts/preview-worker.mjs';export default createPreviewWorker(${JSON.stringify(files)},${JSON.stringify(context)});`,resolveDir:process.cwd(),sourcefile:'preview-entry.js'},outfile:'build/pages-preview/_worker.js',bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true,legalComments:'none'});
await writeFile('build/pages-preview/deployment.json',JSON.stringify({version,candidateVersion:USERSCRIPT_VERSION,commit,dirty,...context,files:Object.keys(files).length,bytes:total},null,2));
console.log('Built self-contained Pages preview:',Object.keys(files).length,'public resources');
