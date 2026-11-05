# ADR-0014: Hash routing, 404 redirect and base path from the environment

- Status: Accepted
- Date: 2026-11-05

## Context

GitHub Pages serves static files under a project subpath (`https://<owner>.github.io/<repo>/`) or
a custom domain, cannot rewrite deep links and cannot set headers (C2, C3).

## Decision

- Routes are hashes: `#/`, `#/host`, `#/display`, `#/prizes`, `#/results`, `#/settings`; unknown
  hashes fall back to Start.
- `BASE_PATH` sets Vite's `base` (normalised to `/…/`); CI sets it to `/<repo>/` or to `/` for a
  custom domain. The web manifest `id`, `scope` and `start_url` and the service-worker scope use
  the same base.
- The build emits `404.html` with `<meta http-equiv="refresh">` to `SITE_URL` (absolute app
  root), falling back to the base path; it contains no script. `PAGES_CNAME` optionally emits
  `CNAME`; `.nojekyll` ships from `public/`.
- The CSP and referrer policy are injected as `<meta>` elements into the production build.

## Consequences

- Any deep link on Pages lands on the app root; in-app links never need a server.
- One build artefact works only for the base it was built for; CI builds once and deploys that
  artefact.
