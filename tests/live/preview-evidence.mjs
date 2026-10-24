// Check the deployed artifact before any live-provider action; retain failed evidence.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {sourceState} from '../../scripts/build-evidence.mjs';
export async function previewExpectation(){
 const pkg=JSON.parse(await readFile(new URL('../../package.json',import.meta.url))),source=sourceState({cwd:fileURLToPath(new URL('../..',import.meta.url))});
 const expectedVersion=process.env.EXPECTED_PREVIEW_VERSION||pkg.version;
 const expectedCommit=process.env.EXPECTED_PREVIEW_COMMIT||(expectedVersion===pkg.version&&source.dirty===false&&source.commit!=='unknown'?source.commit:null);
 return {localVersion:pkg.version,source,expectedVersion,expectedCommit,version:null,previewVerified:false,previewCommitVerified:false};
}
export async function verifyPublishedPreview(page,report,{timeoutMs=10000}={}){
 const expectation=await previewExpectation();Object.assign(report,expectation);
 const {expectedVersion,expectedCommit}=expectation;
 const probe=await page.evaluate(async timeoutMs=>{
  const signal=AbortSignal.timeout(timeoutMs);let httpStatus=null;
  const failure=(kind,error)=>({httpStatus,version:null,failureKind:kind,errorName:error.name});
  try{
   const response=await fetch('/version.json',{cache:'no-store',signal});httpStatus=response.status;
   try{return {httpStatus,version:await response.json()};}
   catch(error){return failure(signal.aborted&&signal.reason?.name==='TimeoutError'?'timeout':'non-json',error);}
  }catch(error){return failure(signal.aborted&&signal.reason?.name==='TimeoutError'?'timeout':'network',error);}
 },timeoutMs);
 report.previewHTTPStatus=probe.httpStatus;report.version=probe.version;
 if(probe.failureKind){report.previewFailureKind=probe.failureKind;report.previewErrorName=probe.errorName;throw Error('Published preview probe failed: '+probe.failureKind+(probe.httpStatus===null?' before an HTTP response':' (HTTP '+probe.httpStatus+')'));}
 if(probe.httpStatus!==200)report.previewFailureKind='http';
 assert.equal(probe.httpStatus,200,'Published preview version endpoint must succeed');
 assert.equal(probe.version?.version,expectedVersion,'Published preview version differs from the expected artifact');
 assert.equal(probe.version?.dirty,false,'Live acceptance requires a clean published preview');
 assert.ok(expectedCommit,'Specify EXPECTED_PREVIEW_COMMIT when the local checkout cannot identify the clean target commit');
 assert.equal(probe.version?.commit,expectedCommit,'Published preview commit differs from the expected artifact');
 report.previewVerified=true;report.previewCommitVerified=true;
}
