import {build} from 'esbuild';
import {mkdir,writeFile,copyFile,readFile} from 'node:fs/promises';
import {USERSCRIPT_VERSION} from '../userscript/version.js';
const header=`// ==UserScript==
// @name         语境精读 · Closeread（试用版）
// @namespace    click-context
// @version      ${USERSCRIPT_VERSION}
// @homepageURL  https://click-context-install.aa1986884.workers.dev/
// @updateURL    https://click-context-install.aa1986884.workers.dev/click-context.meta.js
// @downloadURL  https://click-context-install.aa1986884.workers.dev/click-context.user.js
// @description  点一下英文单词，查看它在原句中的意思。含 Collins 词卡、选文翻译、正文双语和生词本；支持记住网站设置、排除网站与全局暂停。
// @license      MIT
// @match        https://*/*
// @match        http://*/*
// @exclude      https://v04-preview.lextide.pages.dev/*
// @exclude      https://click-context-install.aa1986884.workers.dev/*
// @run-at       document-idle
// @noframes
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addValueChangeListener
// @grant        GM_removeValueChangeListener
// @grant        GM.addValueChangeListener
// @grant        GM.removeValueChangeListener
// @grant        GM_registerMenuCommand
// @grant        GM.xmlHttpRequest
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.registerMenuCommand
// @grant        GM_info
// @grant        GM.info
// @connect      translate.googleapis.com
// @connect      www.bing.com
// @connect      dict.youdao.com
// @connect      lextide-context.aa1986884.workers.dev
// @connect      v04-preview.lextide.pages.dev
// @connect      *
// ==/UserScript==
`;
await mkdir('build/userscript',{recursive:true});
await build({entryPoints:['userscript/main.js'],outfile:'build/userscript/click-context.user.js',bundle:true,format:'iife',target:['safari17.4','chrome110'],banner:{js:header+'\n/*\n'+await readFile('LICENSE','utf8')+'\n*/'},legalComments:'eof',charset:'utf8'});
await copyFile('LICENSE','build/userscript/LICENSE');
const guide=(await readFile('userscript/README.zh-CN.md','utf8')).replaceAll('](../','](https://github.com/a1986884/closeread/blob/main/');
await writeFile('build/userscript/README.zh-CN.md',guide);
console.log('Built build/userscript/click-context.user.js');
