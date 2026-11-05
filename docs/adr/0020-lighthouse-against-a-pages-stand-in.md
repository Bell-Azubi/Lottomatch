# ADR-0020: Lighthouse CI against a GitHub Pages stand-in

- Status: Accepted
- Date: 2026-11-05

## Context

Lighthouse simulates mobile timings from the recorded requests, and the simulation depends on the
protocol. `vite preview` speaks HTTP/1.1, so the simulation opens up to six connections, each with
its own handshake and slow start, and queues `index.js` behind the stylesheet, fonts, manifest
and icons. GitHub Pages serves HTTP/2 over TLS with gzip. The same build measured:

| Server                          | Mobile LCP (start, console, display) |
| ------------------------------- | ------------------------------------ |
| `vite preview` (HTTP/1.1, gzip) | 1.80 s, 2.17 s, 2.05 s               |
| HTTP/2 + TLS + gzip             | 1.20 s, 1.35 s, 1.35 s               |

The CI gate should describe what visitors get, not an artefact of the local server.

## Decision

- `scripts/serve-pages.mjs` serves `dist/` the way Pages does: HTTP/2 over TLS with a throwaway
  self-signed certificate (created with `openssl`, removed on exit), gzip for text formats,
  `cache-control: max-age=600`, the site under `BASE_PATH`, a 301 for directories without a
  trailing slash and `404.html` with status 404 for unknown paths.
- `lighthouserc.cjs` starts that server and audits the start page, the console (`#/host`) and the
  display (`#/display`), three runs each, with the mobile preset and, with
  `LIGHTHOUSE_DEVICE=desktop`, the desktop preset. Chrome gets `--ignore-certificate-errors`.
- Every assertion uses the median of the runs (LHCI's default is the best run).
- Playwright keeps using `vite preview`: protocol details do not matter for functional tests.

## Consequences

- CI needs `openssl`, which GitHub-hosted runners provide.
- LHCI groups URLs without their hash, so the three routes are asserted as one group of nine runs
  (median across routes); every route passes on its own as well (see `docs/test-report.md`).
- The stand-in does not reproduce Fastly's edge latency; the simulated network does that.
