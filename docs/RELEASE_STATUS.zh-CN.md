# 语境精读 · Closeread 0.8.0 发布状态

核验日期：2026-10-29（北京时间）。本记录是核验快照，后续版本请以对应提交、CI 和在线版本信息为准。

| 项目 | 实际状态 |
| --- | --- |
| GitHub main | 0.8.0 候选源码已通过 PR #4 合并，核验基线 `f4264c2fb9f7e96bed550597cee50c8e180f0f8a` |
| GitHub Release | 核验时尚无 Release |
| 公开安装服务 | `release.json` 与 `.meta.js` 均为 0.8.0 用户脚本试用版 |
| 安装服务来源 | `sourceCommit: f4264c2fb9f7e96bed550597cee50c8e180f0f8a` |
| 脚本 SHA-256 | `fd7a386081a7eafaa88cfebc93b543bbb311ef1779eb24aa271001b16cbd81a2`（服务声明；本轮未重新下载完整脚本校验） |
| 实际安装与 API 验收 | 服务标记 `tampermonkeyInstalled`、`iPhoneAcceptancePassed`、`realVendorAPIsTested` 均为 false |

[公开安装页](https://click-context-install.aa1986884.workers.dev/) · [版本信息](https://click-context-install.aa1986884.workers.dev/release.json) · [脚本元数据](https://click-context-install.aa1986884.workers.dev/click-context.meta.js) · [GitHub Releases](https://github.com/a1986884/closeread/releases)

线上服务来源与各项验证状态见上表。

对外名称统一为“语境精读 / Closeread”。`click-context` / `lextide` 存储键、脚本命名空间、脚本文件名与更新地址、Worker 服务名/兼容标识及既有域名继续保留，避免破坏已有设置、收藏和自动更新。旧版本说明、Git 历史及历史归档保留原名；新的用户脚本交付 ZIP 使用 Closeread 名称。
