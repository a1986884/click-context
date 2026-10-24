## 预览发布连接恢复记录（2026-10-21）

- 重新核验Cloudflare连接与项目配置后，向既有v04-preview分支发布0.7.29；未改变main生产分支。
- 部署ID：5865d027-2586-410b-86e6-529eb77705a6；源码beb2c6774d48697bab9467d72d847d85760133fb；稳定预览 https://v04-preview.lextide.pages.dev/ 的version.json已核验0.7.29、dirty=false。
- 远端1280/390普通浏览器检查通过，真实ocean路由HTTP200、kind=collins、4义项。后续版本请以线上version.json和各代部署记录为准。
- 下列连接故障记录属于历史。当前环境原生扩展安装策略仍未解除，普通浏览器或网站发布通过不代表原生offscreen验收；私有Colab中转需另行更新。

## 0.7.8 候选构建与真实短语补查（2026-10-21）

- 189测试及桌面/手机预览回归通过。真实来源四项补查通过，候选卡片可匹配account内的take into account Collins义项；见test-results/live-phrase-entries.json、test-results/live-phrases.json。
- live/phrase-entries.mjs使用真实Youdao请求；live/phrases.mjs的LOCAL_CANDIDATE=1 LOCAL_DICTIONARY=1仅替换待验代码和词典适配器，语境调用真实线上AI。词典测试通过Python代理传输，非产品运行时组件。
- Cloudflare whoami仍报MCP -32603 Internal error，未能部署；网站和私有QA中转仍为0.7.6。0.7.8插件ZIP、本地Pages及QA源码包准备好后等待连接恢复。
- 未获得原生安装验收，不能使用共享UI测试代替。

## 0.7.7 已构建，发布连接故障（2026-10-21）

- 185 单元/契约测试通过；短语、语境排序、桌面1280及手机390预览回归通过。
- 本地候选模块在预览来源下连接真实线上服务验收通过：took into account → take into account（AI：考虑到）；carried out → carry out（命中 Collins carry out“实行”，AI 语境释义“进行”）；statistically significant 使用诚实的 AI 回退。6个实际 HTTP 请求均200。
- 验收模式 LOCAL_CANDIDATE=1：浏览器只替换本地新版静态模块，词典和AI请求真实发送到已部署接口。此证据不是新版已发布证明，也不是原生插件安装证明。见 test-results/live-phrases.json。
- Cloudflare search、execute（项目只读查询）、whoami 均返回 MCP -32603 Internal error；未成功执行部署。网站与私有QA中转仍为0.7.6，不能标记0.7.7已上线。
- Chromium ZIP、本地 Pages preview 构建和私有QA源码包已准备；待部署连接恢复后上传并核对 version.json。不改变历史验收结果，不将旧安装报告视为新构建通过。

## 0.7.6 短语查义（2026-10-20）

- 稳定预览：https://v04-preview.lextide.pages.dev/webpage.html#phrase-sample
- 部署：https://8ff6d5ff.lextide.pages.dev/；ID 8ff6d5ff-752a-4b1c-b05b-128732966d84
- 源码 b2bc1a9550db3550485bfb50f216234470738fa5；线上 version.json 为 0.7.6，dirty=false；私有中转 health 与此源码一致。
- 180 单元/契约测试通过；短语划选/搭配识别、语境排序、拖动卡片、开关和双视口预览通过。
- 线上真实查询：took into account → 考虑到；statistically significant → 具有统计学意义的。两条无对应 Collins 可用义项，均正确标注 AI 语境释义。词典路由与 /meaning 均 HTTP 200；见 test-results/live-phrases.json。
- 收藏按表达、释义、原句保留独立用法；旧 version 2 备份仍可导入。预览导入用例已更新为保留不同释义。
- Chromium ZIP 已生成，插件指纹：1716c374f63bf55a4a91108c9a8623faf3ce2060ea163dcafd3112dfe7b76bc9。
- 原生插件安装仍未通过独立验收，普通浏览器和线上真实查询不替代此项。云端源码已更新，当前状态 awaiting_rerun、nativeAcceptancePassed=false。

## 0.7.5 Cloudflare AI 正文翻译（2026-10-20）

- 稳定预览：https://v04-preview.lextide.pages.dev/；部署：https://3611baf7.lextide.pages.dev/；ID 3611baf7-a58c-42c2-9434-bb4fff53c9f0；deploy success
- 源码：2248eec29ead876a4bb503353f4f6f443cf395b4；dirty=false；线上version.json已核对
- 插件指纹：14da0b578b2b3818a5512190f2eba2d8d185a14bb6e9e3918e0a3c0d698b4b08
- 后端：lextide-context /translate；模型@cf/openai/gpt-oss-120b；缓存版本cloudflare-ai:en-zh:v1。保留/meaning，翻译使用独立限流绑定。取消MyMemory客户端请求、host权限和CSP许可。
- 有界输入/输出/推理时间、完整输出与数字校验、一次有界模型重试；服务失败或限流暂停队列并提供手动重试。缓存版本隔离，旧服务缓存不冒充新服务译文。
- 177自动测试及长文/句段切换/失效恢复/双视口回归通过。四个真实短句样例均HTTP200，端到端631–1210ms，保留否定、条件、小数、负数、引用；被引用的恶意指令按文本翻译。
- 发布页面真实共享阅读模块验收通过：4次逐句请求、缓存重读0新请求、2次逐段请求，全部200；关闭后源HTML恢复，手机无横向溢出。实际译文和请求列表见test-results/live-translation-reader.json。不是fixture翻译，也不是原生安装证据。
- 私有中转health核对同一源码版本；当前构建原生安装仍待独立报告。

## 0.7.4 统一断句与长文连续阅读（2026-10-20）

- 稳定预览：https://v04-preview.lextide.pages.dev/；部署：https://fb17acc1.lextide.pages.dev/；ID fb17acc1-675e-42e3-b56c-8235c29af725；deploy success
- 源码：aab33edc790b8f54df0583c55615cdcc6199c2e8；dirty=false；线上 version.json 已核对
- 插件指纹：4867112dae6c8895d184ecc35c993ce375c29f68966d41ebd6ac73bbd64c9250
- 查词与翻译共享论文断句，保留 Eq. (3)、数字引用和点中词位置。逐句模式每批最多新增400个可视句子，随滚动继续发现内容，不再以400句截断整个页面。跳读会取消离开视口的待返回请求；已完成译文保留。
- 缓存分16块，各最多256条/128KiB，继续使用7天TTL，支持旧格式读取及全量清理。650条译文在新存储实例中读取通过。
- 172自动测试通过；650段跳读、单段550句、超过400句连续处理、动态追加、旧请求取消、源DOM恢复、语境、排版、双视口、主开关及失效恢复回归通过。
- 发布模块实测保留完整 Eq. (3) [12] 语境，并在550句单段直接跳到末尾，仅请求当前两处窗口的28句示例翻译，停止后还原单一文本节点。词条/翻译数据为fixture，未重测真实MyMemory限流；没有当前构建原生安装通过证据。
- 私有中转已同步并核对health源码/版本。

## 0.7.3 逐句模式保留段落层次（2026-10-20）

- 稳定预览：https://v04-preview.lextide.pages.dev/；段落示例：https://v04-preview.lextide.pages.dev/webpage.html#paper-sample
- 部署：https://6bcbb9b6.lextide.pages.dev/；ID 6bcbb9b6-9168-4073-9869-d8b43d7c0cc9；deploy success
- 源码：c047793aa0c362d2aaa5ed15ef56e4c54c4d6995；dirty=false；线上 version.json 已核对
- 插件指纹：9ab0c47dbc484a64bf6cbe9ea388d4c503984597c4792e17fff108c006964dfc
- 段内英中句对缩小间距；原段落末尾扩大留白，译文强调线更轻。原段落样式不修改，关闭后恢复原文。
- 168 自动测试、逐句/切换/动态页面回归及桌面/390px 间距测量通过；发布预览测得段内译文下间距6.768px、段末24.534px。翻译使用 fixture，仅验证布局；本轮未重测真实 MyMemory 限流状态。
- 私有中转已同步并读回同一源码/版本；没有当前构建原生插件安装验收通过证据。

## 0.7.2 逐句双语对照（2026-10-20）

- 稳定预览：https://v04-preview.lextide.pages.dev/；长段落示例：https://v04-preview.lextide.pages.dev/webpage.html#paper-sample
- 部署：https://c0192bbc.lextide.pages.dev/；ID c0192bbc-eb55-4901-8d05-d2a1a5dd0427；deploy success
- 源码：2321d481cccbcf6af8392aca82c1e61f5bc69203；dirty=false；线上 version.json 已核对
- 插件指纹：9908407c0a1b08004ffaecb27d7a91981c422b2774fa752ec15d97ec7af21f52
- 长按设置内新增双语对照单位：默认逐段，可选择逐句。逐句按源 DOM 范围插入中文，保留链接/强调/引用；关闭时合并可安全还原的原文文本节点。单个链接跨句时合并该组句子。
- 168 自动测试通过；逐句、长段落可视调度、SPA 替换、段句切换、关闭和重开、原文恢复及桌面/手机预览回归通过；发布后的网页逐句切换回归通过（翻译为 fixture）。
- 本轮真实 MyMemory 复测返回 HTTP 429，没有宣称真实译文通过。限流现会暂停后续请求，保留原文并提供手动重试。公开预览的模拟 429 验证仅发出一次请求，滚动不会继续请求。
- 私有测试中转同步并读回同一版本/源码。当前构建原生插件安装仍未取得匹配验收证据。

## 0.7.1 可移动图标与关闭状态（2026-10-20）

- 稳定预览：https://v04-preview.lextide.pages.dev/
- 部署：https://a920e78b.lextide.pages.dev/；ID a920e78b-6128-416f-9f27-cf635cc6e8da；deploy success
- 源码：efcd8b788da0eb3ca2acd7f13ff880c9839bc556；dirty=false；线上 version.json 已核对
- 插件指纹：6e2a5acade3ff1b2aeabb875a61e9497db0f3603858a72de11194e1269049377
- 图标支持鼠标/触控拖动、方向键移动、比例位置保存、视口限制和设置内重置。拖动不触发点击/长按；关闭后普通单词无查词高亮、按钮语义或键盘焦点，切换文章同样生效。
- 161 自动测试通过；开关、卡片、双视口预览、上下文失效和图标浏览器回归通过；发布后的图标浏览器回归通过（词条使用 fixture，未重测真实字典服务）。
- 私有测试中转已同步，health 返回同一源码及版本；当前构建原生插件安装仍待外部 notebook 产生匹配证据。

## 0.7.0 当前通用词形/语境版本（2026-10-20）

- 稳定预览：https://v04-preview.lextide.pages.dev/
- 部署：https://10522e7e.lextide.pages.dev/；ID 10522e7e-9559-4209-84da-50671a7df8eb；deploy success
- 源码：630b061ba7999b58227e5c86326bd4e968dce3fa；dirty=false
- 插件指纹：8a26acd84df72c6e38cb0e5d72934f28c9cd8f69090779940c06de6552e80469
- 字典原词优先、最多两个来源确认的原形候选；引用空壳扩展，独立词义保留，缓存按原词隔离。常规候选确认后取消多余慢请求，歧义引用保留多原形。
- 语境 API ai-context-v3 / @cf/openai/gpt-oss-120b 已部署；校验候选 ID、词性与原形；缺失或错配单独标记 AI，不冒称 Collins。无新 host 权限。
- 160 自动测试通过；13 个新词形/歧义/缺词语境样例及原有 10 个多义词样例通过。模型仍可能误判，此小样例不是通用准确率评估。
- 浏览器语境/卡片/主开关/失效恢复和桌面窄屏预览通过。初次发布线上 7 个实际 Collins＋AI 场景通过；最终部署额外读回源码并复核 stopping→stop/停下、leaves→leaf/叶子，分别约 7697/2809 ms（含字典、模型和自动化，不是延迟保证）。
- 插件包及私有 Colab 源码同步为 0.7.0；原生插件安装验收仍待运行。production 分支未改动。

## 0.6.9 当前词形修复版本（2026-10-20）

- 稳定预览：https://v04-preview.lextide.pages.dev/
- 部署：https://5a110de7.lextide.pages.dev/；ID 5a110de7-80dc-4a01-a880-cfec8b23a295；deploy success
- 源码：51b2189b40f2538096713e28c45184f3b06f0352；dirty=false
- 插件指纹：2323ed743a0266df6d3ad072c3c7c3cdc8f2d66917b5e080a7af9bb13cb75d9a
- 修复 Hugging/hugged 被 hug 原形校验误拒绝。读取同一 Collins 词头下明确列出的变形，不从例句/派生词猜测。146 自动测试通过。
- Hugging、hugged 真实来源均单请求返回 hug/拥抱。已发布页面真实浏览器点击句子中的 Hugging，经实际 Collins 与语境 AI 返回“拥抱”，无 mismatch 错误。making/lying/stopped/written 在真实来源具有独立词头，保留来源，不强制改成假定原形；这些词的模拟重定向验收与实际词头行为区分。
- 插件包及私有 Colab 源码同步为 0.6.9；当前构建未完成原生插件安装验收。

## 0.6.8 当前主开关版本（2026-10-20）

- 稳定预览：https://v04-preview.lextide.pages.dev/
- 部署：https://138ac598.lextide.pages.dev/；ID 138ac598-1297-47fb-ae2e-a555b40e3b5e；deploy success
- 源码：22d8e6d8612c41afb8e8341ee9eb875620df8bd9；dirty=false
- 插件指纹：8a93274a6c1664e921f52d89041894f2825bbe2c481eda275d1dd49707f0894b
- 右下角按钮关闭时同时停查词和正文翻译、清除中文和卡片；重开只启用查词。长按设置仍可独立调整翻译。
- 144 自动测试通过，含关闭过程中取消请求、阻止迟到中文重新插入。浏览器开关回归通过。已发布页面实测：关闭前 3 段中文，点一次全部移除；再次开启没有恢复中文。该页面验收使用内置示例译文，不是翻译服务测速。
- 插件包、私有 Colab 源码已同步；当前构建未完成原生插件安装验收。

## 0.6.7 当前网页适配版本（2026-10-20）

- 稳定预览：https://v04-preview.lextide.pages.dev/
- 网页结构阅读示例：https://v04-preview.lextide.pages.dev/webpage.html
- 本次部署：https://ec6a0a21.lextide.pages.dev/；ID ec6a0a21-c6f7-4edb-86c7-236cc5edb635；deploy success
- 源码：42fe3e353f4170ecbe30bbeb6cc864561bf570e7；dirty=false
- 插件指纹：d3a480795c4d3a84108c4aa7f06da1834a6b828e625a5fe9c9c86239e485a474
- 143 自动测试通过。复杂网页结构/动态替换/阅读位置保持、主页桌面窄屏、网页阅读示例、语境、开关、失效恢复浏览器测试通过。
- 博客、MDN、Wikipedia 真实 DOM 检查通过；分别实际翻译一个 MyMemory 样例段落，其余排版测试为合成响应。发布后的 webpage.html 实际浏览器请求返回“视角的微小变化”，耗时约 1383 ms，无预置中文或逐段来源标签。
- 插件包及私有 Colab 源码同步为 0.6.7；QA health 读回匹配源码提交。此构建仍未获得原生插件安装验收，不把网页证据当作安装通过。
- 正文仍用 MyMemory；Collins＋Cloudflare 语境接口不变；production 分支未改动。

## 0.6.6 当前正文简化版本（2026-10-20）

去掉段落译文后的可见来源标签，来源仍在 DOM 元数据。
- 稳定预览：https://v04-preview.lextide.pages.dev/
- 本次部署：https://e6482eb5.lextide.pages.dev/；deploy success
- 源码：44b69e0b46201a51abf826a608aec0fa1ca2977b；dirty=false
- 136 自动测试通过，桌面/窄屏预览通过。发布后真实浏览器检查 0.6.6 双语正文正常显示且来源标签为零。
- 插件包及私有 Colab 源码同步为 0.6.6；此构建未获得原生安装验收。语境 API 不变。

## 0.6.5 当前语境 API 版本（2026-10-20）

- 稳定预览：https://v04-preview.lextide.pages.dev/
- 本次部署：https://cc7c9459.lextide.pages.dev/
- 部署 ID：cc7c9459-f05f-48c0-b93e-21ea660f224b；Cloudflare deploy success
- 源码提交：1e39fdbe5e3aec40a46f5dc28ea4a53bafc1105b；构建 dirty=false
- 语境接口：https://lextide-context.aa1986884.workers.dev/meaning
- 模型：@cf/qwen/qwen3-30b-a3b-fp8；AI / PER_IP / TOTAL bindings 已部署。
- 插件指纹：78bcf2e901366b02a6b1e5a2cc51b10f23079f4d8a479d4bf25eed7451c4b4f6
- 136 个自动测试通过；查词卡片、阅读开关、语境和失效恢复浏览器 fixtures 通过；预览桌面/窄屏通过。10 个实际 Collins＋AI 样例通过。已发布预览真实 browser 验证 bank / available 两种语境、语境缓存与移动视口通过。
- 私有 QA 源码和健康读回已更新为同一提交；未运行此构建原生安装验收。
- production 分支未改动；以下保留旧版记录。

# Auxiliary Pages preview

Primary product artifacts are browser extensions. Pages only previews the shared
reader UI and fixture pages.

## Current plugin interaction preview

The stable URL https://v04-preview.lextide.pages.dev/ serves the V0.6.4 shared
reader preview. Current deployment: `b0214e82-57eb-4a13-8033-e5c2784dac25`, immutable
URL https://b0214e82.lextide.pages.dev/, source `f83c45a4d1dd5d81ac3963199e1cc36730f2050c`
with clean source metadata. Pages confirmed preview environment, branch
`v04-preview`, deploy success; the production deployment remains separate.

On 2026-10-20, version readback matched 0.6.4. The deployed 1280px/390px browser
contract checks passed with synthetic dictionary responses. The ordinary local
Chromium fixture also passed precise cross-inline selection, hidden-text exclusion,
title/decimal sentence extraction, reranking and manual choice checks.
In the previous 0.6.0 deployment, a real `/api/dictionary?word=bank` call returned
the explicitly labeled Youdao Collins source and 12 readable candidates.
The 0.6.2 deployed live `ocean` lookup returned 大海 from Youdao Collins. Browser
checks passed dragging, expanding a bilingual example while the action footer
remains visible, collapsing/expanding and narrow viewport bounds. The separate
local fixture also verified keyboard movement, emulated touch, dark appearance,
page scrolling, retained position and reset/Escape.
The 0.6.3 deployed switch check used the actual article hyperlink and a live
Collins query returning 大海 (one request, repeat cached). It verified lookup-on
blocks navigation, lookup-off leaves plain words inert and restores hyperlink
navigation, and all four lookup/translation combinations. Paragraph translations
in this check were bundled human examples; the navigation destination used an
explicitly synthetic response. It makes no live MyMemory or Wikipedia claim.
The 0.6.4 deployed settings check verified one floating icon, no online controls,
immediate live Collins lookup returning 大海 despite a legacy offline preference,
the long-press-only bilingual switch, independent translation on/off and narrow
settings stacking above an open card. Translation used bundled human examples.
These results are not native 0.6.4 extension installation acceptance.

Dictionary sentences are ranked locally in the reader and are not sent through
the preview endpoint. Extension requests read the public Youdao Collins page
directly once the site is activated, while the website uses its same-origin relay.
The current native Colab test bundle targets V0.6.4 and is awaiting a run.
The private manifest readback matches the source commit above and extension
fingerprint `9293bc5cdb672ca4cd071d14c3ba8d86c803e43bcf5fb9d59f63fc02d0954026`.
`/latest` correctly reports `waiting_for_notebook`, with native acceptance false.

## Historical V0.4 continuation preview

Published successfully on 2026-10-19:

- Preview: https://v04-preview.lextide.pages.dev/
- Immutable deployment: https://66e6c9f1.lextide.pages.dev/
- Deployment ID: `66e6c9f1-6a77-4cae-9b6a-16e9676812ea`
- Source: local commit `d3a98ebf50bfa7b1d06d6fac9f2d0d0a5c82786c`, clean tree.
- Pages environment: **preview**, branch `v04-preview`; deployment stage success.
- `/version.json` and security headers verified over HTTPS; the same desktop and
  mobile-width browser checks passed against the published preview.
- `https://lextide.pages.dev/` remains the older production demo.

The local source commit is included in the continuation Git bundle. It has not
been pushed to the GitLab or GitHub repositories; this was a direct deployment.

The connector can manage the existing Pages project but asset upload returns
`8000013 Authorization failed`, including with a freshly issued upload JWT.
The local environment has no independent Cloudflare deployment credentials.
Do not retry Git installation or modify account integrations to work around it.

For this small preview, `npm run build:preview` produces an optional,
self-contained Pages advanced-mode `_worker.js` in `build/pages-preview/`.
It embeds only the public `dist/` files, capped at 1 MiB, and handles GET/HEAD
with explicit content types, CSP, no-store caching and unknown-path 404s.
The normal static output and browser extension packaging remain available.
This format uses Pages Functions for page requests; normal static asset
hosting remains preferable for a production site or larger assets.

Publish it with an empty asset manifest, `_worker.js` and a non-main branch
through the documented Pages deployment API. This requires an authorized
Pages project; it grants no additional account or browser permissions.
`/version.json` records the exact local source commit and dirty-tree status.

```sh
npm run build:preview
CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:preview
```

The browser preview checks 1280px and 390px viewports: mouse word lookup,
all three modes, vocabulary persistence/export, switching articles, horizontal
bounds, JavaScript errors and zero provider requests without consent.
`PREVIEW_URL` can target a deployed preview for the same checks.
It does not install an extension or establish physical iPhone compatibility.

The existing `lextide` Pages project remains connected to the suspended GitHub
repository. Its main production branch and deployment were not changed.
Previous V0.3 preview: https://fa7f580c.lextide.pages.dev .
This is not a V0.4 preview or a browser installation test.

On 2026-10-19 a new, preview-only GitLab integration was attempted through the
authorized Cloudflare API for `abcmikedick/lextide`. Cloudflare rejected it with
`8000011`: an issue with the Cloudflare Pages Git installation. No V0.4 preview
deployment is claimed. Do not repeatedly retry/reinstall account integrations
without the owner completing the account authorization.

Once GitLab is authorized in Cloudflare, use a separate Pages project for the
GitLab repository, Node 22, root directory empty, build `npm run build`, output
`dist`. Keep production deployments off during acceptance and enable only the
V0.4 preview branch. Verify the deployed commit and actual preview response.

A supported alternative is Direct Upload from an authorized CI job. Store a
least-privilege Cloudflare Pages API token as a masked CI variable, never in Git,
and deploy only a non-main preview branch after tests pass. Provisioning such a
credential is owner-controlled; no credential was extracted from connectors.
GitLab CI currently also requires the owner's additional identity verification.

Official references:
https://developers.cloudflare.com/pages/configuration/git-integration/gitlab-integration/
https://developers.cloudflare.com/pages/get-started/direct-upload/
