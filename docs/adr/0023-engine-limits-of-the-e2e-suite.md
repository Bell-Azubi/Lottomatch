# ADR-0023: Engine limits of the E2E suite

- Status: Accepted
- Date: 2026-11-05

## Context

The functional E2E suite runs on Chromium, Firefox and WebKit (§10). Its first run on Firefox
and WebKit in CI (run 42043818830) found three problems that come from the test tooling, not
from the app. The fourth WebKit problem, the font preload warnings, was an app change
(ADR-0022).

- **Offline check (C4).** Playwright documents service workers as supported in Chromium only. In
  WebKit the worker installed and controlled the console (the test's controller check passed),
  but after `context.setOffline(true)` the reload failed with "WebKit encountered an internal
  error", as did eleven subresource loads. In the same test Chromium answers that reload from the
  worker's cache, so WebKit's offline emulation fails loads that a real offline browser serves from
  the worker. Under Playwright's Firefox, `navigator.serviceWorker.ready` never resolved within
  the 90 s test timeout; the cause could not be narrowed down further from the CI log.
- **Contrast on overlays.** axe reported low contrast on the winner capsule of the win overlay in
  WebKit (dark text on gold, 9.3 : 1 when settled). The overlay fades in over 240 ms and axe
  weighs text colour by the current opacity of its ancestors, so a check during the fade measures
  a transparent overlay. The display window was also behind the console window at the time of the
  check, where a browser may hold back animations.
- **CSP violation on failure screenshots.** For every screenshot, Playwright's WebKit integration
  briefly inserts `<style>body {}</style>` to sync animations. The CSP (`style-src 'self'`) blocks
  it, and the console guard reported "CSP violation: style-src-elem inline". Screenshots are only
  taken of tests that already failed, so the violation appeared only next to another error.

## Decision

- The offline test runs on Chromium only (`test.skip` with the reason in
  `tests/e2e/persistence.spec.ts`). Offline operation in Firefox and Safari is checked by hand
  with the airplane-mode test on the event laptop (`docs/eventtag-checkliste.de.md`), which the
  event team runs in the browser they use anyway.
- `expectAccessible` waits until no finite animation is running before it calls axe, with a 5 s
  limit and a named failure. Checks of the display window bring it to the front first and then
  give the front back to the console.
- The console guard stays strict. Its CSP message now names the source location when the browser
  reports one, and a comment explains the WebKit screenshot probe.

## Consequences

- C4 is verified automatically on Chromium, the engine of Chrome and Edge. For Firefox and Safari,
  a wrong service worker would surface in the readiness checklist ("Offline-Speicher") and in the
  airplane-mode test before an event, not during one.
- Accessibility results describe what the audience sees once an overlay has settled; fades shorter
  than the limit only add their duration to the test.
- A real inline-style violation in WebKit still fails the test. The probe can add a CSP line only
  to a test that already failed.
