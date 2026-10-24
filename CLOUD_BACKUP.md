# Lextide · 词汐 V0.4 云端备份

## 当前续开发副本 · 2026-10-19

本目录由上传的备份恢复后继续修改，已加入测试构建指纹校验、系统 Chromium
测试选项和启动阻塞诊断。76 项测试通过；Chromium 154 可以启动，但管理员
策略禁止加载未打包扩展，因此安装验收仍受阻。详见 docs/TESTING.md。
这些修改保存在本地 Git，尚未推送到下述 GitLab 仓库或更新 MR。

## 原上传备份的来源记录

源码对应 GitLab 提交 a16bc87acaaeca280cb12fb2bf0c250e6286d7f2。
私有仓库：https://gitlab.com/abcmikedick/lextide
草稿 MR：https://gitlab.com/abcmikedick/lextide/-/merge_requests/1

恢复自用户批准的旧本地 V0.3 255a5b3；最终 ae86dbb 仍未找回。
recovery/local-history.bundle 保存原有 10 个本地提交，patch 保存原未提交修改。

源码、测试、文档、CI 配置与两个扩展 ZIP 均在本包中；未包含 node_modules 或登录凭证。
Node/DOM 测试 75 项通过；JUnit 的父测试表示为 suite，因此有 74 个 testcase。
真实 Chromium 安装受环境与 GitLab 身份验证阻挡；Safari 候选包尚未由 Apple 接收或真机验证。
Cloudflare 本轮没有新预览。具体见 docs/TESTING.md 和 docs/SAFARI.md。

继续开发：npm ci --ignore-scripts；npm run check；npm test；npm run build；npm run package。
