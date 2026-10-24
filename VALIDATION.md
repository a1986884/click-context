# 验证记录 · 2026-10-18

> 历史记录，非 V0.4 验收结论。当前云端结果和阻塞原因见 docs/TESTING.md。

- `npm run check`：通过，所有 JS/MJS 语法及 MV3 基本权限检查。
- `npm test`：14/14 通过，包括两篇示例文章全部英文词逐个点击并核对释义的 DOM 交互测试。
- `npm run build`：通过，生成静态 Demo 与可加载 Chromium 扩展。
- MyMemory 实际请求：HTTP 200，`ocean` 返回“海洋”。
- Free Dictionary API 实际请求：此云端环境返回 HTTP 403，英文词典联网功能未能端到端验证；代码已验证中文/英文服务各自失败时的降级。
- 可视浏览器 QA：未完成。Work 的预览服务启动因 `bwrap: Can't mount proc ... Operation not permitted` 失败，没有替换或绕过容器限制。
- 实体 iPhone 与浏览器安装扩展：未验证；DOM 测试不等同于实体设备或浏览器验收。
- GitHub：已创建私有仓库 https://github.com/p22wbmgjn2-hash/lextide，28 个项目文件已提交（功能提交 `02e5294275b7ed4d15cc7f517863382e0d0de340`）。首次 GitHub Actions 的依赖安装、代码检查、14 项测试与构建均通过；运行记录：https://github.com/p22wbmgjn2-hash/lextide/actions/runs/39139761835 。
- Cloudflare Pages：配置文件和说明已完成，尚未获得用户账户授权，未部署至用户 Cloudflare 账户。

- 私有在线 Demo：Sites 已部署，地址 https://lextide.nutmegmochi67.chatgpt.site ，访问限项目所有者；iPhone 请使用同一 ChatGPT 账号登录。

联网 API 结果会随配额、地区与服务状态变化。部署结果以实际托管平台返回状态为准。

## 2026-10-19 交互更新

- 小球默认关闭；短按同时开启或关闭双语与正文查词，关闭会移除译文并关闭词典。
- 长按 550ms 打开设置，松手不切换；触摸移动与取消会取消长按。
- 首次联网仍需明确勾选许可，许可后自动继续翻译。
- 19 项自动化测试通过，包含手势、总开关、关闭后的异步结果隔离和联网许可。
- Cloudflare Pages 首次部署已成功：https://lextide.pages.dev/ 。此前已在云端浏览器验证示例单词点击和双语译文插入；实体 iPhone 与 Safari 扩展仍未验收。

