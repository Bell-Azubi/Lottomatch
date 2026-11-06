# ADR-0024: Firefox and WebKit E2E in the official Playwright image

- Status: Accepted
- Date: 2026-11-06

## Context

The E2E jobs installed each browser with `npx playwright install --with-deps <browser>` on the
`ubuntu-24.04` runner. For Firefox and WebKit that installs about 120 Ubuntu packages (GStreamer,
codecs, fonts) from the runner's apt mirror on every run. Chromium needs few of them and installs
in about 20 s.

The mirror was slow twice within a day. On 2026-11-05 the Firefox job spent about 20 minutes in
that step. In CI run 42184818276 (the first push to `main` after PR #5) apt downloaded at about
30–40 KB/s, and the WebKit job was cancelled at its 40-minute timeout before a test had run.
"CI passed" failed and the deployment was skipped, although every test that ran had passed.

## Decision

- Firefox and WebKit run in their own job (`e2e-engines`, one job per browser) inside the
  official image `mcr.microsoft.com/playwright:v<version>-noble`, as Playwright's CI guide
  recommends for GitHub Actions (`--user 1001`, here with `--ipc=host`). The image contains the
  system libraries and the browser builds. The job no longer uses apt.
- The image is pinned by tag and digest and kept on the same version as `@playwright/test`. The
  job still runs `npx playwright install <browser>` (without `--with-deps`): a no-op while the
  versions match. If they drift, it fetches the matching browser build from Playwright's download
  server rather than failing.
- Chromium stays on the runner. The display snapshots were rendered there (ADR-0018), and the
  latency and endurance gates were calibrated there (ADR-0021).
- Browser install steps have a 10-minute limit of their own. A slow download then fails that
  step with a clear message, not the job timeout.
- "CI passed" requires the new job as well.

## Consequences

- Firefox and WebKit no longer depend on the Ubuntu mirror. The image is pulled from Microsoft's
  registry in about a minute.
- A Playwright upgrade has a second place to change: the image tag and digest in `ci.yml`.
  Dependabot does not update container images in workflow files. Until both are updated, the job
  downloads the browser build on every run but still works.
- The job names stay "E2E (chromium)", "E2E (firefox)" and "E2E (webkit)". The check that branch
  protection requires is "CI passed".
