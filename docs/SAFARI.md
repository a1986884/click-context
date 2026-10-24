# Safari iPhone beta preparation — NOT device verified

The Safari ZIP is a **candidate upload package**, not an installable iPhone app.
Neither Apple's upload acceptance nor TestFlight signing nor iOS installation has
been verified in this recovery cycle. Chromium desktop ZIP and Pages preview do
not establish Safari support.

## Shared implementation and compatibility

- Chromium and Safari use the same reader, dictionary, policy, storage and message
  implementation. `browser-api.js` chooses `browser` or `chrome` without copying data.
- The candidate targets Safari 18+ JavaScript and removes `minimum_chrome_version`.
  It keeps the MV3 module service worker. Safari 18 is a proposed test baseline,
  not a verified minimum runtime guarantee.
- Apple documents storage.session and dynamic scripting APIs from Safari 16.4.
  Session grants stay in session storage; they are never silently persisted into
  storage.local as a fallback. A browser without session storage fails closed.
- Safari website permission prompts, activeTab lifetime, provider-host access,
  suspended background processes, optional-host revocation, private browsing and
  extension-owned downloads need native acceptance tests.
- DOM caretRangeFromPoint fallback, passive pointer gesture tracking, visible
  viewport/zoom positioning, safe-area CSS and dark-mode CSS are shared. Node/DOM
  tests verify algorithms; they do not establish physical touch behavior.

## Apple's web packager: no Mac or Xcode purchase required

1. The owner enrolls in Apple Developer Program using an Apple Account with 2FA.
   Standard fee is USD 99 per year, or regional currency/pricing. Enrollment,
   identity verification, legal agreements and payment remain owner-controlled.
2. In App Store Connect, an authorized Account Holder/Admin/App Manager creates
   an app record, selects iOS, and supplies the name, unique Bundle ID and SKU.
3. Open the app's **Xcode Cloud** tab and **Safari Web Extension Packager**.
   Upload `lextide-safari-candidate-0.4.0.zip` with manifest.json at its root and
   all extension resources. Do not upload the repository/history bundle or the
   Chromium ZIP. The packager assembles the containing app.
4. Review packaging exceptions and build processing status. Packaging uses time
   from the 25 Xcode Cloud hours/month included in the program. Do not enable
   paid additional usage without approval.
5. After a build is available, configure TestFlight testing and invite testers.
   External beta distribution may require Apple's beta review and metadata.
6. On iPhone install the TestFlight invitation/build, then enable Lextide in
   Safari's extension settings and explicitly choose website access. Safari's
   browser access and Lextide's own translation networking consent are separate.
7. Verify small-screen and zoomed cards, scrolling vs tapping, selection,
   long-press release, toolbar Popup, provider access, revoked sites, force-close/
   reopen and vocabulary export. Record iOS/Safari versions and screenshots.

Do not submit to the App Store or purchase membership on the owner's behalf.

## Official references checked 2026-10-19

- https://developer.apple.com/documentation/safariservices/packaging-and-distributing-safari-web-extensions-with-app-store-connect
- https://developer.apple.com/documentation/safariservices/assessing-your-safari-web-extension-s-browser-compatibility
- https://developer.apple.com/documentation/safari-release-notes/safari-16_4-release-notes
- https://developer.apple.com/documentation/safariservices/managing-safari-web-extension-permissions
- https://developer.apple.com/help/account/membership/program-enrollment/
