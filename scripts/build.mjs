import {rm,mkdir,cp,readFile,writeFile} from 'node:fs/promises';
import {build} from 'esbuild';
import {resolve} from 'node:path';
await rm('dist',{recursive:true,force:true});await rm('build',{recursive:true,force:true});await mkdir('dist',{recursive:true});await mkdir('build/extension',{recursive:true});
await cp('demo','dist',{recursive:true});await cp('src','dist/src',{recursive:true});await cp('assets','dist/assets',{recursive:true});
await cp('extension/engines.css','dist/engines-preview.css');
const enginePreview=(await readFile('extension/engines.html','utf8')).replace('href="engines.css"','href="engines-preview.css"').replace('src="engines.js"','src="engines-preview.js"').replace('<head>','<head><meta http-equiv="Content-Security-Policy" content="default-src \'self\'; script-src \'self\'; style-src \'self\'; img-src \'self\'; connect-src \'none\'; form-action \'none\'; base-uri \'none\'">').replace('<header>','<p class="preview-banner" role="note"><a href="./">← 返回阅读预览</a> · API 设置界面演示，不保存配置或真实密钥；请在插件设置中实际接入。</p><header>');
await writeFile('dist/engines-preview.html',enginePreview);
await cp('extension','build/extension',{recursive:true});await mkdir('build/extension/src',{recursive:true});for(const file of ['confidence-role.js','condition-direction.js','engine-profiles.js','vocabulary-data.js','vocabulary-view.js','core.js','providers.js','translation-service.js','translation-client-validation.js','sentences.js','phrases.js','browser-api.js','data.js','morphology.js','storage.js','protocol.js','extension-state.js'])await cp('src/'+file,'build/extension/src/'+file);await cp('assets','build/extension/assets',{recursive:true});
await build({entryPoints:['extension/content.js'],outfile:'build/extension/content.js',bundle:true,format:'iife',target:'chrome130',legalComments:'none'});
async function background(outfile,target,safari=false){
 const result=await build({stdin:{contents:await readFile('extension/background.js','utf8'),resolveDir:process.cwd(),sourcefile:'background.js'},outfile,bundle:true,format:'esm',platform:'browser',target,legalComments:'eof',metafile:true,plugins:[{name:'dictionary-parser-platform',setup(builder){builder.onResolve({filter:/^\.\/dictionary-lookup\.js$/},()=>({path:'./dictionary-lookup.js',external:true}));builder.onResolve({filter:/^\.\/offscreen-client\.js$/},()=>({path:resolve(safari?'extension/safari-parser.js':'extension/offscreen-client.js')}));}}]});
 if(!safari&&Object.keys(result.metafile.inputs).some(path=>path.includes('node_modules/')))throw Error('Chromium background unexpectedly bundles an external dependency');
 await writeFile(safari?'build/safari-metafile.json':'build/chromium-metafile.json',JSON.stringify(result.metafile,null,2));
}
async function dictionaryModule(outfile,target,safari=false){
 const result=await build({entryPoints:['extension/dictionary-lookup.js'],outfile,bundle:true,format:'esm',platform:'browser',target,legalComments:'eof',metafile:true,plugins:[{name:'dictionary-dom-platform',setup(builder){builder.onResolve({filter:/^\.\/offscreen-client\.js$/},()=>({path:resolve(safari?'extension/safari-parser.js':'extension/offscreen-client.js')}));}}]});
 if(!safari&&Object.keys(result.metafile.inputs).some(path=>path.includes('node_modules/')))throw Error('Chromium dictionary module bundles an external dependency');
 await writeFile(safari?'build/safari-dictionary-metafile.json':'build/chromium-dictionary-metafile.json',JSON.stringify(result.metafile,null,2));
}
await background('build/extension/background.js','chrome130');
await dictionaryModule('build/extension/dictionary-lookup.js','chrome130');
const offscreenBuild=await build({metafile:true,entryPoints:['extension/offscreen.js'],outfile:'build/extension/offscreen.js',bundle:true,format:'esm',platform:'browser',target:'chrome130',legalComments:'none'});
if(Object.keys(offscreenBuild.metafile.inputs).some(path=>path.includes('node_modules/')))throw Error('Chromium offscreen module bundles an external dependency');
await writeFile('build/chromium-offscreen-metafile.json',JSON.stringify(offscreenBuild.metafile,null,2));
await rm('build/extension/safari-parser.js');
await cp('LICENSE','build/extension/LICENSE');
let notices='Third-party software notices for the bundled HTML parser\n';
for(const name of ['linkedom','css-select','css-what','domhandler','domutils','domelementtype','dom-serializer','entities','boolbase','nth-check','cssom','html-escaper','uhyphen','htmlparser2']){
 const info=JSON.parse(await readFile('node_modules/'+name+'/package.json','utf8'));let license='';
 for(const file of ['LICENSE','LICENSE.txt','LICENSE.md','license','License.txt']){try{license=await readFile('node_modules/'+name+'/'+file,'utf8');break;}catch{}}
 if(!license)license='The installed upstream package declares '+info.license+' in package.json and supplies no separate license text.\nAuthor: '+JSON.stringify(info.author)+'\nRepository: '+JSON.stringify(info.repository)+'\n';
 notices+='\n\n'+name+' '+info.version+' ('+info.license+')\n'+license;
}

// Candidate for Apple's web packager. The upload/signing and iOS runtime remain unverified.
await cp('build/extension','build/safari',{recursive:true});
const safariManifest=JSON.parse(await readFile('extension/manifest.json','utf8'));
delete safariManifest.minimum_chrome_version;
safariManifest.permissions=safariManifest.permissions.filter(permission=>permission!=='offscreen');
for(const name of ['offscreen.html','offscreen.js','offscreen-client.js'])await rm('build/safari/'+name,{force:true});
await background('build/safari/background.js','safari18',true);
await dictionaryModule('build/safari/dictionary-lookup.js','safari18',true);
await writeFile('build/safari/THIRD_PARTY_NOTICES.txt',notices);
await writeFile('build/safari/NOTICE.txt',(await readFile('extension/NOTICE.txt','utf8')).replace('Chromium dictionary HTML is parsed with native DOMParser in an offscreen page.\nNo third-party HTML parser is bundled in the Chromium extension.','Safari candidate dictionary HTML uses bundled linkedom and dependencies.\nSee THIRD_PARTY_NOTICES.txt. Safari does not use offscreen APIs.'));
await writeFile('build/safari/manifest.json',JSON.stringify(safariManifest,null,2));
await build({entryPoints:['extension/content.js'],outfile:'build/safari/content.js',bundle:true,format:'iife',target:'safari18',legalComments:'none'});
const {version}=JSON.parse(await readFile('package.json','utf8'));
await writeFile('dist/app.js',(await readFile('dist/app.js','utf8')).replace('V0.4 预览版',`V${version} 插件交互预览`));
// A QA-only copy may be framed by this origin. Production index keeps frame-ancestors 'none'.
const qaPolicy="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://lextide-context.aa1986884.workers.dev; base-uri 'self'; object-src 'none'";
await writeFile('dist/mobile-reader.html',(await readFile('demo/index.html','utf8')).replace('<head>','<head><meta http-equiv="Content-Security-Policy" content="'+qaPolicy+'">'));
await writeFile('dist/_headers',`/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: no-referrer\n  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://lextide-context.aa1986884.workers.dev; frame-ancestors 'none'; base-uri 'self'; object-src 'none'\n`);
console.log('Built dist/ and build/extension/');
const headers=await readFile('dist/_headers','utf8');
await writeFile('dist/_headers',headers+`\n/mobile-reader*\n  ! Content-Security-Policy\n`);

