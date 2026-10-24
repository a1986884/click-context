# Dictionary DOM parsing: Chromium, preview and Safari

Version 0.7.9 separates three layers:

1. `src/dictionary-fetch.js`: existing bounded, cancellable HTML request; no DOM
   library. The public `src/collins.js` continues re-exporting `readPage`.
2. DOM implementations: `src/dom-parser-linkedom.js` for Node/Cloudflare and
   `extension/offscreen.js` for Chromium's native `DOMParser`.
3. `src/dictionary-extract.js`: shared dictionary field extraction/validation,
   no network or parser imports. The lookup orchestrators in
   `collins-lookup.js`/`collins-bilingual-lookup.js` share the same existing
   source-headword, inflection and phrase confirmation rules on both targets.

The public `collins.js` and `collins-bilingual.js` keep their existing Node/
preview parse exports and result shapes. They inject the linkedom adapter;
Chromium imports the parser-independent lookup core instead.

Both DOM implementations pass a read-only `dictionaryDocumentView` to extraction.
Its only members are `querySelector`, `querySelectorAll`, `textContent`, and
`getAttribute`. Parser-side projection handles standard DOM cloning/removal;
extraction cannot access those operations. Paragraph text omits the same POS/
order labels that the old parser removed from clones, while those labels remain
queryable separately. No split/search heuristic removes repeated label words.

The common inert-node selector excludes `script,style,iframe,noscript,template`
from queries and text. This resolves the template-content difference between
native DOMParser and linkedom; a hidden template cannot substitute a headword.
The browser parity fixtures retain strict deep equality, including whitespace,
entities, uppercase tags, inflection references, examples and multiple POS.

## Chromium lifecycle and permissions

`extension/dictionary-lookup.js` is a real ESM module used by the background.
Its injected parser is `createOffscreenParser`:

- No document is created until the first HTML parse.
- `runtime.getContexts` filters both `OFFSCREEN_DOCUMENT` and the exact
  `offscreen.html` URL; a singleton Promise serializes concurrent creation.
- `offscreen.createDocument` uses reason `DOM_PARSER`.
- A new worker/parser instance discovers an existing document. It is retained
  for subsequent queries, rather than recreated for each word.
- Creation failure yields `OFFSCREEN_CREATE_FAILED`, with the cause in the
  message. There is no Chromium parser fallback. Cancellation cannot cancel
  another caller's shared document creation; abandoned results are ignored.
- HTML is limited to 1 MiB. Messages use `lextide:parse-html` and a fixed kind
  allowlist. Only the same extension's `sender.id` is accepted.
- The offscreen page has no networking code. CSP denies connections, images,
  frames and other remote resources. The parsed document stays detached; it is
  never adopted into the offscreen page. All provider fetching remains in the
  authorized background. See `PERMISSIONS.md` for the added permission.

The build asserts no `node_modules` input in any Chromium parser/worker bundle.
Package validation rejects linkedom and its parser dependencies in Chromium.

## Safari strategy is different and explicit

Safari has no Chromium offscreen API. Its separate candidate build aliases
`offscreen-client.js` to `safari-parser.js`, injecting linkedom into the same
lookup core and read-only extraction layer. It removes the `offscreen`
permission and offscreen documents, and keeps the dependency licenses and an
explicit Safari notice. Validation permits the library only via
`allowLinkedom:true` for this target. Safari installation/signing are unverified.

## Verification and measurements

- 202 Node/unit/contract checks passed, including lazy/singleton creation,
  existing-context reuse, creation failure without fallback, and cancellation.
- Nine HTML fixture cases covering six distinct entries passed strict deep
  equality between linkedom and native DOMParser in Playwright. The actual
  offscreen HTML/module/message handler ran in an ordinary browser with a
  test runtime-message shim. No unexpected network request or script execution
  occurred. This is not an installed extension test.
- Desktop 1280 and mobile 390 preview checks, context-ranking browser checks,
  preview build and both target package validations passed.
- `test:offscreen-extension` is a separate native acceptance test. In an
  unrestricted test browser it installs the actual extension, imports the same
  production lookup module used by the background, performs a real Youdao
  `ocean` lookup, checks the offscreen context and measures native creation.
  It does not substitute source HTML for that live lookup. The following warm
  parser check is explicitly synthetic.
- Here `/etc/chromium/policies/managed/extensions.json` sets
  `ExtensionInstallBlocklist=["*"]`. Native acceptance reports
  `blocked-by-policy` with exit code 2; no installation/policy bypass was
  attempted. Therefore the real offscreen lookup and cold-creation overhead
  remain unverified here. `offscreenCreateMs` is null. No lookup speed gain is
  claimed.

Uncompressed bytes, same esbuild 0.25.12 / Chrome 130 target:

| Resource | Before (ab9e4af) | After |
| --- | ---: | ---: |
| background.js | 419,353 | 49,580 |
| dictionary-lookup.js (new runtime module) | — | 20,403 |
| offscreen.js (new page bundle) | — | 14,563 |
| offscreen-client.js (standalone module) | — | 1,854 |
| offscreen.html | — | 422 |

The three bundles sum to 84,546 bytes; including the standalone client and HTML,
these resources sum to 86,822 bytes. This is not the total extension size and
not a timing benchmark. Safari intentionally retains its parser dependencies.

Reproduce after `npm ci`:

```
npm run check
npm test
npm run build:preview
npm run test:parser-parity
npm run package
# On an unrestricted Chromium test host with a virtual display:
HEADED=1 xvfb-run -a npm run test:offscreen-extension
```

Evidence: `test-results/parser-parity.json`, `offscreen-build-size.json`, and
`offscreen-extension.json`. The interactive cloud QA runner includes parity
and native offscreen checks; it cannot mark a blocked installation as passed.


## Live provider parity (0.7.15)

After building, run `npm run test:parser-parity-live`. This makes on-demand
requests to Youdao through the test-only proxy transport, then reuses exactly
the same HTML bytes for both parser paths. The full provider result, including
headword validation, morphology and phrases, must be deeply equal. Network or
missing-source errors fail the test; synthetic HTML is never substituted.

Five live queries passed on 2026-10-21: bank (12 senses, noun/intransitive/
transitive verb), available (2), listed → list (7), hugging → hug (4), and
carry out (1 phrasal-verb sense). Counts reflect these responses only. Report:
`test-results/live-parser-parity.json`; no source HTML or full definitions are
written to disk. The browser runs the production offscreen page handler with
a runtime-message shim. It does not install an extension or exercise the
native offscreen API, and does not measure creation overhead or lookup speed.
