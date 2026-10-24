# Translation failure diagnostics (0.7.73)

`/translate` retains its existing HTTP503, `code: TRANSLATION_UNAVAILABLE`,
`retryable: false` and public message. It additionally returns `failureReason`
from this fixed list: `cancelled`, `timeout`, `inference`, `invalid-result`.
Cancellation takes precedence over deadline, and output validation is only
classified after a completed inference. Raw provider errors, model output and
reasoning are never returned. Existing clients continue to pause on the same
code; no new automatic retry, model, prompt, input/output validation, quota,
CORS or logging behavior is introduced. Existing 16-second deadline and at most
two server attempts remain. `/health.translation` advertises the deadline and
fixed list. These diagnostics describe new responses only; historical uncategorized
503s remain unknown.

For `failureReason: invalid-result`, the response also contains a bounded
`validationReason`: `incomplete`, `invalid-text`, `number-mismatch` or `unknown`.
The parser's existing completeness, text and numeric guards are unchanged;
only tagged, whitelisted categories are returned. Inference exceptions cannot
supply validation details. Raw output/internal messages are not returned.
`/health.translation.validationReasons` advertises this additive capability.
These fields diagnose new responses and do not retroactively categorize old
`invalid-result` failures or imply that provider quality has been fixed.

`npm run build:context-worker` emits `build/context-worker/worker.mjs` and a
public metadata manifest with actual package version, Git commit/dirty state,
SHA256 and the existing nonsecret AI/rate-limit bindings. It reads no credential
files and performs no deployment. Publication requires a clean identified commit
and comparison with the current remote code/settings. Retain the previous module
and settings before upload. Local unit tests and bundle checks are separate
from deployment/health and fresh provider acceptance. The 0.7.70 versioned
handoff records which steps actually ran.

---

# Context meanings — current service

Clicking a word first obtains genuine Collins bilingual candidates from Youdao,
then sends the clicked occurrence and current sentence to the owned
`https://lextide-context.aa1986884.workers.dev/meaning` endpoint. Both preview and
extension use that endpoint. The background enforces the active site/lookup gate.
There is no embedded provider key or need for a user API key. Cloudflare's AI
binding runs `@cf/openai/gpt-oss-120b` with bounded low-effort reasoning. The exact clicked occurrence is marked in the sentence. The model establishes lemma/part of speech before matching a supplied sense. Candidate IDs, lemma and part-of-speech consistency are validated; a mismatch becomes explicitly AI-only.

The main Chinese gloss is labeled AI analysis. Its selected dictionary ID must
be in the supplied Collins candidates; null explicitly means no corresponding
Collins sense. The card retains original English definitions and original Chinese
meaning in details. Manual selection shows original Collins text. A service error
shows dictionary originals with an explicit failure status and a retry button.
Model results remain fallible; this is not a promise of perfect interpretation.

The 0.7.94 prompt additionally constrains a single modifier to its own meaning,
without including an unmarked head noun, and discourages invented subtypes or
encyclopedic additions. Neutral prompt examples are separate from the live test
cases. This does not add a semantic proof or a hardcoded word-to-gloss table.
The model, low reasoning effort, 900-token output cap, request/response schema,
candidate checks and bounded retries remain the same. Translation prompts and
their revision negotiation are unchanged. Context caches are memory-only; reload
an existing reader after an update to discard earlier contextual results.

From 0.7.95, an existing `CONTEXT_INVALID_RESULT` HTTP503 response also includes
`validationReason`: `incomplete`, `invalid-json`, `invalid-shape`, `unknown-sense`,
`invalid-text` or `unknown`. Other failure codes and successful responses do not
gain this field. The last failed attempt supplies the reason; cancellation and
inference failure keep their existing categories. No raw model text, reasoning
or exception message is exposed. `/health.contextValidationReasons` advertises
the list. Older clients ignore the addition; new clients normalize missing or
unrecognized reasons to `unknown`. These diagnostics classify new failures only;
the 0.7.94 chicken failure remains unclassified beyond its original error code.

The Worker caps actual request bytes (65,000), sentence length (2,000), candidates
(64), candidate definition lengths and generated output. It validates JSON and IDs,
uses data-only instructions, never executes returned HTML, and rejects unsupported
browser origins. Network-address rate limit: 60/minute; overall endpoint limit:
500/minute per Cloudflare location (approximate binding limits, not a global daily
spend cap). Model invocation quotas/billing follow the existing Cloudflare plan.
No persistent sentence cache or request-body logging. Client response deadline:
18 seconds. The server shares one 16-second inference-wait deadline across both
attempts, combines it with request cancellation and passes the signal to the AI
binding. An already cancelled request does not invoke the model; cancellation or
timeout prevents retries and safely consumes late binding failures. This bounds
application waiting, not total network latency or a guarantee that accepted model
compute stops. Cancellation prevents stale UI updates; accepted inference may finish.

Per-reader memory-only cache keys include complete sentence, occurrence index and
candidate text. Dictionary cache contains candidates only. At most three on-demand dictionary page requests per lookup (exact word plus two bounded hypotheses), with source confirmation required before merging. Pure morphology references are expanded and are not displayed as definitions. Empty candidate sets can yield explicitly AI-only contextual explanations. A transient inference error receives at most one retry. No full-page scan,
background prefetch or model download. Paragraph translation remains independent.

Deployable source/config: `workers/context/`. The account connector deployed AI,
PER_IP and TOTAL bindings without extracting account credentials. The optional
Cloudflare observability setting is disabled to avoid collecting request traces.

Validation: `npm test`; browser context/card fixtures; explicit live run
`NODE_USE_ENV_PROXY=1 node tests/live/context-api.mjs` (uses network/inference).
The live run samples bank, light, plant, available and charge in two contrasting
sentences each. 2026-10-20: all ten senses matched; API latency 272–594 ms,
excluding initial dictionary lookup. This small sample is not a general accuracy
benchmark. Native installed-extension verification remains pending the authorized
interactive notebook; website/shared-component evidence is kept distinct.


0.7.0 regression: thirteen live source+AI cases cover stopping/saw/leaves in contrasting contexts, independent building vs constructing, bought/taken references, happier, using, and an unknown project name. All passed in the final run; API times were about 1.0–4.4 seconds excluding dictionary collection. The source currently omits a usable build entry: the constructing example correctly uses AI-only provenance. This small sample does not establish general accuracy. Native installed-extension testing remains pending.

Regression note: “Tickets are available online” does not imply payment; “可获得” is accepted along with “可购买/领取”. The financial/free distinction must not be imposed by a brittle keyword test. People being available must still mean “有空”, not item availability.

When a regular spelling hypothesis is source-confirmed, another unused hypothesis is cancelled rather than delaying the result. Explicit ambiguous source references (such as leaf/leave) still retain both. Cancellation of an unused candidate does not mark a successful lookup as incomplete.

Client failures distinguish rate limits, response timeout, network failure,
service rejection/unavailability and invalid results. The card labels any
fallback as dictionary originals and retains manual retry. A failed context is
not cached; retry may reuse already cached dictionary candidates. Cancellation
remains separate and does not start automatic client retries. Live diagnostics
use original public-safe sample sentences and store HTTP outcomes/card state;
they are explicit test artifacts, not production request logging.

The service returns fixed failure codes for RATE_LIMITED, CONTEXT_TIMEOUT,
CONTEXT_CANCELLED, CONTEXT_INVALID_RESULT and CONTEXT_UNAVAILABLE. Health exposes
contextFailureCodes=true. Clients accept only known service classifications;
raw binding errors and model outputs are never returned in failure bodies.
Explicit incomplete/length-limited model output is rejected before JSON use,
even if a partial payload happens to contain syntactically valid JSON.
The existing bounded retry policy and success response structure remain unchanged.


## Previous v3 translation output headroom (0.7.97)

A fresh 0.7.95 default-translation sample failed with `incompleteReason:
max-output-tokens` and `outputTokenLimit: 1000`. For explicit v3
requests, the minimum output allowance is now 1600 rather than 1000; the
existing length-based allowance and 2600 ceiling remain. Unversioned/explicit
v2 clients retain their previous prompt bytes and allowance. This is output
headroom for the same reasoning model, not a target translation length.
Instructions, low effort, model, numeric/condition/completeness guards, cache
revision and success shape are unchanged. Failed/incomplete output is still
rejected and never returned or cached. The shared 16-second deadline, at most
two attempts and five-second retry-start cutoff remain; neither attempt keeps
increasing its budget. Maximum short-request allowance increases, so real
success, latency and quota effects require fresh versioned evidence. This
change does not itself establish that the 0.7.95 failure is fixed. Word-context
requests remain capped at 900 and are not changed by this adjustment.


## Current v4 default translation model (0.7.98)

New clients explicitly request `cloudflare-ai:en-zh:v4`, using
`@cf/zai-org/glm-4.7-flash` with system/user messages,
`temperature: 0` and bounded `max_tokens` (same 1600 minimum, length-based
allowance and 2600 ceiling). It explicitly sets `chat_template_kwargs.enable_thinking: false`, as documented
by the model schema. v4 has a separate
cache namespace: old-model cache entries cannot masquerade as new-model output.
The generic balanced translation instructions and existing numeric/conditional
checks remain. A `length`/`content_filter` finish marker or numeric completion
usage at the configured ceiling is rejected even if the response text looks
complete; no partial text is returned or cached.

Explicit v3 and unversioned/explicit v2 requests continue to use gpt-oss-120b
with their previous prompt bytes, budgets and revisions. v3 keeps its condition
direction guard; v2 retains its legacy parser contract. The original
`health.translation.model` describes the unversioned legacy route;
`currentModel` describes `cacheVersion` v4. All three accepted revisions are
listed. Word-card context still uses gpt-oss-120b/low/900 and is independent.
Shared 16-second deadline, two-attempt maximum, five-second retry cutoff,
quotas, origins, cancellation, no persistent logging and success schema stay.

Candidate account-API checks used public original samples. Initial Mistral
13/13 finite checks did not predict its later confidence-role errors; it was
rejected and the first 98 preview was restored to 97. Llama produced usable
text for 4/5. The subsequent GLM candidate passed eight finite checks including
three confidence levels with thinking disabled. Several requests were around
one second, but one took about 13 seconds; no general speed or accuracy claim.
These are candidate evidence, not deployed-reader or native acceptance.
Fresh deployed v4 API/reader/selection/scientific reports belong in the handoff;
old v2/v3 prompt replay is not a substitute for fresh live compatibility.

The documented GLM output is an OpenAI-style chat completion. Only a single
stopped assistant message with string content, no refusal or tool/function call
is accepted. Reasoning metadata is never copied into the result. Incomplete
markers and usage caps take precedence even if text appears complete.


The first 98 deployed candidate (085996c) exposed confidence-level/interval-value
confusion despite numeric preservation. Raw failed reports are retained. v4 adds
a generic quantity-role instruction and a narrow `quantity-role-mismatch` guard:
for explicit English confidence percentages followed by two interval endpoints,
reject Chinese that directly makes the confidence percentage the interval value.
Ambiguous shapes and endpoints equal to that percentage are declined, so this is
not a general scientific-fidelity guarantee. Existing v2/v3 behavior is retained.
Live probes separately verify model-by-revision, true statistical negation and
confidence role; correcting overly narrow test wording does not make the original
semantic error acceptable. Current-source acceptance must be rerun after the fix.
