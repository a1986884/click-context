# V0.2 review notes

Based on GitHub main `18ee778c93436c6573a1ffdd63f41622cac15854`. This branch is not merged into main.

## Architecture and behavior

- Existing `src/core.js`, article/glossary data, extension entry points and build pipeline are reused.
- `src/reader.js`: shared settings, independent mode/lookup preferences, dictionary context and vocabulary UI. Default effective mode is original; lookup is enabled immediately. The bubble pauses/resumes the last selected mode; long press is still 550ms. Pausing translation does not turn off the independent word switch.
- `src/translation.js`: observes paragraphs near the viewport, one translation in flight per reader, 1.2s minimum start gap, one automatic retry for transient failures only, per-paragraph retry, AbortController and stale-result isolation. Original DOM nodes are retained. Translation-only mode hides plain originals with a reveal button; linked/media/formula paragraphs remain visible to preserve interaction.
- `src/storage.js`: one schema, seven-day/150-entry/versioned translation cache and lemma-deduplicated vocabulary. Extension storage is owned by the background worker using `chrome.storage.local`; Demo uses origin-local storage. Demo V0.1 word strings are migrated without inventing historic dates/context. Demo and extension data do not sync with each other.
- `src/morphology.js`: explicit reviewed mappings (including studying/researchers/went), no suffix guessing. This is deliberately a small lexicon, not a complete morphological analyzer.
- `src/reader-style.js`: shared touch-sized controls, wrapping, safe areas and scrollable panels.
- Background worker verifies sender and message type, enforces translation consent, shares in-flight provider requests and aborts unused requests. Only the `storage` permission was added; host permissions are unchanged.

## Sources and limits

- `src/data.js` sample articles, Chinese demo glossary and `src/morphology.js` demonstration definitions are original demonstration data, released as CC0-1.0 data. This is not a professional English-Chinese dictionary and this declaration does not license the rest of the repository. Local entries without English definitions/phonetics clearly say data is unavailable.
- Online English entries use Free Dictionary API (`https://dictionaryapi.dev/`); returned license names and source links are displayed. No license for upstream dictionary data is inferred from the API software license. English definitions are not saved to the vocabulary/cache. If a response omits its license, the card says so.
- Chinese online text and full paragraphs use MyMemory (`https://mymemory.translated.net/doc/spec.php`, `https://mymemory.translated.net/doc/usagelimits.php`), explicitly marked as machine translation. The docs were inaccessible from the research tool (HTTP 403); no precise daily quota or availability is promised. Conservative serial pacing, bounded chunks, timeout, quota errors and caching are used instead of parallel bursts.
- AI context explanation and paid services are not connected. No API keys or account system are introduced.

## Verification

- All pre-existing regression scenarios are retained. Assertions that formerly required lookup to stop with translation were updated to the explicitly requested V0.2 independent-switch behavior; canonical-word and attribution assertions reflect the richer data model. Async setup is explicitly awaited.
- Node tests cover all example tokens; three modes and node identity; links/images; independent lookup; preference persistence; morphology; save/deduplicate/delete; cache hit/expiry/clear; transient/permanent error handling; viewport priority; exclusions; stale async results; long press; HTML injection.
- `demo/fixtures/{article,list,rich}.html` are real browser-test fixtures using the shared reader, not external-site compatibility evidence. `demo/mobile-qa.html` embeds 375px and 320px browser viewports and is not an entity-device test.
- Real Cloudflare preview and Actions outcomes are reported in the PR/final delivery after execution. No entity iPhone, Safari extension, Firefox package, or installed Chromium extension is claimed tested.
- The QA-only `/mobile-reader` copy uses a restrictive resource CSP in a meta element and is embeddable for viewport testing. The production index keeps its HTTP `frame-ancestors 'none'` protection. The QA copy has no new permissions or server-side account session.
- Cloud browser verified original-mode `studying → study`, context, saving/deleting, all three modes, English reveal, preference reload, semantic article/list/rich fixtures and a real MyMemory sentence translation. Free Dictionary API did not return usable English data for the live `laboratory` query; that outcome is explicitly shown, not represented as a successful dictionary response.

## Remaining scope

- Initial standard semantic paragraphs are supported. Dynamic SPA content inserted after mode activation needs mode restart; cross-origin frames, PDFs, canvas text, closed Shadow DOM, arbitrary div-only layouts and English words split across separate inline elements are not guaranteed. No claim of universal website support.
- Cache is local and unencrypted; clear it in settings. No cross-device sync. Original V0.1 per-site extension favorites cannot be centrally enumerated or migrated without revisiting each site.
- Touch safe-area/keyboard/scroll behavior still needs real iPhone Safari validation. Browser fixtures cannot replace that.
- Provider quality, licensing completeness, daily quota and regional availability remain external dependencies. Production release needs a provider policy, broader licensed lexical data, installed extension QA and a separate Firefox/Safari packaging pass.
