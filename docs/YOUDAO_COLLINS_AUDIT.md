# 有道公开 Collins 栏目抽样评估

检查日期：2026-10-20（北京时间）。这是内容审查，不是插件安装或 Colab 网络验收。

## 判断

适合作为普通英文阅读的主要查词来源之一；本次抽查证据不足以将它称为
完整、最新版、与 Collins 官网等量的词库。常见多义词内容丰富，但新词、
部分技术词、现代 AI 语义和短语独立检索存在明显缺口。

## 方法与边界

定向选取 17 个真实词/短语，涵盖常用词、多义词、词形、短语、专业词、
现代语义、新俚语和拼写变体；另用一个虚构词作负例，并额外检查 ice
主词条是否收录 break the ice。逐页核验 #collinsResult 和 Collins 栏目标题，
只统计该栏目，不将普通有道释义或机器翻译算作 Collins。每个页面只请求
一次，不保存整页词典正文，只保留审查指标。

17 个真实查询中，13 个独立页面返回 Collins 栏目；break the ice 的独立页
没有该栏目，但 ice 主词条包含这个短语。因此不能把独立页缺失直接解释
为短语未被 Collins 收录。这是非随机小样本，不能换算为全词库覆盖率。
所有样本页均返回 HTTP 200，包括虚构词，故 HTTP 成功不等于词条存在。

## 抽样结果

“解释块”包括独立义项、派生词、短语和交叉引用，并不等于义项数。
例句数仅统计带中英文且至少两段文本的 .examples 容器。

| 查询 | 类别 | 当前公开页面 | 解释块 | 双语例句组 |
|---|---|---|---:|---:|
| available | common | 有 Collins 栏目 | 3 | 4 |
| laboratory | common | 有 Collins 栏目 | 2 | 2 |
| run | polysemy | 有 Collins 栏目 | 59 | 57 |
| set | polysemy | 有 Collins 栏目 | 31 | 29 |
| bank | polysemy | 有 Collins 栏目 | 12 | 8 |
| listed | inflection | 有 Collins 栏目 | 9 | 7 |
| went | inflection | 有 Collins 栏目 | 1 | 0 |
| take off | phrasal verb | 有 Collins 栏目 | 5 | 5 |
| look up | phrasal verb | 有 Collins 栏目 | 2 | 2 |
| break the ice | idiom | 当前页无 Collins 栏目 | — | — |
| photosynthesis | technical | 有 Collins 栏目 | 1 | 0 |
| backpropagation | technical | 当前页无 Collins 栏目 | — | — |
| hallucination | established word / AI sense | 有 Collins 栏目 | 1 | 1 |
| prompt | established word / AI sense | 有 Collins 栏目 | 4 | 4 |
| large language model | new technical phrase | 当前页无 Collins 栏目 | — | — |
| rizz | recent slang | 当前页无 Collins 栏目 | — | — |
| colour | spelling variant | 有 Collins 栏目 | 15 | 17 |
| lextidezzword | invented negative control | 当前页无 Collins 栏目 | — | — |

## 重要发现

- available 的 3 个块实际上包含 2 个形容词解释和派生词 availability。
- run 有 59 个解释块和 57 组双语例句；set 有 31 个块和 29 组例句；
  bank 有 12 个块，包含银行和岸等不同含义。只提取首义会丢失大量已有内容。
- listed 页面词头为 list；went 页面只有过去式说明，不能直接当成独立实义。
- take off 和 look up 有独立 Collins 栏目；break the ice 要回到 ice 查看。
- photosynthesis 有 Collins 解释但本次页面没有双语例句；backpropagation
  的页面没有 Collins 栏目。
- hallucination 仅观察到普通幻觉义；prompt 观察到促使、提示、立即/迅速等
  传统用法，未观察到 AI 专门解释。进一步核对 Collins 官网的 hallucination
  词条发现，其 COBUILD 栏目已有人工智能生成错误信息这一含义；有道当前页面
  未显示该义。这是明确的新语义覆盖差异，不只是“这个词是否能搜到”。
- large language model 和 rizz 的独立查询未返回 Collins 栏目，而 Collins
  官网存在这两个词的英文条目。这能证明有道当前页面不等同于官网全部内容，
  但双解版和英文版属于不同产品，不能据此计算某一版本的缺失率。

## 对插件的建议

1. 支持多个义项和对应例句，保持来源清晰；派生词、词形提示和交叉引用分开显示。
2. 支持短语及主词条关联；不能把精确路径查询失败直接当成整个词典未收录。
3. 明确区分“有道有翻译”和“有道有 Collins 栏目”，缺失时不以其他来源冒充。
4. 面向技术/AI 文章时要明确可能缺失新词和新义，保留官网入口。
5. 内容抽样通过不能代替 Colab 中的实际扩展请求、速度和稳定性验证。

## 核对来源

- https://dict.youdao.com/w/eng/run/#collinsResult
- https://dict.youdao.com/w/eng/bank/#collinsResult
- https://dict.youdao.com/w/eng/available/#collinsResult
- https://dict.youdao.com/w/eng/ice/#collinsResult
- https://dict.youdao.com/w/eng/rizz/
- https://dict.youdao.com/w/eng/large_language_model/
- https://dict.youdao.com/w/eng/hallucination/#collinsResult
- https://www.collinsdictionary.com/dictionary/english/hallucination
- https://www.collinsdictionary.com/dictionary/english/rizz
- https://www.collinsdictionary.com/dictionary/english/large-language-model

插件运行代码和默认查询渠道没有因这次审查而改变。
