# License and dependency review

Project source is licensed under the root [MIT License](../LICENSE), copyright 2026 Lextide contributors. That license does not change the rights to Collins entries, external services or third-party software.

Original demonstration glossary/articles retain their existing CC0-1.0 identification. They are not fallback Collins definitions. Dictionary content is limited, on-demand excerpts from the explicitly labeled public Collins section on Youdao, with source attribution/links; it remains copyright HarperCollins Publishers. This is not licensed Collins API access or permission to distribute a dictionary corpus. AI context/paragraph output is separate Cloudflare Workers AI machine-generated content, not Collins original text. Current runtime does not use MyMemory.

## Parser and build dependencies

The Chromium extension uses native DOMParser through offscreen and bundles no linkedom or parser dependencies. Its package includes LICENSE and NOTICE.txt. Safari candidates explicitly retain linkedom and include THIRD_PARTY_NOTICES.txt with installed upstream notices. Cloudflare preview and Node tests continue to use linkedom.

| Dependency | Upstream license |
| --- | --- |
| esbuild 0.25.12 / platform binary | MIT |
| Playwright / playwright-core 1.62.1 | Apache-2.0 |
| linkedom 0.18.12, boolbase, uhyphen | ISC |
| cssom, htmlparser2, html-escaper | MIT |
| css-select, css-what, DOM handler/utilities/serializer, entities, nth-check | BSD-2-Clause |

This records installed dependency metadata. Optional platform packages and browser binaries retain their own notices. See the lockfile and generated notices for the exact distribution; a build/test pass is not a legal opinion or a complete security audit.

Provider references: [Youdao Collins entry](https://dict.youdao.com/w/eng/ocean/#collinsResult), [Collins API information](https://www.collinsdictionary.com/collins-api/), [Cloudflare Workers AI](https://developers.cloudflare.com/workers-ai/).
