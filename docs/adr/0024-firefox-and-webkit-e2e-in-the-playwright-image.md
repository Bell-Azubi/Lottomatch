# ADR-0024: Firefox and WebKit E2E in the official Playwright image

- Status: Accepted
- Date: 2026-11-06

## Context

The E2E jobs installed each browser with `npx playwright install --with-deps <browser>` on the
`ubuntu-24.04` runner. On every run that fetched Ubuntu packages from the runner's apt mirror:

- WebKit: 181 packages, 114 MB (GStreamer, codecs, fonts);
- Firefox: 40 packages, 48.8 MB;
- Chromium: nine font packages, 21.1 MB. The runner image already has Chromium's libraries, and on
  a normal mirror the step takes about 20 s.

The mirror was slow twice within a day, at 37–39 kB/s:

- On 2026-11-05 the Firefox job spent 19 minutes in that step (run 42076159714).
- In CI run 42184818276, the first push to `main` after PR #5, the WebKit job was cancelled at its
  40-minute timeout while apt was still fetching package 123. "CI passed" failed and the deployment
  was skipped, although every test that ran had passed.

Downloading browser builds from Playwright's own download server took seconds on the same
machines.

## Decision

- **Firefox and WebKit run in the official image.** They have their own job, `e2e-engines`, one
  job per browser, inside `mcr.microsoft.com/playwright:v<version>-noble`. This is the setup
  Playwright's CI guide recommends for GitHub Actions, with `--user 1001`. The job also passes
  `--ipc=host`, so the browsers use the host's shared memory instead of Docker's 64 MB `/dev/shm`.
  The image contains the system libraries and the browser builds, so the job runs no apt.
- **The image is pinned by tag and digest.** Docker pulls by the digest and ignores the tag, so
  the two change together. The image stays on the version of `@playwright/test`. The job still
  runs `npx playwright install <browser>` without `--with-deps`. This is a no-op while the versions
  match. After a Playwright upgrade without a new image, it fetches the matching browser build and
  annotates the run with a warning that names both versions.
- **Chromium stays on the runner.** The display snapshots (ADR-0018) and the latency and endurance
  gates (ADR-0021) pass there. In the image both would need new evidence: new baselines and new
  timing runs.
- **Chromium's install step has a 20-minute limit of its own.** Its 21.1 MB of fonts take about
  9–10 minutes on the slow mirror; a download that stalls fails that step with a clear message,
  not the job timeout. Firefox and WebKit have a 10-minute limit for their browser-build step.
- **Playwright upgrades get a Dependabot group of their own.** Such a pull request also needs the
  image update, and possibly new snapshots.
- **"CI passed" requires the new job as well.**

## Consequences

- **Firefox and WebKit depend on `mcr.microsoft.com` instead of the Ubuntu mirror.** Each job
  pulls about 0.96 GB (linux/amd64, compressed). The runner tries the pull up to three times; a
  registry outage fails the job at "Initialize containers", and a re-run is the remedy.
- **Chromium still fetches its fonts from the mirror.** A slow mirror makes that job about
  10 minutes longer. If its install step times out, re-run the job; if that recurs, move Chromium
  into the image as well.
- **A Playwright upgrade has a second place to change:** the image tag and digest in `ci.yml`
  (README, Contributing). Until both are updated, the job downloads the browser builds on every
  run. That works while the newer builds need no system library that the image lacks. Otherwise
  Firefox and WebKit fail at launch with Playwright's list of missing dependencies.
- **Job names are unchanged:** "E2E (chromium)", "E2E (firefox)" and "E2E (webkit)". Branch
  protection requires "CI passed".
