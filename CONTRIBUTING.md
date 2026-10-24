# 参与开发

点击语境查词 / Click Context 面向英文网页的点击查词、语境释义、选文翻译与双语阅读。代码使用 MIT 许可；词典内容及外部服务的权利与条款独立，见 [许可说明](docs/LICENSES.md)。

## 本地验证

使用 Node.js 22 或更新版本：

```sh
npm ci --ignore-scripts
npm run check
npm test
npm run build
npx playwright install --with-deps chromium
```

浏览器测试默认尝试 `/usr/bin/chromium`。其他环境请把 `CHROMIUM_EXECUTABLE_PATH` 指向已获准使用的 Chromium；GitHub Actions 会使用 Playwright 安装的浏览器路径。不得为避开现有管理策略更换浏览器或修改策略。

```sh
npm run test:browser
npm run test:userscript
npm run audit:source
npm run audit:history
```

普通浏览器使用合成提供商数据、模拟 GM/Chrome API 或 DOM 行为测试，不能证明扩展、Tampermonkey、Safari 或 iPhone 已安装。默认 GitHub CI 不执行付费 API 测试或真实模型推理，不部署服务。只有手动运行工作流并勾选原生验收，才启动独立的安装/真实公共服务检查；这些检查受实际浏览器策略和服务状态约束。工作流配置存在不表示已在远端通过。

用户脚本版本位于 `userscript/version.js`；原生扩展版本保持独立，不能为了用户脚本变更把旧原生报告改成新版本。真实服务检查请显式运行 `npm run test:userscript-quality-live`，一次有限运行会保留独立报告；失败不能反复重试直到绿，不能用词典回退冒充 AI 成功。打包另要求对应版本、指纹、人工复核与源码重建证据，普通 CI 构建文件不等于已验收发行包。

## 修改原则

- 修复前先复现；测试应验证行为、取消/竞争、原文恢复与来源归属。
- 正文、选文、点词语境分别路由，不静默切换服务。相同词典原义显示原文，生成含义明确标 AI。
- 不删除收藏或覆盖已有用法；读取失败不当成空配置，不泄露密钥或原始服务商错误。
- 提交可复现的最小变更，并记录验证范围及遗留问题。不要提交 `.env`、访问凭证、私人网页、生词本或浏览器配置。

一般缺陷请附版本、运行环境、公共复现样例及去敏错误文字。敏感问题按 [安全说明](SECURITY.md) 处理，不把秘密放在公开 issue。
