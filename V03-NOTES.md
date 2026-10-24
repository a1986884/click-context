# V0.3 engineering and validation

> Historical recovery-baseline notes. Final GitHub V0.3 was not recovered.
> Current results: docs/TESTING.md. Current Safari web packaging path: docs/SAFARI.md.
> The historical Xcode-only guidance below is superseded by Apple's web packager.

Baseline: V0.2 PR #1 is open/unmerged, head `70e3f534098ccb62f47f3c2bff5911aad78676d6`. V0.3 targets `feat/v0.2-reader-experience`, not main. WordTap is untouched.

## Architecture and privacy

- `src/protocol.js`: JSDoc message contracts, bounded requests, preference whitelisting, supported URL/sensitive-path classification.
- `src/extension-state.js`: serialized policy updates; persistent exact-origin permission and preference records; separate session tab grants and overrides. `v2:words`/cache remain intact. Previous reading mode/word/side defaults are reused; online permission is reset for V0.3 until explicitly allowed per site.
- `extension/background.js`: authoritative policy checks on every content storage/query message; verifies extension sender, frame 0 and trusted extension UI URL. Active-tab injection, persistent optional origin registration, request quotas (three in flight/tab, twelve total, ninety requests/tab/minute), cancellation, restart-safe config, navigation and removal cleanup.
- `extension/content.js`: isolated-world singleton, authorized bootstrap, bounded URL checks for SPA navigation, serialized reader synchronization. Revocation destroys the reader and restores original nodes. Stale network results remain isolated by the shared reader's abort/version mechanism.
- Popup uses actual `tabs`/`scripting`/runtime APIs, not fake controls. It shows acknowledged content state and failures. The global vocabulary page works on unsupported pages too. Message storage writes are owned by the background.
- Required permissions: storage, activeTab, scripting. No tabs/history/cookies/webRequest permission or all-sites static injection. Two provider hosts are declared for background cross-origin fetch; website access remains optional. Only the browser-owned Popup can increase online consent; content settings cannot grant it.
- Optional HTTP/HTTPS origins are requested only for a user-selected site. Chrome match patterns do not restrict ports, whereas internal policy uses exact URL origins. Revocation removes the origin permission and associated registration. Host permissions alone never authorize queries: internal policy also must allow the site/tab and network access.
- Page text, translation cache and vocabulary are local and unencrypted. Background fetch omits credentials/referrer. Source origin, not full URL/query, is saved to new vocabulary entries. Cache keys contain paragraph text; clear via reading settings. No analytics, cloud sync, account or API key.

## Compatibility and performance

- Semantic headings/paragraphs/list/quotes and leaf prose divs under article/main (or prose-like class names); no rewriting original text nodes. Inline code/links/math originals remain intact, and translated mode retains rich originals.
- Debounced MutationObserver (150ms), viewport IntersectionObserver; at most first 5,000 candidate elements scanned and 400 active paragraphs. One request at a time per reader, provider-wide 1.2s MyMemory start spacing, timeout, one transient retry, seven-day/150-entry cache. These are bounds, not a universal readability algorithm.
- Native caret text-node lookup, including words split across inline nodes; punctuation/contractions supported. Dotted abbreviations are identified as one unit and explicitly report unsupported reliable entries. No suffix guessing. Link/button/form/selection interactions are left to the host site.
- Shadow DOM controls isolate UI CSS; translated siblings use reset styles. Aggressive site CSS/scripts can still interfere with siblings; no claim of universal compatibility.
- PDF, canvas, cross-origin frames, closed shadow roots and browser/store pages unsupported. Sensitive-page detection is heuristic, not classification of all private content. A user can explicitly enable and allow networking on sensitive pages.

## Validation evidence

- Node/linkedom tests cover previous V0.2 cases plus policy isolation, worker/browser session lifecycle, exclusions/revocation/pause, migration safety, div/rich prose, mutation handling, nested native text lookup, selection/links/forms, abbreviations and external reconfiguration.
- Work cloud Chromium download attempt failed: CDN returned a 195-byte HTML response instead of a ZIP. `npm run test:extension` correctly failed for missing executable. This is NOT an extension installation pass.
- CI installs bundled Playwright Chromium, loads the actual extension and triggers real action Popup via experimental CDP Extensions.triggerAction. It does not substitute a normal web page for extension installation. Failure reports are uploaded even when checks fail. Seeded translation cache is labeled cached integration data, not live provider success.
- Release ZIP contains only production extension/resources; release.json records version, Git commit, browser and installed-test outcome. ZIP is an unpacked developer-test distribution, not a signed store package.
- Actual CI outcomes, public website results and artifact URLs will be recorded after execution. No entity iPhone/Edge/Safari/Firefox installation result is claimed.

## Safari minimum path

Desktop Chrome/Edge ZIP cannot run in iPhone Chrome or Safari. Keep shared reader/storage data models, add an API compatibility adapter for Safari differences, then package a Safari Web Extension inside an iOS app with Apple's Xcode web-extension packaging tool. Use a future cloud macOS/Xcode runner for build and simulator checks; signing/TestFlight/App Store distribution needs a separate authorized Apple workflow. No Mac purchase, paid enrollment or store submission is performed here. An actual iPhone must verify permission prompts, touch selection, long press, viewport/toolbar/safe-area, TTS and export before claiming iOS support.

Primary references checked: Chrome activeTab, scripting and storage docs; Playwright Chrome extensions docs; Chrome DevTools Protocol Extensions domain; Apple Safari Web Extensions and packaging docs.
