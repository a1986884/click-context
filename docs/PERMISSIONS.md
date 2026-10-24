# Browser permissions

This describes the current Chromium manifest, not historical 0.5/0.6 providers.

- `storage`: profile-local settings, favorites and translation cache; session storage for temporary site grants and dictionary candidates. Existing favorites are retained.
- `activeTab`: user-initiated access to the current tab. There is no automatic all-site static content script.
- `scripting`: inject the bundled reader on activation and register it only for explicitly remembered, granted origins.
- `offscreen`: lazily create one hidden extension document with reason `DOM_PARSER`, discovered through `runtime.getContexts`. It accepts only same-extension bounded dictionary HTML, uses native DOMParser and shares the extraction/validation layer. It receives no article pages and has no network code; its CSP denies connections, images, frames and other remote resources. Creation failure is explicit, with no alternative parser fallback.

The fixed provider host permissions are exactly:

| Host | Use |
| --- | --- |
| `https://dict.youdao.com/*` | Requested public Collins bilingual entries, including bounded source-confirmed word-form or phrase expansion. Sentence context is not sent to Youdao. |
| `https://lextide-context.aa1986884.workers.dev/*` | `/meaning` receives the word, current sentence, occurrence and candidates; `/translate` receives requested prose chunks after translation is enabled. Both use Cloudflare Workers AI. |

MyMemory and Collins official-origin fetch access are not requested. No user API key or cookies are included in provider requests. The former official-session option is removed; legacy stored values cannot enable cookie use on Youdao.

Optional HTTP/HTTPS patterns permit remembering a selected website. The internal policy additionally checks exact origin and activation. Browser match patterns may cover multiple ports; internal grants remain origin-specific. Popup controls website activation, revoke, exclude and global pause; page settings cannot grant website access. Revocation preserves vocabulary. Forgetting a remembered site keeps the currently authorized tab temporary.

No `cookies`, `history`, `tabs`, `webRequest` or `downloads` permission is requested. Calling a permitted tabs method does not imply a broad tabs permission.

The website preview uses a separate same-origin dictionary relay; the extension queries Youdao directly. Chromium parser bundles contain no third-party HTML parser. Safari candidates remove offscreen permission/files and explicitly use linkedom; Safari permission behavior still needs native testing.

## 可选用户 API（0.7.85）

现有 optional_host_permissions 继续由用户按主机授权；不新增常驻全站权限。受信的扩展“翻译引擎”设置页会为用户保存的服务请求对应 scheme/host/*，浏览器按主机而非单一端口授权。本机模型允许明确填写的 loopback HTTP；远程服务必须 HTTPS。后台每次使用用户 API 前检查权限，重定向禁用，密钥不进入 URL。正文与选文各有配置/缓存标识，未选择的服务不会作为静默回退接收文本。
