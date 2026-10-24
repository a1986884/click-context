// Native acceptance: installed MV3 worker -> production lookup module -> real
// Youdao HTTPS response -> real offscreen document/DOMParser. Never a fixture.
import {chromium} from 'playwright';import assert from 'node:assert/strict';import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';
import {extensionFingerprint,sourceState} from '../../scripts/build-evidence.mjs';
const extension=resolve('build/extension'),manifest=JSON.parse(await readFile(join(extension,'manifest.json'),'utf8'));
const report={extensionVersion:manifest.version,extensionFingerprint:await extensionFingerprint(extension),commit:sourceState().commit,kind:'installed MV3 offscreen real dictionary lookup',status:'not-run',nativeExtensionInstalled:false,offscreenCreateMs:null,realProviderRequestsCompleted:false};await mkdir('test-results',{recursive:true});
let blocked=false;
try{const policy=JSON.parse(await readFile('/etc/chromium/policies/managed/extensions.json','utf8'));blocked=policy.ExtensionInstallBlocklist?.includes('*')===true;}catch{}
if(blocked){report.status='blocked-by-policy';report.reason='Managed Chromium ExtensionInstallBlocklist=*; no installation or policy bypass attempted.';console.log(JSON.stringify(report));await writeFile('test-results/offscreen-extension.json',JSON.stringify(report,null,2));process.exitCode=2;}
else{
 const profile=await mkdtemp(join(tmpdir(),'lextide-offscreen-'));let context;
 try{context=await chromium.launchPersistentContext(profile,{...(process.env.CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.CHROMIUM_EXECUTABLE_PATH}:{channel:'chromium'}),headless:process.env.HEADED!=='1',ignoreDefaultArgs:['--disable-extensions'],args:['--disable-extensions-except='+extension,'--load-extension='+extension]});
  const worker=context.serviceWorkers().find(w=>w.url().startsWith('chrome-extension://'))||await context.waitForEvent('serviceworker',{timeout:15000});assert.match(worker.url(),/^chrome-extension:/);report.extensionId=new URL(worker.url()).host;report.browserVersion=context.browser().version();assert.equal(await worker.evaluate(()=>chrome.runtime.getManifest().version),manifest.version);report.nativeExtensionInstalled=true;
  const evidence=await worker.evaluate(async()=>{
   const {createDictionaryLookup}=await import(chrome.runtime.getURL('dictionary-lookup.js'));
   const existing=await chrome.runtime.getContexts({contextTypes:['OFFSCREEN_DOCUMENT']});if(existing.length)await chrome.offscreen.closeDocument();
   const creations=[],api={runtime:chrome.runtime,offscreen:{createDocument:async options=>{const start=performance.now();await chrome.offscreen.createDocument(options);creations.push(performance.now()-start);}}};
   const lookup=createDictionaryLookup(api),start=performance.now(),result=await lookup('ocean',{online:true});const elapsedMs=performance.now()-start;
   const contexts=await chrome.runtime.getContexts({contextTypes:['OFFSCREEN_DOCUMENT'],documentUrls:[chrome.runtime.getURL('offscreen.html')]});
   // New parser instance must discover the already-open document.
   const {createOffscreenParser}=await import(chrome.runtime.getURL('offscreen-client.js'));const again=await createOffscreenParser(api)('<div class="dictentry"><span class="orth">unit</span><div class="def">A synthetic warm parser check.</div></div>','collins-en');
   return {result,elapsedMs,creations,offscreenContexts:contexts.length,warmHead:again.head};
  });assert.equal(evidence.result.kind,'collins');assert.equal(evidence.result.lemma,'ocean');assert.ok(evidence.result.senses.length);assert.equal(evidence.offscreenContexts,1);assert.equal(evidence.creations.length,1);assert.equal(evidence.warmHead,'unit');
  report.status='passed';report.realProviderRequestsCompleted=true;report.offscreenCreateMs=evidence.creations[0];report.lookupElapsedMs=evidence.elapsedMs;report.offscreenContexts=evidence.offscreenContexts;report.offscreenCreations=evidence.creations.length;report.warmHead=evidence.warmHead;report.lemma=evidence.result.lemma;report.source=evidence.result.source;report.senses=evidence.result.senses.length;console.log(JSON.stringify(report));
 }catch(error){report.status='failed';report.error=error.stack;throw error;}finally{await context?.close();await rm(profile,{recursive:true,force:true});await writeFile('test-results/offscreen-extension.json',JSON.stringify(report,null,2));}
}
