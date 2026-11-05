# ADR-0019: First-visit loading order

- Status: Accepted
- Date: 2026-11-05

## Context

§8 asks for an LCP of at most 1.5 s on Lighthouse's mobile preset (simulated slow 4G: 150 ms
round trip, 1.6 Mbit/s, 4× CPU slowdown). The app renders after an asynchronous IndexedDB boot,
so everything requested between the first paint and the booted content shares the throttled
connection with it. Lighthouse's simulation (Lantern) showed three requests on that path that the
first screen does not need:

- the 192 px manifest icon, which Chrome fetches for its installability check alongside the
  styles and fonts (39 KB as a lossless PNG derived from the 139 px badge);
- the club badge in the header (39 KB, losslessly optimised; the file itself must stay
  unmodified, §7);
- `workbox-window` and the service-worker install, which started right after boot.

Observed timings on a fast machine were never the problem (LCP about 0.15 s); the simulated
mobile LCP was 1.8–2.1 s.

## Decision

- The badge `<img>` carries `fetchpriority="low"`: scripts, styles and the numeral fonts that make
  the console usable load first. The badge file is unchanged.
- The service worker is registered once the booted content has been painted (one animation frame
  plus a task, with a 2 s fallback for windows that start hidden), not during boot.
- The derived icons (`pwa-192`, `pwa-512`, `pwa-maskable-512`, `apple-touch-icon-180`) are
  256-colour palette PNGs: 39 → 10 KB, 296 → 61 KB, 201 → 45 KB and 35 → 9 KB, visually identical
  at their sizes. The 32 px favicon stays lossless, because palette reduction visibly harms its
  anti-aliased edge. The badge itself is never re-encoded lossily.

## Consequences

- On a first visit over a slow connection the badge can appear a moment after the controls.
  Every later visit is served from the precache, where priority does not matter.
- Offline readiness starts a few milliseconds later on the first visit; the readiness checklist
  shows "Offline-Speicher wird vorbereitet" until the worker is active.
- Replacing the badge with a higher-resolution file (§7) needs no code change, but the derived
  icons must be regenerated from it (see README).
