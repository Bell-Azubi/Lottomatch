# Lottomatch Live — FC Laufenburg-Kaisten

The caller's console and the audience's big screen for the FC Laufenburg-Kaisten Lottomatch: draw
numbers by spin or from a physical drum, confirm wins, award 24 rounds × 4 prizes and show
everything legibly on a projector, from one laptop and without a network once loaded.

Lottomatch Live is a static progressive web app on GitHub Pages. Every browser keeps its own data
in IndexedDB: a visitor who opens the public address gets an empty instance and can never affect
the event laptop. There is no server, no account and no tracking.

- **Spiel** (`#/host`): board 1–90, Drehen, manual entry, Rückgängig, Gewinn prüfen, Stechen,
  overlays and keyboard shortcuts (`?` lists them).
- **Anzeige** (`#/display`): read-only second window for the projector, synced live.
- **Preise**, **Auswertung**, **Einstellungen**: prize list with CSV import, results with
  printable winner list and exports, events, presentation, backups, PIN.

Guides for the event team (German): [Spielleitung](docs/spielleitung.de.md) and
[Eventtag-Checkliste](docs/eventtag-checkliste.de.md).

## Setup

Requirements: Node.js 26 LTS (see `.nvmrc`; Node 22.12 or later also works locally) and npm.

```bash
npm ci
npm run dev
```

The dev server prints its address (by default `http://localhost:5173/`). Open the console there
and the display with "Anzeige öffnen" or at `#/display`.

To check the production build under the Pages path:

```bash
BASE_PATH=/Lottomatch/ npm run build
BASE_PATH=/Lottomatch/ npm run preview
```

End-to-end tests need the Playwright browsers once:

```bash
npx playwright install --with-deps
```

## Scripts

| Script                  | What it does                                                                                        |
| ----------------------- | --------------------------------------------------------------------------------------------------- |
| `npm run dev`           | Vite dev server with hot reload                                                                     |
| `npm run build`         | Production build into `dist/` (reads `BASE_PATH`, `SITE_URL`, `PAGES_CNAME`)                        |
| `npm run preview`       | Serves `dist/` on port 4173                                                                         |
| `npm run lint`          | CSS module types up to date, ESLint (`strictTypeChecked`, layer rules), Prettier                    |
| `npm run lint:knip`     | Unused files, exports and dependencies                                                              |
| `npm run typecheck`     | TypeScript for the app and for the tooling                                                          |
| `npm test`              | Unit, property-based and component tests (Vitest)                                                   |
| `npm run test:coverage` | The same with coverage thresholds: domain ≥ 95 %, overall ≥ 85 %                                    |
| `npm run test:e2e`      | Playwright on Chromium, Firefox and WebKit with axe, plus display snapshots (needs a build)         |
| `npm run test:e2e:perf` | Input latency, host → display latency and the endurance soak, one worker (needs a build)            |
| `npm run budgets`       | Initial JS ≤ 60 KB gzip, CSS ≤ 20 KB gzip, first load ≤ 250 KB, lazy pages stay lazy                |
| `npm run lhci`          | Lighthouse CI, mobile and desktop, against a GitHub Pages stand-in (needs a build, Chrome, openssl) |
| `npm run verify`        | lint, knip, typecheck, coverage, build and budgets in one go                                        |
| `npm run format`        | Prettier on every file                                                                              |
| `npm run fonts`         | Re-creates the subset numeral fonts from `@fontsource/barlow-condensed`                             |
| `npm run css-types`     | Regenerates the typings of the CSS modules                                                          |

E2E and Lighthouse use the base path the build was made with; locally that is
`BASE_PATH=/Lottomatch/` for both commands:

```bash
BASE_PATH=/Lottomatch/ npm run build
npm run test:e2e
```

```bash
BASE_PATH=/Lottomatch/ npm run lhci
```

## Quality gates

`.github/workflows/ci.yml` runs on every pull request and on `main`; any failure blocks the merge.

| Gate                     | Threshold                                                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Lint, format, knip       | zero findings, zero warnings                                                                                                    |
| Types                    | `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`                                        |
| Unit and component tests | all green; coverage domain ≥ 95 %, overall ≥ 85 % (lines, branches, functions, statements)                                      |
| Runtime dependencies     | `npm audit --omit=dev` without high or critical advisories                                                                      |
| Budgets                  | initial JS ≤ 60 KB gzip, CSS ≤ 20 KB gzip, first load ≤ 250 KB including logo and fonts                                         |
| E2E                      | Chromium, Firefox, WebKit (offline check: Chromium); axe without serious or critical issues; no console error, no CSP violation |
| Visual                   | display at 1024×768, 1920×1080, 3840×2160 in both themes; latest number ≥ 35 vh, board ≥ 4.5 vh                                 |
| Latency and endurance    | input → paint ≤ 50 ms, host → display p95 ≤ 100 ms, no growth over four full events (Chromium)                                  |
| Lighthouse               | ≥ 95 in all categories; LCP ≤ 1.5 s mobile, ≤ 0.8 s desktop; CLS ≤ 0.02; TBT ≤ 100 ms (median)                                  |

`codeql.yml` analyses the code and the workflows; Dependabot proposes npm and Actions updates
weekly. All actions are pinned by full commit SHA. The Playwright image of the Firefox and WebKit
jobs is pinned by tag and digest and updated by hand (see Contributing).

## GitHub Pages

GitHub Pages on a free plan requires a **public repository**. Everything in this repository is
public: it must never hold personal data (winner names, phone numbers, photos of people). Winner
data lives only in the browser of the event laptop and in its backups.

Set up once:

1. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
2. **Settings → Branches**: protect `main`, require pull requests and the status check
   **CI passed**.
3. **Settings → Code security**: enable Dependabot alerts and security updates. Code scanning
   runs from `codeql.yml` (advanced setup), so leave CodeQL's default setup off.
4. Merge to `main`. CI builds and tests the site; `deploy.yml` then publishes exactly that build
   to `https://<owner>.github.io/<repo>/` (here `https://bell-azubi.github.io/Lottomatch/`).

The build takes its address from repository variables (**Settings → Secrets and variables →
Actions → Variables**). Without them it targets the project site:

| Variable      | Default                             | Purpose                                                     |
| ------------- | ----------------------------------- | ----------------------------------------------------------- |
| `BASE_PATH`   | `/<repo>/`                          | Vite `base`, manifest `scope` and `start_url`, worker scope |
| `SITE_URL`    | `https://<owner>.github.io/<repo>/` | Absolute target of the `404.html` redirect                  |
| `PAGES_CNAME` | unset                               | Writes a `CNAME` file into the site                         |

The deploy job compares the build with the address Pages reports and refuses to publish a build
made for another address.

### Custom domain

1. At your DNS provider, point the domain to GitHub Pages: for a subdomain such as
   `lotto.example.ch` a `CNAME` record to `<owner>.github.io`; for an apex domain the `A` and
   `AAAA` records listed in GitHub's documentation "Managing a custom domain for your GitHub Pages
   site".
2. Set the repository variables `BASE_PATH=/`, `SITE_URL=https://lotto.example.ch/` and
   `PAGES_CNAME=lotto.example.ch`.
3. **Settings → Pages → Custom domain**: enter the domain, wait for the DNS check, then enable
   **Enforce HTTPS**. (For Actions deployments this setting is authoritative; the `CNAME` file
   only documents the domain in the site.)
4. Re-run CI on `main` so the site is rebuilt for the new address.

Data in IndexedDB belongs to an origin: after moving to another domain the event laptop starts
empty. Export a backup before the switch and import it afterwards.

## Shipping a prepared event file

Prepared events let the organiser load a whole prize list on the event laptop with one click
(Preise → "Vorbereiteten Anlass laden").

1. In the app, prepare the event (Einstellungen → Anlass, Preise) without playing any round, then
   export it: Einstellungen → Daten → "Sicherung exportieren".
2. Edit the JSON file: remove `log`, `images` and `checksum`, and `imageId` from every prize
   (images are added on the event laptop; an edited file no longer matches its checksum). Check
   that it contains no personal data.
3. Save it as `public/events/<name>.json` (lowercase letters, digits and hyphens) and add an entry
   to `public/events/index.json`:

   ```json
   { "file": "<name>.json", "name": "Lottomatch 2027", "description": "24 Runden, Stand März" }
   ```

4. Open a pull request. CI checks every file in `public/events/`: it must be listed in the
   manifest, import cleanly and contain no log, images, checksum or image references
   (`src/application/shipped-events.test.ts`). On the event laptop the app validates it again and
   shows a preview before anything is created. After the merge the file is part of the site and
   of the offline cache.

`public/events/beispiel-lottomatch.json` is a complete example.

## Replacing the logo

The badge is `public/brand/fclk-logo.png` (trimmed to 139 × 139 px, transparent background). A
higher-resolution PNG (≥ 1024 px, square, trimmed) can replace it in place; the display then grows
the logo to about 11 vh on large screens, and to about 20 vh on the display's welcome page, without
a code change. For a vector version, change
`LOGO_URL` in `src/ui/design-system/Logo.tsx`. Regenerate the favicon and the icons in
`public/icons/` from the new file at the sizes of the existing ones.

## Project structure

```
src/
  domain/          pure TypeScript: events, commands, reducer, invariants, rules
  application/     use cases, signal store, sync protocol, display snapshot, ports
  infrastructure/  IndexedDB, crypto RNG, BroadcastChannel, Web Locks, wake lock, speech, PWA
  ui/              design system, app shell, features (board, host, claim, display, …)
  i18n/            de-CH and en catalogues
tests/e2e/         Playwright specs and display snapshots
scripts/           budgets, CSS module typings, font subsetting, Pages stand-in
docs/              architecture, ADRs, dependencies, guides, test report
```

Start with [docs/architecture.md](docs/architecture.md), the [ADRs](docs/adr/README.md),
[docs/dependencies.md](docs/dependencies.md) and the [test report](docs/test-report.md).

## Contributing

Commits follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/), releases
[Semantic Versioning](https://semver.org/); changes are recorded in [CHANGELOG.md](CHANGELOG.md).
The build injects the version from `package.json` and the commit SHA (Einstellungen → Über).
Copy in the app follows the de-CH rules: "ss" instead of "ß", «…» quotes, the apostrophe ’, CHF
formatted by `Intl` and dates as dd.MM.yyyy.

A Playwright upgrade can change the rendering of the display snapshots; regenerate them in the
same pull request with `npx playwright test --project=visual --update-snapshots=all` and review
the image diff. In the same pull request, set the Playwright container image of the Firefox and
WebKit jobs in `.github/workflows/ci.yml` to the new version, with its digest (ADR-0024). Until
then those jobs download the browser builds on every run and the CI run shows a warning.
Dependabot opens Playwright upgrades as a pull request of their own: push the image change to its
branch. The digest is that of the multi-platform index:

```bash
curl -sI -H 'Accept: application/vnd.oci.image.index.v1+json' https://mcr.microsoft.com/v2/playwright/manifests/v1.63.0-noble | grep -i '^docker-content-digest'
```

## Backlog

All Could items of the brief are implemented (voice and sound, sponsor carousel, handout status,
payout-ratio indicator, hash-chained audit log, projector placement). Candidates for later
versions:

- A spectator view on phones through a realtime `SyncTransport` (the port exists, ADR-0010).
- A vector or high-resolution club badge, so the logo and the icons are sharp at every size.
- Visual snapshots for Firefox and WebKit.

## Licence

The code is licensed under the [MIT License](LICENSE). The FC Laufenburg-Kaisten club badge and
the icons derived from it are trademarks of FC Laufenburg-Kaisten, are **not** covered by the
code licence and may only be used with the club's permission. Barlow Condensed is licensed under
the SIL Open Font License 1.1.
