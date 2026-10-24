import {readFile,readdir}from'node:fs/promises';import{execFileSync}from'node:child_process';
async function check(dir){for(const f of await readdir(dir,{withFileTypes:true})){const p=dir+'/'+f.name;if(f.isDirectory())await check(p);else if(/\.(mjs|js)$/.test(p))execFileSync(process.execPath,['--check',p]);}}
for(const dir of ['src','demo','extension','scripts','tests','workers','userscript'])await check(dir);
const manifest=JSON.parse(await readFile('extension/manifest.json'));if(manifest.manifest_version!==3)throw Error('MV3 required');if(manifest.permissions?.includes('tabs'))throw Error('Unnecessary permission');console.log('Syntax and manifest checks passed');

