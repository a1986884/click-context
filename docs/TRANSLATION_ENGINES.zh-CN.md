# 独立翻译引擎：产品与接入约束

用户已确认：保留 Collins 词典卡，另加选中文本翻译；正文与选文各选引擎，接入自带 API。下一阶段不再只围绕开源检查迭代。

## 产品范围

- 正文翻译与选文翻译分别选择配置，能够选择同一服务的不同模型/密钥配置。
- 点击词条仍显示 Collins 原义及明确标识的 AI 语境释义。选文直译另有入口，不冒充词典原义，不因为纯选择动作自动联网。
- 第一批适配官方 Google Cloud Translation、Microsoft Translator，以及 OpenAI 兼容、Anthropic Messages、Gemini GenerateContent。服务预设和自定义配置使用相同协议适配器，模型 ID 可编辑，不把某个过期型号或服务清单写死成能力。
- Google/微软官方 API 与网页翻译、会员订阅是不同服务。各 AI 的聊天会员不保证提供 API 额度。插件不会复用会员 Cookie、抓取私有接口或绕过访问控制。
- 目前以英文到简体中文阅读为基线；多语言选择、流式展示和更大批量并发另行以实际测试推进，不预报已经支持。

## 性能、准确性与安全

1. 按配置隔离缓存，切换后取消旧请求，旧结果不能写入新配置缓存；同文重读复用本机缓存。
2. 调度间隔按引擎设置，避免把现有 Cloudflare 专用节奏强加给用户 API。先测延迟和失败率，再提高并发；不宣称未实测的毫秒数或准确率。
3. AI 提示保留否定、条件方向和数字，拒绝明确截断或空结果。Google/微软也校验响应结构与完整文本，不能把 HTTP 200 当作语义正确。
4. 密钥保存在扩展自身的 IndexedDB，仅扩展后台及受信扩展设置页管理；不返回网页端，不进入偏好/生词本导出、日志或缓存命名。此存储不是硬件加密保险箱。
5. 服务地址仅允许 HTTPS（显式本机模型允许 loopback HTTP），禁止 URL 凭证/查询密钥；后台限制重定向。更换地址来源后不得无提示复用旧密钥。访问权限由扩展设置页在用户手势中按精确来源请求。
6. 不静默回退至其他服务，以免用户文本发给未选择的服务或产生额外费用。官方 API 的真实联网验收必须由有效凭据完成；模拟协议通过不得改标为真实服务通过。

## 对标资料状态

早期官网服务文档请求返回 HTTP 403 / 1010，GitHub连接不可读。0.7.87于2026-10-22通过网页工具读到[官方流量包页面](https://immersivetranslate.com/zh-Hans/topup/)与[会员价格页面](https://immersivetranslate.com/en/pricing/)，当时列出的模型家族包括OpenAI、Claude、Gemini、DeepSeek、GLM、PLaMo及DeepL。预设覆盖这些服务家族，但不声称覆盖全部地区/时期/会员型号；实际模型ID不写死，API账号可用型号也不等同于会员列表。

## 0.7.85 使用方式与验证范围

工具栏 → 翻译引擎 / 我的 API → 新增配置 → 选择服务、填完整 API 地址和实际模型 ID、填 API 密钥（微软按资源要求填区域）→ 分别选择正文与选文 → 保存并授权服务主机。已有密钥不回显；留空保留，明确勾选才清除。更换地址来源需重新填密钥。连接测试只翻译一条公共示例，可能消耗服务额度，不自动发送文章。

| 协议 | 服务预设 |
| --- | --- |
| OpenAI Chat Completions | OpenAI、DeepSeek、通义/百炼、Kimi、智谱/GLM、豆包/方舟、xAI/Grok、PLaMo、硅基流动、Ollama、自定义兼容 API |
| OpenAI Responses | OpenAI及采用同协议的自定义服务，完整地址可修改 |
| Anthropic Messages | Claude |
| Gemini GenerateContent | Google Gemini |
| Google Cloud Translation v2 | Google（需要自己的 API 凭据） |
| Microsoft Translator v3 | Microsoft（需要自己的 API 凭据/区域） |
| DeepL API | DeepL；免费/付费账户的地址不同，可修改 |

预设地址可以修改，模型 ID 由账号实际可用范围决定。OpenAI 与兼容接口可以选择 max_tokens 或 max_completion_tokens；输出预算仍有限。需要额外厂商专属参数、非标准 JSON 结构或新的接口协议的模型，不保证仅填模型 ID 即可运行；后续根据实际模型反馈补齐，不能用“兼容”覆盖此限制。

确定性证据包含原生协议请求/解析、密钥不回显/错误不泄露、超时/取消/截断/数字校验、缓存隔离、后台授权/待发请求取消、切换一侧不影响另一侧，以及真实浏览器设置页/IndexedDB和选文DOM（桌面/390px）。这些使用原创假凭据/模拟响应，不代表取得各付费 API 的真实通过。实际本版本完整回归、发布和真实默认服务结果见交接包，原生安装仍单独验收。

## 条件方向规则修订（0.7.86）

85默认服务真实条件矩阵有3/7语义失败，不能当作准确性已完成。86新请求使用v3平衡提示与有限条件方向校验；旧79–85缺省v2客户端仍保留原服务契约，建议更新以使用新规则。新v3客户端不会读取v2缓存，用户API配置也分离新提示缓存；不删除生词、偏好或API密钥。

校验主要针对单一可识别if/only-if/iff的明显方向丢失；复杂嵌套、术语、假设问句及其他语义仍可能出错。被拒结果不显示、不缓存，保留原文并允许用户重试/换引擎。没有用固定样本译文替代模型输出。新真实结果以本版本报告为准，不能把85旧失败覆盖为通过。

## Responses 接入（0.7.87）

服务选择“OpenAI Responses / 兼容接口”，使用完整 `/v1/responses` 地址和账号实际可用模型 ID。旧 Chat Completions 配置保持原协议，不根据 URL 猜测或静默转换；正文和选文可分别选择。兼容服务的实际能力由其实现决定。

适配器按[官方 Responses 接口说明](https://developers.openai.com/api/reference/resources/responses/methods/create)发送 instructions/input/max_output_tokens，明确 store=false、stream=false、background=false；每个片段独立，不建立会话或复用响应ID。store=false 是请求参数，不等于对第三方服务保留政策的保证。只接受已完成的助手文本，忽略推理条目，遇拒答、工具调用、截断、错误或未知输出结构整体失败，不能返回片段。沿用22秒请求/读体截止、256KiB响应上限、数字/有限条件方向校验，不自动重试或回退。

本次未引入新的配置字段/存储结构，旧配置UUID、隐藏密钥及未改动配置的缓存保持稳定。Responses输出预算有界，包含模型思考消耗；模型若需专属参数或更高预算仍可能失败，不能承诺所有型号都能运行。无真实OpenAI凭据，当前证据是模拟请求/响应与普通浏览器设置页验收，不能称真实OpenAI API通过。

PLaMo预设依照[官方接口说明](https://docs.plamo.preferredai.jp/en/api)，使用新的 api.platform.preferredai.jp Chat Completions 地址、Bearer密钥和有界max_tokens，沿用OpenAI兼容适配器，丢弃reasoning字段。官方文档重点为日语/英语能力；英文到中文质量没有真实凭据验证，不因存在API就保证译文质量。新预设不是对旧停用地址的兼容承诺。

## 撤销权限与正在进行的请求（0.7.90）

撤销一个API主机仅停止使用它的任务；撤销当前网页授权仍停止该页查询。无关主机撤权不应中断另一侧翻译。请求还在等待配置时，也在发网前检查撤权历史；历史有界或事件格式不明时保守取消。撤权后新请求仍需浏览器权限检查，重新授权后可重新发起翻译，不自动切换引擎。

匹配依据：[Chrome permissions](https://developer.chrome.com/docs/extensions/reference/api/permissions)、[Match patterns](https://developer.chrome.com/docs/extensions/develop/concepts/match-patterns)。本次仅模拟Chrome事件/网络响应验证，原生安装管理策略未改，也未用真实厂商凭据联测。

## 官方机器翻译的分片请求（0.7.91）

Google、微软和DeepL的官方机器翻译协议改为每片最多4000个UTF-16单元，继续按完整句子/空白边界拆分并串行发送。正文与选文使用同一执行器，仍分别选择各自配置。Cloudflare默认服务及OpenAI Chat、Responses、Claude、Gemini保留1200上限，不提高模型输出预算或增加并发。

依据：[Google配额](https://docs.cloud.google.com/translate/quotas)推荐每请求不超过5000个码点、Basic请求不超过100K字节；[微软限额](https://learn.microsoft.com/en-us/azure/ai-services/translator/service-limits)为跨目标语言50000字符；[DeepL限额](https://developers.deepl.com/docs/resources/usage-limits)为总请求128KiB。4000个UTF-16单元是保守上限，码点数不超过该值；固定JSON结构及转义后也远小于上述请求字节限制。更大请求可能增加单次响应等待，减少请求数不等同于已经验证端到端提速。

模拟源文本5039字符从5次请求减为2次，2000字符选文从2次减为1次；测试还核对源文本覆盖、Unicode/转义内容、请求大小、后片失败/数字丢失整体报错、取消后停止，以及AI仍为5片。没有真实厂商凭据测速或质量验收。每请求22秒截止、响应256KiB上限、主机授权、失败不回退、原文恢复均沿用；缓存继续复用同配置下已验证的完整译文，不重置用户密钥/偏好。


## 用户脚本 0.7.124：点击语境 AI 独立选择（本地开发，非原生发布）

用户脚本设置新增第三项“点击查词 · 语境 AI”，可选择内置或已经保存的 AI 配置。OpenAI Chat/Responses、Claude、Gemini 及兼容预设使用各自协议，返回有校验的词条JSON；原句精确出现位置和词典候选作为数据。Google、微软、DeepL保留正文/选文角色。不会因内置失败自动改发用户API，也不会因用户API失败改发内置。

修改或测试配置都沿用 GM 私密存储、安全输入和精确服务来源确认，只有主动点词/测试才发所需文本。更换语境不停止另一侧翻译；缓存按所选配置隔离。真实厂商账号、原生管理器及iPhone均未验收，本段不代表原生98或公开110安装页拥有此功能。界面示意及本轮结果见[用户脚本交接说明](../userscript/README.zh-CN.md)。
