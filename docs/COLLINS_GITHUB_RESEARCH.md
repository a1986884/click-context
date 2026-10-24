# Collins GitHub 项目核对与建议

日期：2026-10-20（北京时间）。本次是项目检索、关键源码核对和有限公开接口
探测，没有更改插件默认数据源，没有运行新的 Colab 原生插件验收。

## 结论

本次没有找到已经验证同时满足“无需密钥、无人机验证、最新完整 Collins
英汉双解、可直接作为成品分发”的项目。找到三个可区分的技术方向：

1. 有道公开 Collins 页面或结构化查询：可提取已有双解，不能补齐不存在的新词、新义。
2. MDX/MDD 本地词库阅读器：能把网络验证移出日常查询路径，但必须另有可使用
   的 Collins 词库文件，格式支持、词库版本、内容覆盖和分发许可需分别核对。
3. Collins 官网解析器或正式 API 客户端：前者没有证明解决当前验证问题，
   后者仍需要有效密钥以及满足英汉双解的数据权限。

## 核对项目

| 项目 | 已观察到的实现 | 对 Lextide 的价值与限制 |
|---|---|---|
| oyyd/youdao-collins-chrome-extension | README 明确来源有道；parse.js 解析 collinsToggle、多个解释和例句；后台获取网页 | 可参考数据结构和多义项组织；旧 event page 架构不能直接作为现代 MV3 成品，且其非 Collins 自动回退行为不能冒充 Collins |
| zerolfx/shanbay-helper | 当前 README 为 MV3 0.2.1；background.js 请求 dict.youdao.com/w/eng/，credentials omit，超时与短缓存 | 实证有道公开页面方案适用于 MV3 的现有项目；不能由此证明 Lextide 在 Colab 的真实请求已通过 |
| fengdh/mdict-js | mdict-parser.js 使用 FileReader + File.slice 按需读本地 MDX/MDD；解析文件头部注明 MIT | 最有价值的浏览器离线引擎路线；README 仍有 TODO，AMD/依赖与资源渲染需要现代化，源码注明某些大文件和注册密钥格式不支持 |
| terasum/js-mdict | 当前 package.json 7.0.0、AGPL-3.0、Node 引擎；README 提供 MDX/MDD 接口 | 可研究索引和格式兼容；不是可直接插入 MV3 的纯浏览器成品，也不是 Collins 词库授权 |
| Konyaco/CollinsDictionary | README 明确解析 Collins 在线官网；AGPL-3.0，作者说明未获 Collins 授权 | 不是可证明免验证码的官方接口，不解决当前上游限制；未确认满足英汉双解要求 |
| Black-Cyan/collins-dictionary | README 使用 Collins 官方 API，明确要求 API Key | 可参考正规客户端结构；无法消除密钥和数据权限要求 |
| skywind3000/ECDICT | README 的 collins 字段是柯林斯星级 | 不能因字段名而把其英文/中文释义称为 Collins 英汉双解 |

## 有限结构化接口实查

GitHub 的 creatcode/api/YoudaoDic.md 描述了有道 jsonapi 查询及 collins 字段。
本次仅发送普通 HTTPS 查询 q 和 dicts，不使用别人的密钥、设备标识或签名。

- laboratory：HTTP 200，存在 collins.collins_entries。
- available：HTTP 200，Collins 词头为 available，包含三个解释块；检测到
  同一记录的英汉文本、词性字段与双语例句结构。派生词块仍要单独处理。
- hallucination：HTTP 200，有 Collins 字段，本次未观察到 AI 专门含义。
- rizz：HTTP 200，但没有 collins 字段。

所以这是“结构化获取现有 Collins 内容”的候选，而不是更完整的新版词库。
它不是本次确认的正式对外服务合同或稳定性保证，也未完成扩展跨域实测。
本次未把响应正文或第三方词库内容提交到本仓库。

## 建议的产品结构

优先评估“用户可使用的 Collins MDX/MDD 文件一次导入 → 本地索引 →
本地点词查询”。这能减少联网和人机验证对日常查词的影响；词库版本决定
覆盖范围，离线并不自动意味着新版或完整。文件留在用户浏览器，Cloudflare
继续承担测试源码和报告传递，不承担未经确认许可的 Collins 词库分发。

未导入词库时，可让用户选择已明确标注的有道 Collins 在线渠道；缺词时
保留官网入口，不能用普通有道释义或 AI 生成内容冒充 Collins。

先用自行编写、具有明确使用权的小型 MDX 夹具验证浏览器引擎、后台索引、
安全渲染和查询行为；该测试只证明引擎，不得记作真实 Collins 数据验收。
取得可使用的真实文件后，再做文件兼容、词形、短语、多义项、新义和真实
云端扩展测速。当前尚未确认可随插件分发的完整 Collins 双解数据包。

## 已核对源码快照

- oyyd：ee4b6f3f16c1c0ebd6d2b86155da76c7aede9f07，src/parse.js、src/event_page.js。
- shanbay-helper：d55c92edf5935f3a81245c3d0d2ef34610a1aeba，src/js/background.js。
- fengdh/mdict-js：efc3fa368edd6e57de229375e2b73bbfe189e6ee，mdict-parser.js。
- ECDICT：bc015ed2e24a7abef49fc6dbbb7fe32c1dadaf8b，README.md。

GitHub REST 连接返回账号停用错误，因此没有重复尝试 API；以上源码通过
正常公开 GitHub 页面读取，没有启动任何仓库脚本或使用页面中的临时 token。

## 主要来源

- https://github.com/oyyd/youdao-collins-chrome-extension
- https://github.com/oyyd/youdao-collins-chrome-extension/blob/master/src/parse.js
- https://github.com/zerolfx/shanbay-helper/blob/master/src/js/background.js
- https://github.com/fengdh/mdict-js
- https://github.com/fengdh/mdict-js/blob/master/mdict-parser.js
- https://github.com/terasum/js-mdict/blob/master/package.json
- https://github.com/Konyaco/CollinsDictionary
- https://github.com/Black-Cyan/collins-dictionary
- https://github.com/skywind3000/ECDICT
- https://github.com/creatcode/api/blob/master/YoudaoDic.md
