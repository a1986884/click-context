## 0.6.7 补充核对：真实网页处理

2026-10-20 核对 [沉浸式翻译高级规则](https://immersivetranslate.com/docs/advanced/) 与[官方仓库说明](https://github.com/immersive-translate/immersive-translate/blob/main/README_english.md)。当前产品未开源，不能声称读取了当前实现；公开规则显示它把正文范围、排除范围、内联/块元素和动态站点作为独立适配问题处理。

另读归档 [old-immersive-translate/pageTranslator.js](https://github.com/immersive-translate/old-immersive-translate/blob/6df13da22664bea2f51efe5db64c63aca59c4e79/src/contentScript/pageTranslator.js) 和 [specialRules.js](https://github.com/immersive-translate/old-immersive-translate/blob/6df13da22664bea2f51efe5db64c63aca59c4e79/src/lib/specialRules.js)，以及前次已保存的 chrome-translate renderer、FluentRead mutation 模块。只参考文本节点分组、范围排除和变动监听的设计，没有复制代码，也没有安装这些第三方扩展。

本轮独立实现 `src/prose-units.js`：按文本节点与块边界分组，优先 main/article；读取可见文字，跳过控件/代码/隐藏内容/不翻译标记；嵌套列表、混排段落、表格和换行不再依赖叶子 p/div。译文在原节点旁或列表/单元格/网格项内部插入，保留原始节点和事件。动态刷新只重扫变动区域，按段取消旧请求；全文模式切换仍可恢复原节点。

已在普通 Chromium 中验证混排网页结构、动态替换和窄屏，也对博客、MDN、Wikipedia 的真实 DOM 验证并分别实际翻译一个样例段落。其余排版响应为明确标记的合成测试；这不等于原生插件安装验收，更不等于兼容所有网站。旧记录中的“仍使用本地规则”“没有进行中请求合并”等描述是当时状态，后续版本已分别接入语境 AI、候选请求合并；正文当前仍使用 MyMemory。

---

# Lextide 同类开源实现核对

核对日期：2026-10-20。通过公开 GitHub 文件页面读取源码；未安装或运行这些第三方项目。以下是静态实现证据，不代表性能、准确率或兼容性已通过实测。没有发现能据此认定已可靠解决 Collins 官网验证的实现。

## 核对对象和版本

| 项目 | 核对提交 | 与 Lextide 的关系 |
| --- | --- | --- |
| oyyd/youdao-collins-chrome-extension | ee4b6f3f16c1c0ebd6d2b86155da76c7aede9f07 | 从有道 HTML 解析 Collins 多义项和例句；旧 MV2 扩展 |
| fishjar/kiss-translator | aa70b16e4c5e2d2f6fb32f3148ded54c4cd872cd | 语境 AI 词典、语境缓存、浏览器本地模型 |
| mengxi-ream/read-frog | 71bff241d719b3db090e9da6d9013926cb28e6d1 | 阅读翻译请求队列、批处理、合并与取消 |
| FluentRead/FluentRead | 2cff10745b42bc15d5329aeb2bf6d15e923c3a86 | 选区上下文定位、阅读请求生命周期 |
| lete114/chrome-translate | faab76488bf2693d1025e3a212bd40be83198376 | Chrome 内置本地翻译、可见段落与动态节点调度 |
| contextreader/contextreader.github.io | e5084e4d22247476af5955603a966be73383af47 | 上下文释义；实际为用户自备 Gemini 密钥 |

## 1. Collins 数据来源

[oyyd 解析器](https://github.com/oyyd/youdao-collins-chrome-extension/blob/ee4b6f3f16c1c0ebd6d2b86155da76c7aede9f07/src/parse.js#L238) 从 `.collinsToggle` 下的 `li` 提取义项，`getMeanings` 使用 `.collinsMajorTrans`。它也有普通有道释义分支，不能把所有返回都称为 Collins。

这为 Lextide 的有道 HTML 路线提供了直接先例，但不解决缺词、版本完整性或长期可访问性。其 MV2 manifest 不能原样作为现代 Chrome 产品发布。Lextide 已采用独立 MV3 实现，并验证 Collins 双解区域；无该区域时应明确说明缺失。

## 2. 根据句子选义：AI 解释与词典选义有区别

[KISS apiDict](https://github.com/fishjar/kiss-translator/blob/aa70b16e4c5e2d2f6fb32f3148ded54c4cd872cd/src/apis/index.js#L840) 接收 `text`、`context`、页面信息及模型配置；[handleNativeDict](https://github.com/fishjar/kiss-translator/blob/aa70b16e4c5e2d2f6fb32f3148ded54c4cd872cd/src/apis/trans.js#L1023) 将上下文注入词典提示词。结果是 AI 生成 Markdown，并未在这条路径中强制选择真实 Collins 义项 ID。

[Context Reader background](https://github.com/contextreader/contextreader.github.io/blob/e5084e4d22247476af5955603a966be73383af47/background.js#L269) 直接调用 Google Gemini `generateContent`，读取用户 API key；`lookupModeDefault` 把目标词和上下文填入提示词。因此“无自建服务器”不等于“无外部 API”，也不提供 Collins 数据保证。

**Lextide 可借鉴的改法**：继续获取真实 Collins 候选；让本地模型只返回候选 ID 或 `unknown`，界面展示原词典文本。解析失败、ID 不存在、证据不足均回退人工选择。限制候选可以避免生成释义冒充 Collins，但不能保证语境判断正确，仍需独立测试集。

## 3. 不调用外部模型 API 的实际路线

KISS 存在实际浏览器推理源码，而非仅在 README 声称支持本地 AI：

- [llm-worker.ts](https://github.com/fishjar/kiss-translator/blob/aa70b16e4c5e2d2f6fb32f3148ded54c4cd872cd/src/localAi/workers/llm-worker.ts) 导入 Wllama 和随构建打包的 WASM，在 Worker 中加载和运行模型。
- [llm-onnx-worker.ts](https://github.com/fishjar/kiss-translator/blob/aa70b16e4c5e2d2f6fb32f3148ded54c4cd872cd/src/localAi/workers/llm-onnx-worker.ts) 使用 Transformers.js、onnxruntime-web 及 `pipeline("text-generation", ...)`；模型读取经本地 OPFS 桥接。
- [modelManager.ts](https://github.com/fishjar/kiss-translator/blob/aa70b16e4c5e2d2f6fb32f3148ded54c4cd872cd/src/localAi/core/modelManager.ts) 管理下载、暂停、文件导入及 SHA256 校验；扩展中委托 offscreen 宿主管理。

因此无需把阅读句子交给外部 AI 服务也有实现路线，但用户需要先获得模型文件，设备资源、首次启动、模型许可与实际准确率都需要验证。尚未测出适合 Lextide 的模型或速度，不能承诺秒开或达到通用消歧质量。当前 Lextide 仍是规则排序，没有接入这些模型。

## 4. 语境缓存不能只以单词为键

[KISS apiDict L873-L903](https://github.com/fishjar/kiss-translator/blob/aa70b16e4c5e2d2f6fb32f3148ded54c4cd872cd/src/apis/index.js#L873) 将选区上下文和页面信息摘要纳入 `contextSig`，并纳入提示词、语言、provider 和版本信息。这样同一个 bank 在河岸与银行句子里不会直接复用同一份 AI 解释。

Lextide 当前缓存的是词典候选，每次结合当前位置重新排序，这一点正确。若加入模型结果缓存，需要另建包含选词位置、上下文、候选版本、模型版本的缓存键；不能覆盖候选缓存或只按 lemma 存最终含义。

## 5. 速度、重复请求和取消

[Read Frog request-queue.ts](https://github.com/mengxi-ream/read-frog/blob/71bff241d719b3db090e9da6d9013926cb28e6d1/src/utils/request/request-queue.ts) 对相同请求去重，合并订阅 scope；只有最后一个使用者取消时才终止共享请求。使用 AbortController、超时和重试策略，429 暂停有独立预算。[batch-queue.ts](https://github.com/mengxi-ream/read-frog/blob/71bff241d719b3db090e9da6d9013926cb28e6d1/src/utils/request/batch-queue.ts) 聚合批次，对返回数量不匹配进行有限重试。

Lextide 的 `src/dictionary-cache.js` 已有完成结果缓存，但没有进行中请求表：同一词在首次查询完成前被并发请求，仍可能重复访问来源。可以先补上共享进行中请求和独立订阅取消；不能让一个弹窗关闭把其他标签页仍需要的查询一起取消。

## 6. 选错句子、动态网页、迟到响应

[FluentRead selectionContext.ts](https://github.com/FluentRead/FluentRead/blob/2cff10745b42bc15d5329aeb2bf6d15e923c3a86/src/features/reading-assistant/selectionContext.ts) 在最小正文块内遍历文本，计算真实选区偏移，排除输入框、隐藏内容、代码和扩展译文；归一化后验证选词仍匹配，失败就退回选词本身。重复单词定位依赖选区偏移，而非全段第一次 `indexOf`。

[FluentRead background.ts](https://github.com/FluentRead/FluentRead/blob/2cff10745b42bc15d5329aeb2bf6d15e923c3a86/src/features/reading-assistant/background.ts) 按 tab、frame、document 隔离请求，同页新操作取消旧操作，设置超时，并检查响应是否仍属于当前请求。这有助于避免快速连续划词、跳页后旧结果覆盖新卡片；不等于可以恢复已被 Chrome 撤销的扩展运行上下文。

Lextide 已有查词 requestId、取消与失效清理，但当前 `sentenceAt` 使用简单正则分句，`sentenceContext` 再以字符串搜索回推位置。下一步应核对缩写、小数、跨内联标签、重复句子，以及翻译节点混入的情况。

## 7. 正文双语翻译也可以走本地

[chrome-translate Chrome provider](https://github.com/lete114/chrome-translate/blob/faab76488bf2693d1025e3a212bd40be83198376/src/core/provider/chrome.ts) 检测 `window.Translator`，调用 `availability/create/translate`，显示模型下载进度，并按语言方向复用初始化 Promise。此处调用的是浏览器接口，而非远程翻译 HTTP 服务；实际可用性必须运行时检测，不能仅依赖版本号。

[renderer.ts](https://github.com/lete114/chrome-translate/blob/faab76488bf2693d1025e3a212bd40be83198376/src/core/renderer.ts) 使用 IntersectionObserver 观察可见内容、MutationObserver 观察新增内容，设置有界并发队列，并按语言和文本缓存译文。

这适合 Lextide 的正文英中对照功能，但 Translator 本身不能直接完成“从 Collins 多义项中选 ID”。下载语言模型与本地推理能力在当前 Lextide 云端浏览器尚未验证。

## 建议的迭代顺序与验收

1. **先改语境采集**：按 DOM Range 捕获纯正文、保持选词偏移；检验相同词多次出现、短语、隐藏内容、扩展译文、缩写小数。词典请求仍只发送查询词。
2. **补进行中请求合并**：同词并发只访问一次源；一个使用者关闭不影响其他使用者；取消后无迟到 UI 写入；失败后能重新查询。
3. **本地模型做可选选义实验**：固定真实候选和人工标注语境集，比较当前规则与模型；测冷启动、热启动耗时、内存、下载体积、选义准确率及拒答情况。模型只返回有效 ID 或 unknown，不生成 Collins 内容。
4. **正文接入浏览器本地翻译作为可选引擎**：能力探测、下载提示、暂停取消、译文节点幂等；现有远程引擎应明确标识，不能静默把本地模式切到远程服务。

开源代码许可与词典/模型数据许可是不同事项。上述为架构借鉴，未复制第三方实现；直接引入代码前需核对对应版本 LICENSE 与依赖条件。具体性能和安装结果只能在运行后报告，本次没有给第三方项目或新 Lextide 本地模型做运行验收。
