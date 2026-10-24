# Privacy policy draft — current plugin candidate

Lextide code has no user account, analytics instrumentation, cloud vocabulary sync or server-side vocabulary database. Settings, saved vocabulary and translation cache remain in the browser profile. They are plaintext local data; export vocabulary before uninstalling or replacing a profile. This draft describes current code and does not replace Cloudflare or dictionary-provider terms.

## Activation and requests

Website execution defaults off. Users activate a tab or remember a specific website. An enabled site's clicked dictionary queries use the network automatically; there is no separate networking switch. Body translation starts only when enabled in reading settings. Matching caches and built-in demonstration translations can avoid a corresponding provider request.

| Action | Destination and content |
| --- | --- |
| Click a word or confirm the selection action | Youdao's public Collins section receives the requested expression and, where needed, bounded word-form/phrase entry queries. It does not receive the sentence or whole page. |
| Interpret the clicked occurrence | The owned Cloudflare `/meaning` endpoint receives the word, sentence, exact occurrence index and bounded Collins candidate excerpts. The API accepts sentences up to 2,000 characters; the reader normally extracts a smaller local sentence window. |
| Enable body translation | The selected translation configuration receives requested visible prose chunks. Default: owned Cloudflare `/translate` / Workers AI. Optional user API: the configured Google/Microsoft/DeepL or AI endpoint receives text and its own authentication header. Paragraph/sentence layout does not imply local machine translation. |
| Explicitly translate selected text | A separate selected-text engine receives the validated selection (up to 2,000 characters). Selecting alone sends nothing; the user must activate the translation action. This is independent of Collins lookup and the word-card AI interpretation. |
| Use pronunciation | The browser/system speechSynthesis implementation provides the voice. Its behavior and voice service are controlled by the browser/system. |

Requests omit cookies and referrer and do not intentionally send the page URL, form values or full article HTML. Selection alone only shows an action and sends no dictionary request. Providers can process request text and connection metadata. The preview dictionary relay means Cloudflare also receives the requested expression; the extension does not use that relay.

Hidden regions, form fields, editors, navigation, code and notranslate regions are excluded through DOM/CSS heuristics. These rules cannot identify every sensitive page. The entire article is not submitted in one request, but continued bilingual reading can send many visible sentences or paragraphs over time.

Word-card AI context analysis uses Cloudflare Workers AI gpt-oss-120b. Selecting another body or selected-text engine does not change this dictionary-context service. Generated glosses are labeled as AI interpretation and may select a supplied Collins sense or explicitly report no matching sense. They are not presented as Collins original text. Original senses remain accessible. An API failure is shown with dictionary originals and retry, without claiming contextual interpretation succeeded. With no sentence, the reader shows dictionary senses without requesting AI context analysis.

The owned context/translation Worker code does not persist article text or model responses and does not log request bodies. Cloudflare's platform processing is subject to its own terms; rate limits use connection address. Context inference shares a 16-second server waiting deadline across attempts and passes cancellation to the AI binding. Client cancellation cannot recall data already sent or guarantee a model invocation stops after acceptance. Current code does not call MyMemory.

## Local data and caches

- Favorites contain the original expression, lemma, Chinese meaning, original sentence, source and date. Distinct uses can remain separate. New extension saves reduce the webpage source to its origin; preview saves and imported records may retain fuller source strings. Exports include all stored context/source fields. Import merges valid records without overwriting existing uses; search is local. The limit is 5,000 favorites.
- Dictionary candidates contain no sentence or selected AI sense. The extension uses `chrome.storage.session`, with ten-minute TTL and a shared 32-entry limit, surviving service-worker collection within the browser session. Partial results are not cached. Preview candidates use an in-memory tab cache; the preview relay does not maintain a dictionary database or store full source pages.
- AI context results use a separate memory-only cache, at most 64 entries per reader/worker lifetime, keyed by sentence, occurrence and candidate text. They are not persisted as shared word-only results.
- Translation cache is profile-local (preview: localStorage), namespaced by selected API configuration and model revision, with seven-day TTL. It uses 16 buckets, each capped at 256 entries and a 128 KiB budget; older entries may be evicted. Keys and values contain plaintext source text and Chinese translations. Reading settings clear the translation cache; this does not delete favorites.

Disabling lookup stops its waiting work. The master button stops lookup and body translation, removes translations/cards and restores links. Reopening only enables lookup. Revoke/exclude/global pause stop further authorized work and remove the reader; saved vocabulary remains. Already transmitted data cannot be recalled. Demo storage is separate from extension storage.

## Preview and distribution

The website previews the shared reader. Built-in sample paragraphs may carry original example translations; the webpage example and pasted custom text need cache or real Cloudflare translation. User API settings are extension-only; a website preview is not a user-key vault. The default deployed Worker uses the publisher's Cloudflare AI binding and quotas. Optional user API keys and API profiles are stored in extension-origin IndexedDB, not chrome.storage, sync, webpage localStorage, vocabulary backups or translation cache keys. This is plaintext profile-local storage, not a hardware-backed vault. Existing keys are never returned to injected webpage UI or echoed into the settings form; only the trusted extension settings page can manage profiles through the background. Changing the endpoint origin requires an explicitly supplied new key. Host permissions are requested from that page; browser host grants include ports. No membership cookies or provider-account login sessions are reused. API responses/errors do not return raw vendor errors or saved keys to the webpage. Request redirects are disabled. The page can observe injected translations; Shadow DOM is not a confidentiality boundary. Background vocabulary APIs validate extension sender and activation.

Before a public store release, the owner must supply operational contact/publisher details and review service terms. This remains a draft, not a published legal policy. Source-code MIT licensing does not license Collins content or external services.

The default body/selected-text v4 translation route uses GLM-4.7-Flash with thinking explicitly disabled on the same Cloudflare service. Old v2/v3 clients retain gpt-oss-120b. This model change does not change the receiving service, consent boundary, user API settings, or the independent word-card context model.


## Userscript 0.7.124 local trial: independently selected context AI

This section describes the local userscript, not a new native extension release or the public 0.7.110 installer. It adds an explicit clicked-word context selector; the native baseline described above still uses its built-in context route. Selecting body or selected-text translation alone does not change the context destination.

By default, context uses the existing owned `/userscript/meaning` service. If the user explicitly selects a saved LLM profile, only its approved API Origin receives the clicked expression, bounded current sentence (up to 2,000 characters), occurrence offset and bounded dictionary candidates (up to 64). That API receives its own authentication header; the request is not relayed through the owned AI service. Native Google/Microsoft/DeepL translation profiles cannot be selected for structured word-context analysis. There is no fallback to another API or to the built-in service.

Userscript profiles/keys are stored in the script manager's GM storage, separately from native extension IndexedDB. Manager synchronization depends on its settings. Keys stay out of the page forms, vocabulary exports, diagnostics and cache identifiers. The public configuration label is used for AI attribution; it can appear with a saved meaning's source. Structured model output is checked before and after JSON decoding for direct key echoes; raw provider errors are not shown. This does not make script-manager storage a hardware vault or verify every manager implementation.

The active own-API context cache has at most 64 in-memory entries, keyed by sentence, occurrence and candidates; selecting another configuration/model/key revision discards it and cancels old work. The built-in cache is separate. Context results are never persisted as a word-only dictionary cache. Unreadable engine settings block unknown text/context routing while dictionary lookup remains available. Saving/opening settings does not send reading text. Explicit context tests use a fixed public sentence; connection diagnostics remain connectivity-only and do not test the user's API. Vendor account and iPhone/script-manager acceptance remain unverified.


In the 0.7.126 local userscript trial, a manager without confirmed safe user-API transport may save an explicit all-built-in choice while retaining its unchanged saved profiles. This permits local recovery, not external API access: creating/editing profiles, keeping a user API active, and calling its translation/context tests remain blocked. A fresh pre-write record check rejects detected intervening configuration changes. GM storage still does not provide cross-tab transactional guarantees.

## Userscript 0.7.128 local trial: cross-instance settings events

On managers supporting GM value-change listeners, the script subscribes only to `click-context:v1:engines` and handles changes reported as remote. It ignores the old/new callback payloads, which may contain private keys, and rereads through the existing validating repository. This performs local storage reads only, not API tests or text submission. Unrelated cache/vocabulary writes and local save notifications do not cause reads. Burst events coalesce without polling.

New requests and completed responses wait for an ongoing settings refresh; cancellation releases that action independently. Changed routes cancel their affected requests; unreadable settings block future routing without guessing a provider. Changing the body service pauses translation and restores the source. Recovery updates the selection without automatically sending text. pagehide removes listeners, including late modern registration; BFCache restoration registers again and reads once. Managers without these APIs retain explicit settings reads. Delivered events cannot recall already transmitted data, and GM storage provides no cross-instance transaction. These are local candidate behaviors verified with simulated APIs, not native Tampermonkey/iPhone acceptance.
