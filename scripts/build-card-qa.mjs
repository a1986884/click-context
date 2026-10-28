import {build} from 'esbuild';import {writeFile} from 'node:fs/promises';
await build({entryPoints:['demo/card-qa.js'],outfile:'dist/card-qa.js',bundle:true,format:'esm',platform:'browser',target:'es2022'});
await writeFile('dist/card-qa.html','<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>语境精读 · 词卡状态检查</title><script type="module" src="/card-qa.js"></script></head><body></body></html>');
