# 语境精读 · Closeread 用户脚本

为英语学习者设计的网页精读插件。当前源码为 **0.8.0 候选**；公开安装服务已提供 **0.8.0 用户脚本试用版**（2026-10-29 核验，来源提交 `f4264c2`），尚无 GitHub Release。安装前请核对[版本信息](https://click-context-install.aa1986884.workers.dev/release.json)和脚本头版本。

## 安装与构建

- [公开安装页](https://click-context-install.aa1986884.workers.dev/)：需先安装并启用兼容的脚本管理器；公开地址当前提供 0.8.0 试用版。
- 构建当前源码：在项目根目录运行 `npm ci`、`npm run build:userscript`，将 `build/userscript/click-context.user.js` 导入管理器。
- 脚本命名空间、文件名、更新地址及存储键保持兼容，已有收藏和设置无需迁移。

## 操作

每页默认关闭；点击右下角书本启用。长按约半秒进入阅读设置；单击暂停/恢复，拖动调整位置。支持点击单词、划选短语查询、选文翻译、逐段/逐句双语、原文/双语/译文模式、生词收藏、编辑与 JSON 备份。

账号中的聊天会员通常不含 API 额度，真实 API 接入取决于凭据与服务。

[实际发布状态](../docs/RELEASE_STATUS.zh-CN.md) · [完整功能与隐私说明](../README.md) · [引擎与 API](../docs/TRANSLATION_ENGINES.zh-CN.md) · [改版前全部历史说明](../docs/legacy/userscript-before-0.8.zh-CN.md)
