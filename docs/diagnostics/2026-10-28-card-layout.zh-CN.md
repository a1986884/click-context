# 2026-10-28 词卡信息顺序调整

预览：https://48bd43e2.lextide.pages.dev/

本次选用保留原生 #sense-choice 下拉的必做方案，不实现 radiogroup。名称、配色、图标等前一轮外观修改仍保留；README 宣传页改版仍暂缓。

## 展示结构

标题行包含单词、音标、朗读、收起和关闭。中文意思在 dict-body 顶部，中文旁显示单独的词性标签；来源行保留原 sense-status 文案。ENGLISH 使用 CSS 伪元素，不写进释义数据。英文解释后是原句，再是默认折叠的其他义项、双语例句和来源详情。底部收藏文案与状态沿用当前代码。

原句“当前句子：”和 sentence.textContent 保持不变；文本节点和 mark 节点构造高亮，无法按原位置验证时只显示原文。

## 词性

| 编码 | 展示 |
| --- | --- |
| N、N-*；兼容 NOUN | n. |
| V、V-*；兼容 VERB | v. |
| ADJ、ADJ-* | adj. |
| ADV、ADV-* | adv. |
| PREP | prep. |
| CONJ | conj. |
| PRON | pron. |
| DET | det. |
| EXCLAM | interj. |
| PHRASAL VERB | phr. v. |
| PHRASE、PHRASE-* | phr. |
| 空或未知编码 | 不显示 |

词性只作为展示字段，不写入生词记录。英文解释不再拼接词性；下拉各选项仍保留映射后的义项提示。

## 既有状态

- match：现有选义分支确认与词典中文义项一致；继续显示该词典义项与英文解释。
- nearest：既有结果带有对应 sense，但中文解释不同；保留该 sense.definition，标注“最接近的词典义项”。
- none：现有结果没有匹配 sense。不会按排序臆选最近词义；无英文解释时使用现有“暂未读取到英文解释，完整义项请查看词条来源。”提示。

不修改 context-meaning.js、vocabulary-data.js、workers/context、Collins 抓取/解析、翻译引擎、权限、存储、收藏和导出逻辑；已逐字节对比上传源码包内对应模块。

## 本轮改动文件

- src/reader.js：模板、展示用 POS、折叠容器和 data-sense-match/loading；现有事件绑定和词典选义分支保留。
- src/reader-style.js：本轮词卡字体、间距、移动端、深色、焦点和加载样式。
- tests/reader-card-layout.test.mjs：新增 5 项映射、顺序、状态、切换和加载失败测试。
- tests/browser/dictionary-card.mjs：新增默认折叠、POS 标签、选中词典义项断言。
- tests/browser/context-ranking.mjs、extension.mjs、save-state.mjs、manual-sense.mjs：先展开“其他义项”再操作原下拉；原功能断言保留。
- demo/card-qa.js、scripts/build-card-qa.mjs：六种状态的独立展示测试页，不连接真实 API。
- scripts/preview-worker.mjs：仅 card-qa.html 允许同源 iframe，用于实际 375/640px 子视口截图；普通预览页面继续禁止被嵌入。

前一轮更名、图标、样式和收藏按钮文案改动在当前工作分支中一并保留。前一轮 browser/favorite-resume、save-state、storage-capacity 对“收藏这次用法”的文案断言调整及 reader.test 高亮测试也保留。

## 验证

- npm test：1008 项通过，0 失败。
- npm run check：语法和 manifest 检查通过。
- git diff --check：通过。
- npm run test:browser：启动失败，缺少 Chromium。尝试 Playwright 官方下载仍失败；未声称完整浏览器回归通过。
- 云端 Chrome：实际渲染六种状态 × 浅/深色 × 375/640px，共 24 张截图。测试内容明确标注模拟数据，不代表 AI 语义验收。
- 默认示例：375px 卡高 412.44px，640px 卡高 439.53px，均无 dict-body 滚动；展开其他义项后内部滚动，底部操作保持可见。长释义和长原句不裁剪，可能需要内部滚动。
- 中文尺寸：375px 为30px，640px 为34px；标题20px。
- 主要字色/背景对比度：墨色/白 17.40，次要色/白5.36，次要色/批注底4.86；深色正文/卡片14.80，深色次要字/卡片6.79；黄色背景上的墨色13.68。

## 需手动验收

- iPhone/实际脚本管理器的字体、原生下拉和触控。
- VoiceOver/NVDA 切换释义播报、键盘展开和选义。
- 长中文、多音标、长原句和大字号系统设置下的滚动体验。
- 实际 AI 语义准确性不属于本轮展示验收，仍可能返回候选或失败。

部署为原 ux-161 预览分支，未更新 AI 后端或安装页，未推送/合并 GitHub。

## 后续：按用户上传的 closeread-card-preview.html 对齐

本节覆盖上文“保留原生下拉作为可见界面”的选择。用户进一步指定上传 HTML 的视觉效果，现改为 radiogroup 义项列表：中文在前、英文在后、浅黄选中底色和黄色左边线，当前项标注“当前所选”。原 #sense-choice 保留为隐藏兼容入口，每个新按钮只把所选 ID 交给原 onchange；没有修改匹配、排序或保存逻辑。可见列表支持方向键、Home/End 和按钮原生 Enter/Space，只有当前项可 Tab 聚焦。

按样稿调整了词性标签靠近中文、朗读图标、并排“其他义项／例句 · 来源”、铺满宽度的收藏按钮和原句区内侧竖线。保留收起功能、原句前缀和既有状态文案。

- 当前预览：https://472fc305.lextide.pages.dev/
- 1009 项单元测试通过；语法与 manifest 检查通过。
- 云端 Chrome 已实际验证点击“银行”时原下拉值同步为 money，中英文释义同步；ArrowUp 恢复 river；直接操作原下拉也能同步新列表。
- 完整本地浏览器测试仍因缺少 Chromium 未运行，不以云端单项检查冒充全量回归。
- 375px 的默认、展开、浅色和深色已截图检查；本节版本的截图与上文24张旧布局截图应分开看。

## 后续：英文解释被20词摘录截断

用户反馈 how 的英文解释缺失及义项省略号。本轮仅为词典解析返回值增加 displayDefinition 展示字段，保留原 definition 的20词摘录不变；context.cleanContext 仍只发送原 definition，AI 后端、匹配和收藏结构没有变化。词卡和义项列表优先显示 displayDefinition。未匹配但已返回候选词典义项时，提示改为“当前 AI 含义尚未匹配到词典义项；可展开‘其他义项’查看英文解释。”，不再误称读取失败。

当前预览：https://bd695fb5.lextide.pages.dev/

- 全量 npm test 1010 项通过；新增解析器保留完整展示字段的回归另行通过（相关21项全绿）；npm run check 通过。
- 真正查询 how 返回15条义项；5条显示超过20个英文词，2条上游原文自身含省略号，未补写缺失原文。
- 手选 how 的一个连词义项后，主卡显示完整的长英文解释，未被本地20词限制截断。
- AI 返回“怎样”仍属于未匹配词典的候选，不作为语义准确性通过。
- 修改文件：src/dictionary-extract.js、src/reader.js、src/reader-style.js；回归测试：tests/collins-bilingual.test.mjs、tests/reader-card-layout.test.mjs。
