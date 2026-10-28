import {readFile,readdir,access,mkdir,writeFile,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {validateExtension} from './validate-extension.mjs';
import {extensionFingerprint,matchesBuild,sourceState,nativeEvidence} from './build-evidence.mjs';
await validateExtension('build/extension');await validateExtension('build/safari',{allowLinkedom:true});
const root='build/extension',manifest=JSON.parse(await readFile(root+'/manifest.json'));
const pkg=JSON.parse(await readFile('package.json'));
if(manifest.manifest_version!==3||manifest.version!==pkg.version||manifest.content_scripts||manifest.permissions.includes('tabs'))throw Error('Unexpected extension manifest or broad automatic injection');
for(const p of [manifest.background.service_worker,manifest.action.default_popup,...Object.values(manifest.icons),'popup.js','content.js','src/core.js','src/protocol.js','src/extension-state.js','vocabulary.html'])await access(root+'/'+p);
if(manifest.web_accessible_resources||(await readFile(root+'/content.js','utf8')).includes('import(chrome.runtime.getURL'))throw Error('Content must be bundled without web-accessible imports');
async function scan(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const path=dir+'/'+entry.name;if(/node_modules|test-results|\.env|\.log$|\.git|\.map$/.test(entry.name))throw Error('Unexpected packaged resource: '+path);if(entry.isDirectory())await scan(path);}}
await scan(root);await mkdir('build/packages',{recursive:true});
const {commit}=sourceState();
let tests={status:'not run'};try{tests=JSON.parse(await readFile('test-results/extension-report.json'));}catch{}
let offscreen;try{offscreen=JSON.parse(await readFile('test-results/offscreen-extension.json'));}catch{}
const fingerprint=await extensionFingerprint(root);
const matchingTests=matchesBuild(tests,{fingerprint,version:manifest.version});
const notes={product:'语境精读 / Closeread',version:manifest.version,commit,extensionFingerprint:fingerprint,testCommit:matchingTests?tests.commit:null,recoveryBaseline:'255a5b32535a32d26df32d09affe2260d3448908',finalGitHubV03Recovered:false,browser:matchingTests?tests.browserVersion||'not installed/tested in this environment':'not verified for this build',...nativeEvidence(tests,offscreen,{fingerprint,version:manifest.version}),installation:'Unzip then Load unpacked in desktop Chrome/Edge developer mode; not a CRX or store release',safari:'Candidate for Apple web packager; upload, signing, TestFlight and physical iPhone NOT tested'};
await writeFile('build/packages/release.json',JSON.stringify(notes,null,2));
const zip=resolve(`build/packages/lextide-chromium-${manifest.version}.zip`);await rm(zip,{force:true});execFileSync('zip',['-q','-r',zip,'.'],{cwd:root});console.log('Manifest/resources validated; ZIP:',zip);
const safari=JSON.parse(await readFile('build/safari/manifest.json'));
if(safari.minimum_chrome_version||safari.version!==manifest.version||safari.manifest_version!==3)throw Error('Invalid Safari candidate manifest');
await scan('build/safari');
const safariZip=resolve(`build/packages/lextide-safari-candidate-${manifest.version}.zip`);await rm(safariZip,{force:true});execFileSync('zip',['-q','-r',safariZip,'.'],{cwd:'build/safari'});
const checksums={};for(const path of [zip,safariZip])checksums[path.split('/').pop()]=createHash('sha256').update(await readFile(path)).digest('hex');
await writeFile('build/packages/sha256.json',JSON.stringify(checksums,null,2));
console.log('Safari candidate ZIP (not installed or accepted by Apple):',safariZip);
