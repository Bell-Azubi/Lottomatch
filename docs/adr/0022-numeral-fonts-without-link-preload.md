# ADR-0022: Numeral fonts without a link preload

- Status: Accepted
- Date: 2026-11-05

## Context

The two subset numeral fonts (Barlow Condensed 700 and 800, about 8 KB each) were requested twice
at startup: by `<link rel="preload" as="font" crossorigin>` tags that a build plugin wrote into
`index.html`, and by `document.fonts.load()` in `main.tsx`, which starts the `@font-face` loads
before the boot. Chromium and Firefox hand the preloaded response to the `@font-face` load.

The first CI run on WebKit (run 42043818830) logged two console warnings on every page, including
the display, where the fonts are drawn at once: "The resource …barlow-condensed-700….woff2 was
preloaded using link preload but not used within a few seconds from the window's load event", and
the same for 800. WebKit does not count the preload as used by the `@font-face` load. Safari would
show the same warnings, against the requirement of a console without warnings (§8), and the E2E
console guard failed 11 WebKit tests on them alone.

## Decision

- No `<link rel="preload">` for fonts. The build plugin that wrote the tags is removed.
- `main.tsx` keeps starting both fonts through the CSS Font Loading API (`document.fonts.load()`)
  before the IndexedDB boot. These are the same requests the `@font-face` rules make, so no engine
  can report them as unused. A failed load keeps the metric-matched fallback font.

## Consequences

- The font requests start once the entry script runs instead of while the HTML is parsed. Both
  fonts are precached by the service worker, so every visit after the first loads them from the
  cache.
- Lighthouse CI is unchanged within its run-to-run spread (median of 3 runs per address; mobile
  LCP 1.20–1.40 s, desktop 0.32 s, CLS ≤ 0.012, every category 100).
- The fonts stay in the first-load budget: `check-budgets.mjs` counts them from the Vite manifest,
  not from the HTML.
