# GitHub source import

Original source commit: `3b0dae0df72240eed6aa71c66be0416ec1d68559` (109 reachable commits).

Command-line Git push lacks credentials and the connected GitHub integration rejects writes (403 Resource not accessible by integration). Source is uploaded through the signed-in GitHub web interface as browsable files; remote import commits differ from original commits.

The complete original history is preserved in `click-context-userscript-history.bundle`. Restore locally with:

```sh
git clone click-context-userscript-history.bundle click-context-history
git -C click-context-history log --oneline
```

The original 346 tracked source files are included. README and repository introduction are updated with the real repository URL. The history bundle preserves their original bytes. No private QA files, dependencies, credentials, or ignored environment files are included.

Userscript 0.7.129 remains a candidate. Native/package version 0.7.98 is independent. Builtin AI checks failed with HTTP 503; real vendor APIs, native script managers and iPhone acceptance are not verified. No backend or installer deployment or stable release is part of this import.

The CI workflow is uploaded last, after all source files, to avoid running against a partial import. CI status must be checked against that final remote commit.
