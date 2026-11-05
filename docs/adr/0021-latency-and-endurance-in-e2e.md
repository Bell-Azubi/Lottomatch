# ADR-0021: Latency and endurance measured in E2E

- Status: Accepted
- Date: 2026-11-05

## Context

§8 sets input → painted result ≤ 50 ms with animation off (Event Timing API), host → display
≤ 100 ms at p95, a repeat visit from the service worker interactive within 300 ms and an
accelerated soak test with no memory growth (Chromium heap metrics via CDP). Early measurements
were dominated by the test setup rather than by the app:

- With other Playwright workers running and tracing on, Event Timing durations of 56–80 ms
  appeared even for hover events whose handlers do nothing: the time was presentation delay of
  the headless compositor, not app work (handler time 0–4 ms, no long animation frames).
- `JSHeapUsedSize` rose by about 0.1 MB per event. A heap-snapshot diff attributed it to V8
  warm-up (hidden classes, compiled-function metadata) and to Chromium's bounded performance
  timeline buffers (layout shifts, LCP and event entries), not to app objects.

## Decision

- Timing specs run in their own Chromium projects (`performance`, `soak`) with one worker and
  tracing off, in a CI step after the functional suite, never alongside other browsers.
- Input latency is the longest Event Timing entry per interaction (`interactionId`, as INP
  groups them), from the moment the observer is registered; hover events carry no interaction ID
  and are not inputs. The spec also checks that Event Timing is live (`first-input` recorded).
- Host → display latency is measured per draw from the host's `keydown` timestamp to the next
  animation frame after the display's DOM shows the draw, both as `timeOrigin`-based wall-clock
  times of the same machine; the p95 of 20 draws is asserted.
- The repeat visit (§8: interactive ≤ 300 ms from the service worker) reloads a console the
  worker controls (the response must come from the worker) and times navigation start → the first
  painted frame with the board; the median of three reloads is asserted.
- The soak plays four full events (24 rounds × 4 prizes each) back to back with the display open
  and compares the second with the last event: live JS objects in each page's main world
  (`Runtime.queryObjects`, which excludes Playwright's isolated world) may grow by at most 25 per
  event (the new event's record in the event list); the V8 heap by at most 2 MB, DOM nodes by 150
  and event listeners by 25. A retained session would add thousands of objects per event.

## Consequences

- Results are stable across runs (input ≤ 32 ms, display p95 ≈ 10 ms, repeat visit ≈ 60 ms, flat
  object counts in this environment) and fail only on real regressions.
- The soak takes about 2 minutes; `SOAK_EVENTS` raises the number of events for longer runs.
- Firefox and WebKit are not measured: Event Timing and CDP heap metrics are Chromium APIs.
