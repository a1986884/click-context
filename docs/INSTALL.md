# Desktop installation and controls

Extract the Chromium ZIP (`lextide-chromium-<version>.zip`) and verify its SHA-256
against the accompanying sha256.json. In desktop Chrome open chrome://extensions
(Edge: edge://extensions), enable developer mode, choose Load unpacked and select
the directory containing manifest.json.

Open an English article and use the browser toolbar icon to enable that tab.
Remember this website only if you want persistent site permission. Networking is automatic once that tab/site is enabled; no separate network
switch is needed. Paragraph translation starts only when its reading mode is enabled. Dictionary queries send the word/expression and bounded entry expansions to the Youdao public
Collins section. Contextual interpretation separately sends the current sentence, occurrence and candidate excerpts to Cloudflare Workers AI; body translation uses its translation endpoint. No Collins API key is used.

## Floating control and reading settings

- **主按钮**: clicking OFF stops both lookup and body translation, removes Chinese/cards and restores links. Clicking it again enables lookup only; translation remains off until enabled in settings. While lookup is on, links inside the
  reader do not navigate and eligible English link text can be queried. When off,
  plain-word clicks do nothing and normal links work again. Reader-owned source
  links and controls stay usable. Long-press 550ms or use Shift+F10 for settings.
- **正文双语翻译**: long-press the floating lookup icon and use the switch in
  reading settings to turn paragraph English–Chinese display on/off. It does not change lookup or link behavior. Off restores original text
  and cancels pending translation work. There is no second floating translation button. Advanced original/translated
  modes remain in reading settings.
- Drag the dictionary title strip to move it, use “−” to collapse it, and use
  “自动位置” to restore automatic positioning. Escape closes the card.

The preview contains a real ocean hyperlink in the article to demonstrate lookup
versus navigation. The extension reads Youdao directly; the auxiliary website
uses a same-origin relay to the same provider. Neither guarantees full Collins
coverage. Official-site session reuse from older 0.5.x builds is no longer active.

Vocabulary is stored locally. Export it before replacing or uninstalling the
extension. After replacing the unpacked extension files, click Reload in
chrome://extensions and refresh already-open articles. Chrome desktop and iPhone
Chrome do not share extension installations. See SAFARI.md for the unverified
Safari candidate. Current native extension installation acceptance is pending.

Known limits: PDF, canvas, cross-origin frames and closed Shadow DOM are not
supported. Sentence translation loads visible text in batches as you scroll; there is no 400-sentence page cutoff. Individual prose runs still have text-size guards.
Providers may reject or throttle requests. No account or cloud vocabulary sync
is included.

## Extension context invalidated

After updating/reloading an unpacked extension, refresh each already-open article
page as well (Ctrl+R on Windows, Command+R on Mac), then enable that tab through
the toolbar if needed. Reloading only chrome://extensions does not reconnect old
page scripts. This runtime error happens before Collins lookup, so it says
nothing about dictionary access or a previous HTTP 403.

From 0.5.4, the content runtime detects invalidation, stops its old jobs/listeners,
restores the original article and presents a single “刷新当前网页” button. Refresh
is user initiated; no automatic reload interrupts the page. This future recovery
logic cannot repair pages still running older extension scripts: refresh them
once after installing the update.

### 悬浮图标（0.7.1）

拖动“查词”图标可调整位置，刷新后保留；也可聚焦图标后用方向键移动。点击开关查词，关闭时同时停止正文翻译，普通单词不再触发查询；链接恢复正常。长按或 Shift+F10 打开设置，设置内可重置图标位置。

### 逐句双语（0.7.2）

长按“查词”图标打开设置，开启“正文双语翻译”，在“双语对照”中选择“逐句对照（适合长段落）”。每个英文句子后显示对应中文；默认仍为逐段，可随时切换。逐句会按可视句子翻译并缓存，关闭图标后全部移除；重开查词不会自动重开正文翻译。纯译文模式保持按段显示。一个链接本身跨多个句子时会合并该组句子，保留链接。此项处理网页文本；Chrome 内置 PDF 阅读器仍不支持扩展。

### 长文与缓存（0.7.4）

查词与逐句翻译共用论文断句规则，避免把 Eq. (3) 等引用截断。逐句模式随滚动继续加载，支持跳到文章后部；离开当前句子时会取消尚未完成的请求，优先处理新的阅读位置。翻译缓存按文本复用，分为16块，各块最多256条、128KiB，有效期仍为7天；容量用尽会逐出较旧条目。设置中的“清除翻译缓存”会同时清理旧缓存与新缓存。

### 正文翻译服务（0.7.5）

正文英中翻译与单词语境分析均通过现有Cloudflare服务，由不同接口和限流规则处理；字典词条仍取自有道的Collins英汉双解。客户端不包含API密钥，不再请求MyMemory。译文会校验数字及结果完整性；服务失败或限流会暂停后续请求，可在设置中重试。旧MyMemory缓存不会标为新服务译文，也不会覆盖生词本。


## Build from the source ZIP

With Node 22+, extract the source archive and run `npm ci --ignore-scripts`,
then `npm run build:preview` or `npm run build`. Git history is optional.
Without it, preview/package metadata records an unknown commit unless a valid
RELEASE_COMMIT/CI_COMMIT_SHA/GITHUB_SHA is supplied; dirty state remains unknown.
The generated local preview is not automatically deployed. `npm run package`
validates and produces the Chromium ZIP and separate untested Safari candidate.

If saving reports full storage, clear translation cache in reading settings and
retry. Your favorites are retained. If favorites reach 5,000, export and organize
them before saving more; clearing translation cache does not change that limit.

Vocabulary JSON imports accept files up to 16 MiB, with at most 5,000 records.
Import validates and merges records, retaining existing saved uses. Larger files
are rejected before reading. Export keeps all current favorites.

If existing favorite data cannot be read, saving/importing/deleting is blocked
to preserve it, and export reports the failure rather than downloading an empty
backup. Preserve the original stored data and check a known-good backup before
repair; the product does not automatically erase or replace unreadable data.
