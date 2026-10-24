## 发布证据与原生验收边界（2026-10-21）

- 本次文档记录已核验发布0.7.52：网站与私有QA源码均为该版，源码7db70ae4f87918f05d5f3ad3c9f436b80c356739，桌面/手机预览通过。后续版本应读取下面version/health；各代发布后的实际结果另存交付包deployment.json，以下旧版本条目均为历史。
- 稳定预览：https://v04-preview.lextide.pages.dev/ 。实际版本读取/version.json；私有测试源码版本读取 https://lextide-native-qa.aa1986884.workers.dev/health 。源码已持续更新，不能再把历史0.7.6/0.7.31描述当作当前状态。
- 语境服务已部署0.7.50的完成状态校验/固定错误码，health包含contextFailureCodes=true和16000ms等待期限；模型和AI/四个限流绑定保留。此前真实短语首次503及随后全200复查均保留，未宣称消除上游波动。
- 当前管理策略仍禁止安装该扩展。完整原生验收要求当前版本/指纹匹配的安装与offscreen报告，nativeAcceptancePassed仍为false；未自动启动交互式Colab，也未测得原生offscreen首次创建耗时。

## 历史：0.7.31私有云端测试入口更新（2026-10-21）

- 0.7.31私有源码包已发布，health返回0.7.31及源码20e496301dcbb3760a9ac1fda2d0fdfbd2c15dce；既有QA_TOKEN/QA_STORE绑定保留，无凭证访问manifest/bundle/latest/report均401。
- 新的完整验收必须同时匹配原生安装和offscreen查词报告，不能用旧报告或普通页面DOMParser测试代替。现有notebook下次交互运行将获取新包；本次未自动启动Colab，也未取得新原生安装报告。
- 网站0.7.31已发布v04-preview，1280/390远端检查通过。后续版本以线上version.json及私有health为准；当前受管理Chromium仍禁止安装。

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

## 0.7.5 当前状态（2026-10-20）

正文翻译已从MyMemory切换到现有Cloudflare AI Worker的/translate，模型@cf/openai/gpt-oss-120b。四个真实样例（否定/科学引用/负数/引用指令）全部HTTP200，631–1210ms。发布页面的真实共享阅读模块逐句4请求、缓存重读0新请求、逐段2请求均通过；原文恢复及手机布局通过。177自动测试和原有主要阅读回归通过，服务503模拟验证会暂停而不连续请求。

源码2248eec29ead876a4bb503353f4f6f443cf395b4，插件指纹14da0b578b2b3818a5512190f2eba2d8d185a14bb6e9e3918e0a3c0d698b4b08；公开version.json、后端功能health、私有中转health已核对。翻译验收为真实服务，不代表原生Chrome安装验收；后者仍无当前构建匹配证据。没有宣称MyMemory旧限流已解除，实际产品不再调用它。

## 0.7.4 当前状态（2026-10-20）

172自动测试通过；统一断句保留科学引用、长文650段跳读、550句单段和超过400句连续处理、离开旧句取消请求、晚结果丢弃、缓存复用、动态内容与源DOM恢复均通过共享界面浏览器回归。公开预览模块的550句单段跳到末尾测试只发出28次示例翻译请求，完整恢复源节点；线上查词断句保留Eq. (3) [12]。

源码aab33edc790b8f54df0583c55615cdcc6199c2e8，插件指纹4867112dae6c8895d184ecc35c993ce375c29f68966d41ebd6ac73bbd64c9250；私有中转health一致。翻译和词典为fixture，不代表真实MyMemory可用或原生安装通过。本轮未重测此前HTTP429服务限流，原生安装仍待匹配报告。

## 0.7.3 当前状态（2026-10-20）

168 自动测试通过。逐句模式的段内紧凑/段间留白在桌面和390px、源段落margin为零时均通过像素间距检查，停止后原文DOM和style精确恢复；原有逐句/切换/动态替换回归通过。线上预览读回0.7.3，模拟中文布局验证段末留白大于段内三倍。本轮未重新请求受限流的真实MyMemory服务。

源码 c047793aa0c362d2aaa5ed15ef56e4c54c4d6995；指纹 9ab0c47dbc484a64bf6cbe9ea388d4c503984597c4792e17fff108c006964dfc。私有中转health与源码版本一致，原生安装验收仍待匹配报告。

## 0.7.2 当前状态（2026-10-20）

168 自动测试通过。逐句设置、科学缩写/小数/数字引用、长段落逐句可视调度、链接/表格/列表保留、SPA 替换、晚响应丢弃、段句切换和关闭恢复通过共享 UI 浏览器验证；已在发布预览复验逐句选择和还原。原有段落排版、开关、浮标、上下文失效与双视口回归通过。

真实 MyMemory 本轮返回 HTTP429，实时译文复测未通过；新增限流暂停已用公开预览的模拟429验证，不会因滚动而继续请求。源码 2321d481cccbcf6af8392aca82c1e61f5bc69203；指纹 9908407c0a1b08004ffaecb27d7a91981c422b2774fa752ec15d97ec7af21f52。私有中转 health 已核对同一源码/版本，runner 增加逐句行为验收。没有当前构建原生插件安装通过证据。

## 0.7.1 当前状态（2026-10-20）

161 自动测试通过；鼠标拖动、真实 Chromium 触控输入、取消手势、长按设置、键盘移动、刷新位置保持、窄屏边界、关闭时单词无交互与重新开启恢复均通过共享 UI 浏览器测试；已在发布预览复验。链接恢复、翻译关闭、卡片拖动与扩展上下文失效回归通过。源码 efcd8b788da0eb3ca2acd7f13ff880c9839bc556；指纹 6e2a5acade3ff1b2aeabb875a61e9497db0f3603858a72de11194e1269049377；私有中转 health 已核对版本/源码。没有当前构建原生插件安装通过证据。

## 0.7.0 当前状态（2026-10-20）

160 自动测试、13 个真实词形语境回归、原有 10 个多义词回归通过，线上浏览器验证了实际候选来源与 AI 标签。最终源码 630b061ba7999b58227e5c86326bd4e968dce3fa；指纹 8a26acd84df72c6e38cb0e5d72934f28c9cd8f69090779940c06de6552e80469；私有源码及插件包同步。没有当前版本原生插件安装通过证据。

## 0.6.9 当前状态（2026-10-20）

Collins 源词头变形确认修复已发布，146 自动测试通过，线上浏览器 Hugging 真实查词与语境释义返回拥抱。源码 51b2189b40f2538096713e28c45184f3b06f0352；插件指纹 2323ed743a0266df6d3ad072c3c7c3cdc8f2d66917b5e080a7af9bb13cb75d9a，私有 Colab 源码同步。无当前构建原生安装验收通过证据。

## 0.6.8 当前状态（2026-10-20）

主按钮统一关闭查词和正文翻译。144 自动测试及浏览器开关回归通过；已发布页面读回 0.6.8，实测中文全部清除且重开查词不恢复中文。源码与私有 Colab 包为 22d8e6d8612c41afb8e8341ee9eb875620df8bd9；指纹 8a93274a6c1664e921f52d89041894f2825bbe2c481eda275d1dd49707f0894b。未运行此构建原生插件安装验收。

## 0.6.7 当前状态（2026-10-20）

143 自动/权限/生命周期测试通过；复杂网页正文、列表/表格/网格、隐藏内容、动态替换、视口调度与滚动位置保持浏览器测试通过；真实公开网页 DOM 与三个 MyMemory 样例通过。已发布 webpage.html 的真实翻译调用通过。

当前源码 42fe3e353f4170ecbe30bbeb6cc864561bf570e7，插件指纹 d3a480795c4d3a84108c4aa7f06da1834a6b828e625a5fe9c9c86239e485a474，私有测试包及健康读回已同步。Colab runner 加入复杂网页回归；没有当前构建原生安装通过证据。

## 0.6.5 当前状态（2026-10-20）

已接入并部署真实 Cloudflare Workers AI 语境接口。136 个自动测试通过，10 个实际 Collins 候选＋AI 多义词样例通过。安装版 Colab 验收源码已更新，须由现有交互 notebook 启动后产生匹配当前 fingerprint 的报告。当前没有 0.6.5 原生安装通过证据。旧本地规则验收已改为语境 API fixture 与独立 live API 验收，旧报告不能通过新验收。

# Native cloud acceptance status

Current candidate: 0.6.4 (exact source commit and fingerprint are recorded in the private QA manifest).
Its Youdao Collins, precise selection-context, movable-card, independent reading switches and local-ranking Colab suite is awaiting execution.
The evidence below is the historical 0.5.5 official-site run, not V0.6 acceptance.

Observed 2026-10-20, 10:38 China Standard Time.

- Tested source: `085687af0a282c25737c319124343b7bc3aab138` (0.5.5).
- Runtime: owner-started Google Colab, Chromium 151.0.7922.34.
- A real MV3 extension ID and matching build fingerprint were observed.
- All 13 installed integration fixture checks passed; no extension errors were reported.
- These fixture checks use synthetic dictionary HTML and cached translation text.
  They do not establish live Collins or MyMemory success.
- The live official English–Chinese request for laboratory returned HTTP 403.
  Its UI showed the access-denied message, not a parsed dictionary definition.
- One separate ordinary browser navigation to the official English entry ended
  at HTTP 403, title `Just a moment...`, with verification UI and no dictionary
  headword or definition. This was a labeled diagnostic, not extension evidence.
- Overall native acceptance remains FAILED. Successful bilingual lookup and
  cached-lookup speed have not been established. The 464 ms observed first
  attempt was an access denial, not successful dictionary latency.

This run establishes that the upstream verification gate affects an ordinary
browser in this cloud session as well as the extension request. It does not
identify the cause of the previous 0.5.4 partial English result, whose underlying
error was not recorded. It does not establish that local user-verified browser
sessions will behave the same way. No automatic verification bypass, alternate
IP retries, or silent switch of dictionary source was attempted.

Report and notebook credentials remain outside this repository. The same
notebook downloads the current candidate from the private bridge when started.
Historical reports do not establish acceptance of the new candidate.
