# Dependencies

Every runtime dependency must earn its place in a 60 KB (gzip) initial bundle and run offline
without third-party requests. Versions are pinned exactly (`.npmrc` `save-exact=true`); `npm ci`
installs from the committed lockfile and Dependabot proposes updates weekly.

## Runtime

Sizes are the gzip size (level 9) of the package's published ESM build as installed; the bundled
share is smaller after tree-shaking and minification. The real initial bundle is measured by
`npm run budgets` in CI.

| Package           | Version | Purpose                                                                 | Why it is justified                                                                                                          | Size                      | Loaded  | Licence |
| ----------------- | ------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------- | ------- | ------- |
| `preact`          | 10.29.8 | UI rendering, hooks                                                     | Mandated by the brief; small React-compatible library (ADR-0002)                                                             | 4.8 KB + hooks 1.5 KB     | initial | MIT     |
| `@preact/signals` | 2.11.4  | Reactive store; a draw re-renders one board cell, not the board         | Mandated by the brief; fine-grained updates without a store library (pulls in `@preact/signals-core`)                        | 1.8 KB + core 2.1 KB      | initial | MIT     |
| `idb`             | 8.0.4   | Promise wrapper for IndexedDB                                           | Typed schema, transactions with `durability: 'strict'`, cursors; avoids error-prone raw IDB request code                     | 3.3 KB (unminified build) | initial | ISC     |
| `valibot`         | 1.5.0   | Validation at every trust boundary (storage, imports, channel messages) | Modular and tree-shakeable, so only the used validators ship; typed outputs                                                  | only used functions       | initial | MIT     |
| `workbox-window`  | 7.4.1   | Service-worker registration with an update prompt                       | Required by `vite-plugin-pwa` in prompt mode; detects waiting updates reliably                                               | 2.3 KB                    | initial | MIT     |
| `papaparse`       | 5.7.0   | CSV parsing for the prize import                                        | Robust quoting, multi-line cells and delimiter handling for Excel files; loaded only when a CSV is imported                  | 6.8 KB                    | lazy    | MIT     |
| `canvas-confetti` | 1.9.4   | Award celebration on the display                                        | Small canvas effect with no DOM dependencies; restricted to Gold, Cream and Red and run without a worker, so it fits the CSP | 6.9 KB                    | lazy    | ISC     |

Not dependencies, by decision: no CSS framework, no CSS-in-JS runtime, no router library (hash
routing is a few lines), no date library (`Intl` with Europe/Zurich), no analytics or error SaaS.

Self-hosted assets: Barlow Condensed 700 and 800, subset to digits, A–Z, Ä, Ö, Ü, space and
hyphen (16.7 KB for both, SIL OFL 1.1, `src/ui/design-system/fonts/OFL.txt`); the club badge in
`public/brand/` (trademark, see `LICENSE`).

## Development and CI

| Tool                                                                                  | Version                          | Purpose                                                                                                       |
| ------------------------------------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `vite`                                                                                | 8.3.5                            | Dev server and production build (Rolldown, Oxc JSX, Lightning CSS for minification, prefixes and CSS Modules) |
| `vite-plugin-pwa`, `workbox-build`                                                    | 2.0.0, 7.4.1                     | Service worker with precache and web manifest                                                                 |
| `typescript`                                                                          | 6.0.3                            | Strict type checking (ADR-0003)                                                                               |
| `eslint`, `@eslint/js`, `typescript-eslint`, `globals`                                | 10.14.0, 10.0.1, 8.72.1, 17.14.0 | Linting with `strictTypeChecked`, layer rules, banned APIs                                                    |
| `eslint-plugin-react-hooks`                                                           | 7.1.1                            | Rules of hooks and exhaustive dependencies for Preact hooks                                                   |
| `prettier`                                                                            | 3.9.10                           | Formatting                                                                                                    |
| `knip`                                                                                | 6.44.1                           | Unused files, exports and dependencies                                                                        |
| `vitest`, `@vitest/coverage-v8`, `jsdom`                                              | 5.0.5, 5.0.5, 30.1.3             | Unit and component tests with coverage thresholds                                                             |
| `@testing-library/preact`, `@testing-library/jest-dom`, `@testing-library/user-event` | 3.2.6, 7.0.1, 14.6.8             | Component tests through the accessibility tree                                                                |
| `fast-check`                                                                          | 4.10.2                           | Property-based tests of invariants I1–I7                                                                      |
| `fake-indexeddb`                                                                      | 6.2.7                            | IndexedDB in unit tests                                                                                       |
| `@playwright/test`, `@axe-core/playwright`                                            | 1.63.0, 4.14.0                   | E2E on Chromium, Firefox and WebKit with axe accessibility checks                                             |
| `@lhci/cli`                                                                           | 0.16.0                           | Lighthouse CI budgets                                                                                         |
| `@fontsource/barlow-condensed`, `subset-font`                                         | 5.3.0, 2.9.0                     | Source font and subsetting script (`npm run fonts`)                                                           |
| `@types/node`, `@types/papaparse`, `@types/canvas-confetti`                           | 26.6.6, 5.5.2, 1.9.0             | Type definitions                                                                                              |

The toolchain targets the current Node LTS (Node 26, `.nvmrc`); `engines` allows Node 22.12 and
later for local work.
