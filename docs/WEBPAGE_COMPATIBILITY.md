# Current webpage compatibility

The current reader uses visible main/article regions with a visible-page fallback. Hidden ancestors, inactive SPA articles and closed disclosures are excluded; responsive resize and article-scope changes reconcile old/new translations. Paragraph and sentence layout retain source nodes, links and table structure. Sentence splitting tracks generated text fragments: canonical Text-node updates/removal and detached cached paragraphs are reconciled, while host edits to generated fragments are preserved. These DOM heuristics are not a universal framework compatibility guarantee. Body translation uses Cloudflare Workers AI; MyMemory is a historical provider only.

Current repeatable checks and their limits are in [TESTING.md](TESTING.md); per-generation findings are in [ITERATIONS.md](ITERATIONS.md). Public-page DOM tests use clearly reported synthetic translations unless a separate live API check is explicitly enabled. They do not install the extension or validate Safari.

## Historical compatibility observations

The record below describes the earlier implementation and provider at the time; it does not describe current networking.

# Real webpage reading — 0.6.7

The reader now extracts ordered runs of original text nodes separated by block
boundaries. This includes nested lists, direct prose around child blocks, line
breaks, table cells, definition lists and CSS block spans. Body-wide activation
prefers main/article regions, with a generic fallback for older pages. It is a
bounded heuristic, not a universal site classifier or a database of site rules.

Hidden DOM/CSS/ARIA text, closed disclosure bodies, editable controls, forms, code,
translate=no/notranslate and extension-owned nodes are omitted. Paragraphs are
translated near the viewport, one request at a time with provider pacing. A
150 ms mutation debounce scans changed prose regions, not the whole page after
every injected translation. Text replacement/removal aborts that paragraph's work;
a late answer cannot reinsert stale translation or populate its cache.

The engine leaves source text nodes, links, images and event listeners intact.
Translations in list items, table cells and flex/grid items stay inside the source
item. The reading source near the viewport center is anchored when earlier translations grow, avoiding loss of the current paragraph. Other complete paragraphs get adjacent translations; mixed text runs get
inline wrappers at their own boundary. Rich/mixed paragraphs retain original
English in translated mode so interactive content is still usable. Stop removes
owned wrappers and restores original hidden flags. Returned provider text is
rendered as text, never executed or assigned to innerHTML.

The existing MyMemory translation service remains in use; this update does not
change the separate Cloudflare AI + Collins word-meaning path. The new
`/webpage.html` preview uses real translation requests with no preset Chinese.
The regular home-page examples still have their own bundled demonstration texts.

Validation:
- `npm test`: 143 unit/contract tests, including seven new structural/lifecycle tests.
- `npm run test:real-page-layout`: real Chromium DOM fixture with explicit synthetic
  translation responses; nested content, native links/events, grid/table layout,
  hidden text, disclosure, dynamic replacement/removal, viewport queue, narrow
  viewport and restoration.
- `LIVE_TRANSLATION=1 NODE_USE_ENV_PROXY=1 node tests/live/webpage-compatibility.mjs`:
  Paul Graham blog, MDN Introduction and Wikipedia Ocean loaded as real public
  documents. DOM layout uses synthetic test responses; one bounded paragraph per
  site actually translated through MyMemory (all three returned Chinese).
- `node tests/browser/webpage-preview.mjs`: shared preview UI with synthetic
  provider responses, activation, dynamic loading and mobile layout.

This is ordinary-browser evidence. The matching native Chrome extension package
and private Colab test source are updated separately; installed-extension
acceptance is still pending. Shadow roots, iframe/PDF content, canvas text, complex
virtualized editors and arbitrary framework layout rules are outside these
checks. Extraction is bounded to 400 units / 10,000 visited nodes per scan.
