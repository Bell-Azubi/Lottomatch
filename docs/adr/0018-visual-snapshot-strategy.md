# ADR-0018: Visual snapshot strategy

- Status: Accepted
- Date: 2026-11-05

## Context

§11 asks for visual snapshots of the display at 1024×768, 1920×1080 and 3840×2160 in both themes.
Pixel snapshots are sensitive to the browser build and to system fonts, and UI text uses the
system font stack, which differs between machines.

## Decision

- Visual tests run in Playwright on Chromium only, with animations off, at the three viewports and
  in both themes.
- Baselines are generated on Linux with the pinned `@playwright/test` version, whose Chromium
  build CI installs as well, and committed next to the spec.
- Comparisons allow a small pixel-ratio tolerance (configured in `playwright.config.ts`) so font
  rasterisation differences do not fail the build, while layout, colour and ring changes do.
- Baselines are updated deliberately with `npx playwright test --update-snapshots` in a pull
  request whose diff shows the new images.

## Consequences

- Firefox and WebKit are covered by functional E2E and axe, not by pixel comparison.
- A Playwright upgrade may require regenerating baselines in the same pull request.
