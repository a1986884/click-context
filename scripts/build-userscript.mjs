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
// @description  点一下英文单词，查看它在原句中的意思。含 Collins 词卡、选文翻译、正文双语和生词本；每页默认关闭，开启后按需联网。
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
// @connect      dict.youdao.com
// @connect      lextide-context.aa1986884.workers.dev
// @connect      v04-preview.lextide.pages.dev
// @connect      *
// ==/UserScript==
`;
await mkdir('build/userscript',{recursive:true});
await build({entryPoints:['userscript/main.js'],outfile:'build/userscript/click-context.user.js',bundle:true,format:'iife',target:['safari17.4','chrome110'],banner:{js:header+'\n/*\n'+await readFile('LICENSE','utf8')+'\n*/'},legalComments:'eof',charset:'utf8'});
await copyFile('LICENSE','build/userscript/LICENSE');
await writeFile('build/userscript/README.zh-CN.md',`# 语境精读 ${USERSCRIPT_VERSION} 油猴试用版

本次为 0.8.0 候选；沿用原用户脚本的命名空间、存储键和更新地址。公开安装页与本地构建的版本可能不同。

本文件对应 ${USERSCRIPT_VERSION}。公开安装页可能仍是旧版本，请核对页面标记；本包是否发布、是否通过真实质量检查，以 release.json 与 HANDOFF.zh-CN.md 为准。试本包请直接导入同目录 click-context.user.js。

## 安装
安装页：https://click-context-install.aa1986884.workers.dev/
脚本地址：https://click-context-install.aa1986884.workers.dev/click-context.user.js
管理器可使用脚本声明的更新地址；是否自动检查由管理器设置决定，脚本不轮询。若只显示代码，仍可按下面步骤导入。

1. 使用 iOS / Safari 17.4 或更新版本，安装并启用支持 GM_xmlhttpRequest / GM_getValue / GM_setValue 的脚本管理器。iPhone Safari 需要 iOS 版本兼容的管理器，并在系统 Safari 扩展设置中允许访问测试网站。
2. 在管理器中“添加新脚本”，用 click-context.user.js 的完整内容替换示例并保存。若管理器支持从本地文件导入，也可以直接导入该文件。仅下载文件不会自动启用。
3. 打开普通英文网页并刷新。首次弹出的阅读设置里开启“查词”，关闭设置，点一个英文单词。以后打开网页，点击右下角“查词”按钮开启；单击可关闭，长按可打开设置。通过系统选择英文，再点“翻译选文”。
4. 如管理器询问连接有道、lextide-context.aa1986884.workers.dev 或 v04-preview.lextide.pages.dev，请按你的意愿允许。为支持自定义 API，脚本声明 @connect *；代码仍只向内置主机和你保存并确认的 API Origin 发请求。请按管理器提示决定授权。

## 功能与隐私
- 复用现有词卡、同义自动选择 Collins 词义、AI 来源标识、选文翻译、正文双语、原文恢复和生词本。
- 每次加载页面都默认关闭查词与正文翻译，需主动开启。开启查词时英文正文链接用于查询；关闭后恢复跳转。脚本设置可从长按浮标或管理器菜单进入。
- 词条来自有道公开页面 Collins 区域；不含官方 Collins API 授权。查询单词发给有道，原句与候选义项只发给所选语境 AI（默认内置 Cloudflare AI）；选文和正文分别发给其所选引擎。原句释义可能出错，服务可能限流或不可达。
- 使用脚本管理器存储，不把生词或 API 密钥写入网页 localStorage。跨网站共享生词；管理器是否云同步由其设置决定。脚本设置里可查看生词本并导出备份。
- 长按浮标 → 选择翻译引擎 / 配置 API：支持点击语境、正文、选文独立选择，17 个预设和自定义兼容接口；语境限 AI 配置，Google/微软/DeepL 保留正文与选文角色。密钥通过浏览器弹窗填写，仅存 GM 配置，不进入网页表单或生词导出；管理器可能同步 GM 数据。自带 API 需要可确认支持 redirect:error 的 Tampermonkey（build 6180+ 或 5.6+），其余管理器可将点词语境、正文、选文全部选为内置并原样保留已有 API 配置；不能在此管理器新增、修改或调用外部 API。不读取原插件密钥或设置，不内置密钥。
- 仅在普通 HTML 网页顶层运行，不支持 Safari 内部页、PDF 查看器和跨域 iframe。网页预览域名排除，避免与预览词卡重复。
- 不绕过网站验证、浏览器管理策略或服务来源限制。403/429 等错误会显示；不会伪造 Origin。仅在词条栏目不可读时向已有预览 API 查询同一公开来源；HTTP 拒绝或限流时不切换。

更换正文引擎会暂停正文翻译并恢复原文；需要重新开启才发送正文。切换已有服务不重复询问主机确认；新增 Origin 需确认。主动“测试翻译 / 已保存配置”或“测试语境 / 已保存配置”才发送公共示例，失败不切换服务。更换语境取消旧词卡，不停止无关翻译。配置无法读取时只保留词典查询，不猜测文本或语境目的地。

没有系统密钥输入或服务地址确认弹窗时，仅禁用对应 API 配置步骤，仍可选择内置服务；实际可用性须另行验证。草稿密钥绑定输入时的服务 Origin，换地址需重填；关闭设置后迟到的弹窗结果丢弃。检测到其他页面已保存新配置时拒绝旧界面覆盖。支持 GM 配置监听的管理器会合并跨页引擎变更事件并重新校验读取；等待时不发旧配置请求，取消不阻塞。只监听引擎配置键，不轮询，恢复后不自动发文本。无监听接口时请重新打开设置读取。

## 连接检查
长按浮标 → 连接检查 / 诊断，或使用管理器同名菜单。打开不联网，点击检查才探测两个内置接口（空 JSON，预期 HTTP 400，不调用模型）和公开 class 词条。复制只含管理器兼容信息、HTTP 状态与归类，不含网页原文、完整网址、API 配置或密钥。关闭取消请求，不轮询；复制失败可手动复制文本。报告明确仅连接检查，未验证 AI 释义或翻译的实际可用性及准确性。

## 验证边界
普通浏览器以模拟 GM 接口验证脚本交互和网络适配，不等于 Tampermonkey 实际安装。iPhone Safari / 原生脚本管理器尚未真机安装验收，不能保证你的设备可用。若出现问题，请反馈管理器名称、iOS 版本、测试网页和错误文字，不要发密钥。
`);
console.log('Built build/userscript/click-context.user.js');
