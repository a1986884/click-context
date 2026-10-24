# Recovery baseline — 2026-10-19

Owner approved continuing from local commit `255a5b32535a32d26df32d09affe2260d3448908`.
The final GitHub V0.3 commit `ae86dbb53e4abee446ddb7ca17ac6edb319a2b14` was not recovered.
This is an older development baseline, not the final V0.3 release.

GitLab's connected API creates commits from file actions; it cannot push arbitrary Git objects.
The initial GitLab commit is therefore a source snapshot. `local-history.bundle` preserves
the 10 available original local commits and branch references with their original hashes.
`uncommitted-browser-tests.patch` preserves the previously uncommitted test changes separately.

To inspect the preserved history in an isolated directory:

```sh
git clone local-history.bundle lextide-history
git -C lextide-history log --all --oneline
```

Before migration, `npm run check` and all 62 Node/DOM tests passed on this local baseline.
These are not installed extension or iPhone tests. Existing browser evidence belongs to an
earlier failed run and must not be presented as verification of this snapshot.
No WordTap files are included.
