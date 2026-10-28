# Changelog

## 0.8.0 — 语境精读 / Closeread 候选 — 2026-10-28

- 展示名称、荧光笔界面、词卡顺序、完整英文义项、AI 英文解释回退、书本开关与官网/README 改版。
- 本次扩展与用户脚本代码版本为 0.8.0；历史 0.7.98 原生包与 0.7.161 脚本记录不改写。保留存储键、脚本文件名、命名空间和 Worker 名称。
- 公开安装页及正式后台未在本次更新，AI 语义准确性仍有未解决情况。
- 原首页完整内容归档至 [改版前 README](docs/legacy/README-before-0.8.md)，用户脚本历史归档至 [改版前脚本说明](docs/legacy/userscript-before-0.8.zh-CN.md)。

Current candidate changes and measured validation are recorded in [docs/ITERATIONS.md](docs/ITERATIONS.md) and [docs/TESTING.md](docs/TESTING.md). The dated entries below are historical.

Use semantic versions MAJOR.MINOR.PATCH; every candidate records its commit,
recovery provenance, browser version when tested, and verification limitations.
Reserve release tags for verified builds; keep merge requests unmerged for review.

## 0.5.0 — plugin candidate — 2026-10-19

- Use on-demand Collins public-page Chinese and English excerpts for plugin word
  lookup, with source links, bounded requests and explicit unavailable states.
- Keep paragraph translation bilingual by default; MyMemory remains distinct.
- Allow remembered-site changes while the current tab is active; forgetting a
  site retains that temporary tab without restoring automatic future access.
- Add actionable network consent and a shared searchable vocabulary interface
  with sorting, validated import, full export and undo deletion.
- Include parser dependency notices and update permission/privacy documentation.
- 91 Node/DOM/parser/storage tests passed; native installation remains a release
  gate. See docs/ITERATIONS.md for stage evidence and the next improvement plan.

## 0.4.0 — recovery beta — 2026-10-19

- Fix demo mouse lookup on keyboard-accessible word spans while preserving host
  website button exclusions; expose vocabulary directly in the mobile toolbar.
- Add an optional self-contained Pages preview build and desktop/mobile browser
  checks for lookup, all modes, vocabulary persistence/export and offline isolation.

- Continue from uploaded backup; add exact-build fingerprints to installed-test
  reports and packaging so modified files cannot inherit stale passing evidence.
- Support system Chromium in the integration harness; bound worker startup waits
  and report administrator extension-loading restrictions as blocked.
- Continuation verification: 76 Node/DOM/build-evidence tests pass; system Chromium
  starts but unpacked extension loading is blocked by administrator policy.

- Recover approved older V0.3 snapshot and original local history on private GitLab.
- Add GitLab verification/build/installed-test artifact pipeline.
- Fix pending mutation timer restart and late paragraph error insertion.
- Keep offline extension cache misses quiet while preserving explicit consent status.
- Extract translation Provider, preserve pacing and enforce response-body timeout/abort.
- Add browser namespace adapter, Safari-targeted candidate ZIP and packaging guidance.
- Improve visible-viewport card bounds, touch scroll suppression and dark-mode UI.
- Preserve existing vocabulary/policy data; add regression and installation-test evidence.
- Installed Chromium and Safari validation are blocked/pending; see docs/TESTING.md.
