# Interactive cloud acceptance

This is a one-shot Google Colab CPU notebook job. It downloads the current
private source bundle, checks its hash, builds the extension, runs the real
Chromium MV3 installation suite with `LIVE_COLLINS=1`, and sends a bounded JSON
report back to an authenticated Worker/KV bridge. It does not mount Drive,
export browser profiles, run a remote desktop, solve CAPTCHA, or keep a VM alive.

The user opens the private notebook and chooses **Runtime → Run all**. Subsequent
iterations use the same notebook; the source comes from the latest deployed
manifest. A Google login and available Colab CPU runtime are required. Native
extension support and access to Collins must be established by an actual run.
An installed extension ID, matching build fingerprint, successful native checks,
real Youdao Collins bilingual dictionary result and cache measurements are all needed
for acceptance. Unit tests and a working report bridge alone do not count.

`build.py --out /path/outside/repository` packages tracked source and emits a
Worker entrypoint. Bundle the entrypoint with esbuild and deploy with `QA_STORE`
(KV) and `QA_TOKEN` (secret) bindings. The generated notebook and token remain
outside git and in the owner's private Drive. Never publish the notebook or token.
Results expire after seven days. The Worker serves source and collects reports;
it is not a browser host or a general proxy.

Acceptance also requires a separate installed offscreen report from the same
extension ID, version and fingerprint: genuine ocean lookup, exactly one cold
creation, existing-document reuse and finite measured timings. Missing, blocked,
stale or ordinary-page parser reports cannot pass. The runner includes the bounded
offscreen report in progress, completion and error submissions. GET /latest
recomputes acceptance using current rules instead of trusting an old saved flag.
