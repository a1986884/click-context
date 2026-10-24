import {readFile,readdir,access} from 'node:fs/promises';
import {resolve,dirname,sep} from 'node:path';
import {build} from 'esbuild';
const parserPackages='linkedom|htmlparser2|css-select|css-what|domhandler|domutils|domelementtype|dom-serializer|entities|boolbase|nth-check|cssom|html-escaper|uhyphen';
const parserPath=new RegExp('node_modules/(?:'+parserPackages+')/','i');
/** Validate real module syntax and resource paths, including the platform-specific parser boundary. */
export async function validateExtension(root,{allowLinkedom=false}={}){
 const base=resolve(root),manifest=JSON.parse(await readFile(base+'/manifest.json','utf8'));
 if(manifest.manifest_version!==3||!manifest.version||!manifest.background?.service_worker||!manifest.action?.default_popup)throw Error('Incomplete MV3 manifest');
 for(const file of [manifest.background.service_worker,manifest.action.default_popup,...Object.values(manifest.icons||{})])await access(base+'/'+file);
 const safe=target=>{if(!target.startsWith(base+sep))throw Error('Resource escapes extension: '+target);};
 async function walk(dir){
  for(const entry of await readdir(dir,{withFileTypes:true})){
   const path=dir+'/'+entry.name;
   if(entry.isSymbolicLink())throw Error('Symlink in extension: '+path);
   if(entry.isDirectory()){await walk(path);continue;}
   if(!allowLinkedom&&/linkedom|htmlparser2|css-select|domhandler/i.test(entry.name))throw Error('Forbidden HTML parser dependency in Chromium package: '+path);
   if(entry.name.endsWith('.js')){
    const source=await readFile(path,'utf8');
    if(!allowLinkedom&&(/linkedom/i.test(source)||parserPath.test(source)))throw Error('linkedom or its dependencies are bundled in Chromium: '+path);
    // Regex imports mistake text inside bundled libraries for actual module edges.
    const result=await build({metafile:true,entryPoints:[path],bundle:true,write:false,platform:'browser',format:'esm',logLevel:'silent',plugins:[{name:'extension-boundary',setup(builder){builder.onResolve({filter:/^\./},args=>{safe(resolve(dirname(args.importer),args.path));return undefined;});}}]});
    if(!allowLinkedom&&Object.keys(result.metafile.inputs).some(input=>parserPath.test(input)))throw Error('Parser dependency crosses Chromium module boundary');
   }else if(entry.name.endsWith('.html')){
    const text=await readFile(path,'utf8');for(const [,ref] of text.matchAll(/(?:src|href)=["']([^"']+)["']/g)){
     if(!ref||ref.startsWith('#')||/^[a-z]+:/i.test(ref))continue;const target=resolve(dirname(path),ref);safe(target);await access(target);
    }
   }
  }
 }
 if(manifest.permissions?.includes('offscreen'))for(const file of ['offscreen.html','offscreen.js'])await access(base+'/'+file);
 await walk(base);return manifest;
}
