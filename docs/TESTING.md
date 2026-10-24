## 0.7.86 修订协商与语义失败证据

85条件矩阵原始3次方向错误保留在其交接包。86加入这三条实际输出的拒绝回归、中性新题材正反例、有限规则不覆盖范围、旧提示字节散列及同一后台同时服务旧v2/新v3、未知修订不推理的契约检查。源码ZIP仍为35组普通浏览器；本版本真实模型验证必须在新部署后另跑一次并保留全部结果。

## 0.7.85 多引擎测试

统一普通浏览器回归新增 engine-settings 和 selection-engines，合计35组；包含真实设置页表单/IndexedDB、公开引擎元数据与独立选文卡/缓存切换/取消/原文链接恢复。Chrome接口和新厂商响应为合成契约，不是原生安装或各API真实联网通过。此前84及更早33组记录保留其历史范围。新提供商真实验收需要用户合法API凭据；密钥应在扩展设置页填写，不通过聊天或报告提交。

## 0.7.84 开源收尾验证入口

本节说明新增命令，不预告尚未完成的通过结果。逐代报告以当前交接包为准；下方72/73等记录保留为历史，不当作84通过。

`npm run audit:source` 查工作文件；`npm run audit:history` 查本地可达历史和嵌套Git bundle，需要非浅克隆，报告在test-results/history-audit.json。有限规则不是完整安全审计。

干净工作树中运行 `FRESH_DEPENDENCIES=1 npm run test:source-archive`：提取实际Git源码ZIP，不含.git；在提取目录 npm ci --ignore-scripts --no-audit（可复用npm下载缓存），不软链或复制既有node_modules；再跑语法、单元、完整33组普通浏览器、1280/390预览和插件包验证。dependencies字段与source-archive-steps日志区分fresh-npm-ci和默认软链模式。默认模式不声称全新安装。

GitLab CI已将普通浏览器与原生安装任务分开。完整历史需要GIT_DEPTH=0；原生任务仅在明确设置RUN_NATIVE_EXTENSION_ACCEPTANCE=1并手动触发、环境策略允许时运行，失败不放行。普通CI成功不表示原生任务运行过；未执行的原生验收仍为false。此处配置尚未在远端CI执行，不声称管线通过。

# Repeatable validation (updated for 0.7.73, 2026-10-22)

Requirements: Node 22+, Git, Python 3 (cloud source bundle test), and a
Playwright-compatible Chromium. `npm ci --ignore-scripts`, then:

```sh
npm run check
npm test
npm run test:browser
npm run build:preview
npm run test:preview
npm run package
```

The unified browser command builds first and runs 33 ordinary-browser suites.
It uses CHROMIUM_EXECUTABLE_PATH if supplied, otherwise existing system Chromium
or the installed Playwright executable. It does not install another browser or
alter policy. The aggregate report is `test-results/browser-suite.json`, with
per-suite logs in `test-results/browser-suite/`. Reports identify the actual
build fingerprint, source commit when known, and dirty state when Git exists.
Latest completed deterministic acceptance is 0.7.72: 297 unit/contract tests,
85 popup scenarios, twenty retry, 36 source/cache race and two cache-commit
cases within all 33 actual source-ZIP ordinary-browser suites, desktop/mobile
previews and package checks. Its real API run FAILED one conditional/Equation
sample with HTTP503/failureReason=invalid-result (three passed); its real reader
run FAILED in sentence translation, after one success and the second HTTP503/
invalid-result. Paragraph/cached reread/original restoration live phases were
not completed. Do not count these as live passes. The known category establishes
output validation, not which validation failed. AI service remains .70; no
Collins/AI rerun at .72, latest full six-context pass .68 and partial failure .70.
Context acceptance rejects model-declared incomplete output even when its JSON
looks valid. Service/client tests distinguish cancellation, deadlines, output
validation and inference failures without exposing raw model or error content.
The storage-capacity suite fills a disposable origin to a real localStorage quota
error, clears translation cache through settings, and verifies favorite recovery.
It also verifies that duplicate-only imports and absent-word deletion succeed
without allocating space at capacity. It does not measure chrome.storage quotas
or modify user browser data.
The vocabulary-backup suite downloads a real 2,248,925-byte JSON backup,
reimports it at desktop/mobile widths, and checks exact record round-trip,
non-destructive merge, deduplication and malformed-file protection.

From a clean tracked checkout, `npm run test:source-archive` creates a real
source ZIP and verifies its build, version metadata, desktop/mobile preview,
all ordinary-browser regressions and package validation without .git. The report
and per-suite logs are retained under test-results/source-archive*. Existing dependencies are reused through a
temporary symlink; this does not verify a clean dependency installation.

Live source parser parity: `npm run test:parser-parity-live` after building.
`npm run test:reader-context-live` runs the candidate reader against real Youdao
Collins entries (test-only Python transport bridge) and browser-native Workers AI
requests. Six public-safe contexts, per-use favorites and a cached repeat passed at 0.7.43.
The 0.7.48 live context reruns did not all pass: provider/context failures
and a correct synonym missed by the test matcher are retained as failed reports.
Live diagnostics now retain the failing card state, HTTP outcomes and network errors.
The 0.7.49 rerun passed all six contexts, saved uses and cached repeat;
0.7.48 failures remain archived. The 0.7.51 six-context rerun also passed.
Published phrase checks retain HTTP categories, actual version and failing card
state; a 0.7.50 first-run 503 and subsequent all-200 pass are both archived. Independent samples now all run before the final
all-pass assertion, and dictionary fallback is never counted as context success.
Published live translation checks:

```sh
npm run test:translation-live         # four public-safe backend samples
npm run test:translation-reader-live  # published reader: sentence/paragraph,
                                      # cached reread, bilingual off, original DOM
```

Both first fetch `/version.json` with no-store, retain the actual HTTP status,
version, commit and dirty flag in the report, and require a clean published
artifact matching the expected version AND commit before any inference. A clean
checkout defaults to its package version and Git commit. To test another
published artifact, or from a dirty/no-Git checkout, explicitly supply its
`EXPECTED_PREVIEW_VERSION` and `EXPECTED_PREVIEW_COMMIT`. `PREVIEW_URL` selects
the deployment. A mismatch fails with the actual metadata retained and no
translation requests; an unidentifiable expected commit is not accepted.
Reports include start/finish timestamps and never relabel the tested artifact
as the local package version. The reader report retains failed HTTP categories,
service codes and browser network failures and fails promptly rather than waiting
for a generic DOM timeout. This adds no product retry or provider/model change.

The 0.7.64 harness first reproduced the obsolete 0.7.5 version assertion against
the published 0.7.63 artifact. Its explicit 0.7.63 recheck then captured a real
translation HTTP 503 and paused queue. A later fresh 0.7.63 run passed all six
HTTP requests, sentence/paragraph display, cached reread and exact original-DOM
restoration. Both reports are retained: a later pass does not explain or resolve
the earlier service failure. Synthetic 503 diagnostics verify reporting only,
not provider availability. Fresh 0.7.64 and 0.7.65 deployment acceptance is
recorded in each versioned handoff. These are ordinary Chromium/service checks,
not installed-extension, offscreen or Safari/iPhone acceptance.
`npm run test:translation-diagnostics` is a separate, local synthetic suite:
HTTP 503, non-JSON 502, browser network failure, deadline, declared service
failure, invalid translation and normal success. Every case intercepts all
browser traffic, sends zero live-provider requests, and retains four independent
samples, each requested once. A failed sample keeps its HTTP status (or null
before any response), failure category and verdict; it cannot become a pass
because later samples succeed. The live API command uses the same collector,
retains all sample outcomes and then fails if any sample failed. The published
version/commit guard still runs before collection. The 22-second per-sample
deadline remains; synthetic deadline tests use a shorter fixture value. No
product retry, queue or model change is involved. The diagnostics report is
`test-results/translation-diagnostics.json` and must not be called live acceptance.

`npm run test:preview-diagnostics` separately checks the deployment metadata
gate with twelve fully intercepted cases: matching artifact, HTTP 503, non-JSON
502/200, browser network failure, deadline, wrong version/commit, dirty or
incomplete metadata and missing explicit expected commit. No inference is sent.
The live metadata fetch and JSON body read share a 10-second abort deadline;
failures retain the observed HTTP status (null before any response), version
when parsed, transport category and error type. A failed probe leaves both
verification flags false and stops the live command before sample collection.
Its short synthetic deadline does not change the live or product timeout.
Reports identify the actual candidate source; these fixtures are not a published
artifact or native acceptance. The API/reader live commands still need a fresh
run against the exact deployed version and commit.

The existing `test:sentence-translation` suite also runs twenty synthetic
reader outage/recovery checks: sentence and paragraph modes, 1100px and 390px,
and single-unit retry, settings retry-all, shutdown during a pending retry, and
immediate retry after source replacement or canonical text-node editing.
They assert one failed request pauses the queue despite scroll/resize, explicit
retry resumes it, successful results populate the normal cache, repeated reading
sends no extra requests, and shutdown restores exact source markup/link identity
while rejecting late UI/cache writes. Every network request is intercepted and
must remain absent. These cases are included in the same full 33-suite source
archive acceptance; no real provider or native pass is inferred. The report
records the actual package version/source, with archive provenance unknown when
.git is absent. The original twelve static-source cases passed at 0.7.66/67; eight dynamic-source
cases extend that coverage at 0.7.68. Before the fix, immediate retries resent
removed sentences before the 150ms mutation scan. Explicit retries now reconcile
the source first. Request order still follows viewport scheduling; the fixture
requires exactly the current source texts and correctly ordered DOM output,
without requiring network requests to run in source order.

`npm run test:module-diagnostics` verifies five fully intercepted module cases:
HTTP503, a 200 response with HTML media type, network failure, dependency HTTP502
and success. It sends no inference. The published-reader live report now keeps
`moduleResponses` (public path, HTTP status, content type),
`moduleNetworkFailures` (path, browser error), and `activePhase`, separately from
translation responses. Bodies and URL queries are omitted. Metadata rejection,
module/mount failure, sentence/paragraph translation and original restoration
can be distinguished without retrying imports or relaxing acceptance. The
0.7.68 real first module failure still has unknown HTTP status; synthetic
reproductions do not retroactively establish its cause.

Translation Worker fault contracts now verify bounded failure reasons while
preserving the legacy unavailable code and pause behavior: inference/output
validation, caller cancellation, deadline including late binding rejection,
health capability and legacy clients. A mocked deadline verifies the configured
16000ms value without waiting sixteen seconds. Fake private errors/output must
not appear in responses. `npm run build:context-worker` separately emits the
public module, SHA256 and actual source metadata; a clean local artifact is
not a deployment or provider pass. Preserve remote code/settings before any
compatible diagnostic update; no secrets, model, limits or logs are changed.

The sentence-translation browser suite also runs 28 synthetic source/cache
race checks: paragraph/sentence, 1100/390px, delayed cache miss/hit with hidden
source, source replacement, CSS content-visibility, translate=no, closed
disclosures, and late successful translation after hiding. The fixed
checks reject old/hidden text before inference, reject hidden cache hits and
late DOM/cache writes, and retain current host text-node identity and attributes
on stop. Node contracts separately cover late failures as well as successes.
These are actual DOM and held-promise fixtures with zero provider requests.

At 0.7.70 all original 24 browser race cases and five Node cases failed. The
0.7.71 fix reuses the scanner's exclusions on each original node and its ancestors,
including reader-owned hidden originals. It rechecks after cache waits, before
requests and before applying results/errors. A stale record triggers existing
source reconciliation so a loading record is not stranded or repeatedly polled.
The 150ms mutation coalescing and request scheduling intervals stay unchanged;
there is no polling or new automatic retry. Already-started storage operations
remain governed by the existing cancellation contract. The latest artifact's
versioned reports record acceptance, not this description alone.

The source/cache browser cases extend to 36 at 0.7.72, adding prefix text and
inline elements without editing the old text nodes (paragraph/sentence,
1100/390px). Two additional host-observer cases edit the source immediately
after rendering, before deferred cache persistence begins. A source is not
current merely because its old nodes/text still exist. At async boundaries the
translator consumes already-queued foreign mutations through its existing
scope reconciliation, then checks the snapshot. Idle edits retain the 150ms
coalescing timer; there is no polling or new retry. Unrelated edits must preserve
a valid waiting unit without another cache read or request. The deferred cache
callback checks again immediately before invocation; storage writes that have
already started retain the existing contract. In the host-observer case the
first request precedes the edit; only the updated source is newly persisted.
All of these cases use synthetic transport and zero real-provider requests.

A .72 diagnostic retained a Node/linkedom long-paragraph slowdown rather than
changing tests or runtime behavior to hide it. Linkedom subtree child-list
records use the observation root as target, so removed text from owned UI can
look foreign. Its 100-sentence synthetic run recorded 200 reconciliations;
ordinary Chromium recorded zero for 100 sentences and one for 620, with exactly
one synthetic translation per sentence and source text restored. These bounded
counts are diagnostic observations, not CPU, native-extension or universal
speed acceptance. The .72 handoff includes the script/report and the original
full Node test log; all unit assertions still run unchanged.

Translation parser/service contracts now distinguish existing validation
failures without loosening the guards: incomplete provider output, invalid text,
missing numeric values, and sanitized unknown exceptions. Validation metadata is
whitelisted and only emitted for the actual validation stage; inference errors
cannot forge it. Success results, model, prompts, deadlines, retry bounds and
legacy pause/error behavior remain unchanged. New health capability, clean
compiled artifact, remote code/settings verification and fresh provider results
must be recorded separately if the service update is published.

On an unrestricted native test host, run the separate `test:offscreen-extension`
and `test:extension` commands as described in OFFSCREEN.md. This environment
still reports blocked-by-policy; no native pass or creation timing is claimed.
Cloudflare preview publishing recovered at 0.7.29. Verify the current published
version at /version.json; remote UI tests can set EXPECTED_PREVIEW_VERSION.
CI and interactive Colab now run the unified suite, but these configuration
changes have not been executed by the remote services in this session.

---

# Validation record — 2026-10-19

## Current V0.5 plugin candidate

- 91 Node/DOM/parser/storage/package-validation tests pass.
- 1280px and 390px preview browser tests pass with explicit synthetic dictionary
  responses, including consent, all modes, search/import/undo/export and reload.
- Real development-environment Collins lookup returned `ocean` Chinese and English
  excerpts. Ordinary Chromium navigation to the public Chinese entry returned
  HTTP 200 and a recognizable word entry. These are source-access observations,
  not installed-extension results.
- A fixed real MyMemory request returned Chinese translation successfully. A
  separate deployed-preview browser smoke test also passed the explicit non-live
  Collins sample and a real custom-paragraph MyMemory bilingual translation;
  evidence is in test-results/live-preview-report.json.
- The Pages deployment succeeds, but its live Collins endpoint returns an
  unavailable result because the upstream public site rejects the server request.
  The preview offers a clearly labeled non-live card example separately.
- A fresh installed V0.5 Chromium run is blocked before fixture checks by:
  `Loading of unpacked extensions is disabled by the administrator.`
- ZIP validation now uses actual JavaScript module parsing rather than regex
  imports, so quoted import-like text in bundled parser code is handled correctly.
- Exact build fingerprints, report and candidate ZIP metadata are in test-results/
  and build/packages/. No native installation or physical iPhone pass is claimed.

## Historical V0.4 continuation

## Uploaded backup continuation — 2026-10-19

Website continuation: **78 Node/DOM/build/preview-handler tests passed**.
Chromium 154 headless web-preview checks pass at 1280×800 and 390×844:
mouse lookup, vocabulary save/export/persistence, all three modes, article
switching, horizontal bounds, no JavaScript errors and no provider requests.
These runs exercise the generated Pages preview handler, not an installed
extension or physical phone. The demo word-button mouse regression is covered
separately; ordinary host page buttons remain excluded from mouse lookup.

The same web checks also passed against the deployed HTTPS preview
`https://v04-preview.lextide.pages.dev/`. Its version endpoint reports clean
source commit `d3a98ebf50bfa7b1d06d6fac9f2d0d0a5c82786c` and version `0.4.0`.

Restored the uploaded V0.4 backup in a new local Git repository. This local
repository does not replace the GitLab recovery history recorded below.

- Node/DOM and build-evidence regression tests: **76 passed**, zero failures/skips.
- Syntax/manifest checks, source credential-pattern scan and both builds passed.
- System Chromium **154.0.8037.57** launches headlessly, but reports
  `Loading of unpacked extensions is disabled by the administrator.`
  Installed-extension verification remains **blocked**, with no fixture checks
  passed. No browser policy was changed. Safari/iPhone remain untested.
- The harness accepts `CHROMIUM_EXECUTABLE_PATH` for an installed Chromium,
  removes Playwright's default extension-disable argument, and limits waiting
  for the extension worker to 15 seconds. The default pinned Playwright
  browser path remains supported.
- Reports now record a SHA-256 fingerprint of the unpacked extension files.
  Packaging uses a report only if both fingerprint and extension version match;
  a matching commit alone is insufficient. Legacy reports without a fingerprint
  are treated as unverified. `release.json` records both the build fingerprint
  and the originating test commit.

Example on a machine permitting unpacked extensions:

```sh
npm run build
CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:extension
npm run package
```

Use `HEADED=1 xvfb-run -a` when testing native toolbar behavior in CI. Headless
results, when available, are not physical iPhone or Safari evidence.

## Provenance

Approved local recovery baseline: `255a5b32535a32d26df32d09affe2260d3448908`.
Final GitHub V0.3 `ae86dbb53e4abee446ddb7ca17ac6edb319a2b14` is unavailable.
GitLab recovery snapshot: `b177aa77ca8893d5f8ae8a9f875d893e168759fb`.
The preserved local history has 10 commits; the GitLab snapshot is a new commit.
See recovery/README.md and its verified Git bundle for original local history.

## Executed in Work

| Check | Result |
| --- | --- |
| Recovery baseline syntax/manifest | Passed |
| Recovery baseline Node/DOM tests | 62 passed |
| V0.4 Node/DOM tests | 75 passed, zero failures/skips |
| Chromium build and ZIP | Built; module/resource paths checked |
| Safari candidate build and ZIP | Built; upload/runtime NOT verified |
| npm audit including dev dependencies | Zero reported vulnerabilities at check time |
| Installed Chromium launch | Blocked: browser executable not installed |
| Playwright Chromium download | Failed: download was not a valid ZIP |
| GitLab pipeline execution | Blocked before jobs by identity verification |
| iPhone / Safari / Edge / Firefox installation | Not tested |

Pipeline https://gitlab.com/abcmikedick/lextide/-/pipelines/2962565249
shows **Verify your identity to run this pipeline**; it has no executed jobs.
No browser-version or trace success is claimed for this cycle. The historical
evidence ZIP is for an earlier failed run (SPA paragraph not translated), not
the recovered final V0.3 or V0.4. It is not reused as a pass.

Node/DOM cases cover semantic/div/nested words, punctuation and morphology,
selection/links/forms, all three modes, independent word switch, cache expiry,
retries/HTTP errors, cancellation/late failures, repeated restore, preference/
vocabulary migration, policy/tab isolation, touch movement suppression, viewport
zoom calculations, provider replacement and response-body timeouts. They do not
prove native browser permission behavior or physical phone touch behavior.

## Installed test harness ready to run after identity verification

`installed-chromium` uses Playwright's pinned preinstalled Chromium Docker image
and real MV3 build with a fresh persistent browser profile. Actual browser action
Popup is driven via CDP. It checks worker context replacement (target IDs can be
reused), current-tab control, separate origins/tabs, reload, vocabulary export/
delete and zero provider requests without consent. The fixture uses seeded
translation cache; that does not establish live-provider availability.
Trace, screenshots, report and package metadata are retained as private CI artifacts.

For optional public probes on an authorized CI runner:

```sh
HEADED=1 LIVE_SITES=1 LIVE_SERVICES=1 xvfb-run -a npm run test:extension
```

This command sends only fixed fixture text to providers after explicit test
consent. Public probes keep networking off. Respect access and consent walls.

## Current public-site matrix

All entries below are **not tested in the V0.4 installed extension** because the
browser could not launch. Earlier partial injection reports are not promoted.

| Type | URL | V0.4 installed result |
| --- | --- | --- |
| Blog / legacy rich markup | https://paulgraham.com/read.html | Not tested |
| News | https://www.bbc.com/news | Not tested |
| Technology / dynamic | https://www.theverge.com/ | Not tested |
| Technical documentation / code | https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Introduction | Not tested |
| Encyclopedia / long / formulas | https://en.wikipedia.org/wiki/Ocean | Not tested |
| Local complex SPA fixture | tests/browser/extension.mjs | Harness implemented; installed run blocked |

## Release gate

Keep V0.4 as a draft/beta until real installed Chromium checks pass. Next verify
native optional permission grant/revoke, remembered site after browser restart,
provider failures and the website matrix. Safari remains a candidate until Apple
accepts the ZIP and TestFlight iPhone testing is recorded. No automatic merge.

## Real Collins browser component test

Run `CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:collins-browser`.
This opens an ordinary public Collins page, runs the production official lookup,
memory cache and reader modules there, and physically clicks plain English text.
No response fixtures, Node proxy fetch or fake extension APIs are used. It checks
network consent, real bilingual results, source labels, repeated queries without
network traffic, saving a word, and the 390px dictionary bounds. It writes
`test-results/official-browser-report.json` and desktop/mobile screenshots.

This is deliberately a component test: the page is same-origin with Collins.
It does not test an installed extension, cross-origin host permissions, MV3
messages, toolbar authorization or service-worker lifecycle. The native installed
suite remains `npm run test:extension`; a policy-blocked load must stay blocked.

Timing starts from the real click and ends after the UI check and two animation
frames. Playwright polling/evaluation can add overhead, so these measurements
are observed end-to-end upper bounds, not a precise browser paint metric. Provider
elapsed time and request counts are also recorded separately. Network latency
varies; cache hits must make zero extra requests.

## GitLab native Collins acceptance

The installed-chromium job now uses LIVE_COLLINS=1. In addition to installed
fixture checks, it removes dictionary interception and queries laboratory from
an ordinary local article through the real extension background worker. It
requires both official page requests on the first click, zero requests on the
repeat click, Chinese plus English content and official-source attribution.
A failed live dictionary check now fails the suite; passing fixtures cannot
mask it. MyMemory is not required for this Collins-specific acceptance run.
Reported click-to-card timings include browser automation and polling overhead.

## Content lifecycle recovery fixture

After npm run build, run `CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:content-reload`.
This ordinary-browser test deliberately invalidates a synthetic extension runtime
while lookup/translation is active or removes its runtime identity. It verifies
that the bundled production content script restores the article, stops messages,
removes listeners and displays one refresh/dismiss notice without uncaught errors.
The fixture is not an installed-extension test and does not replace native update
acceptance. Results: test-results/content-reload-report.json.

Candidate release.json separates extensionTests (the installed-suite result),
offscreenTests and nativeAcceptancePassed. A passed partial suite is not complete
native acceptance. Packaging and the private bridge share scripts/native-acceptance.mjs;
both native reports must identify the current exact extension version/files.
