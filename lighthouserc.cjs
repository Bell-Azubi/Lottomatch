/**
 * Lighthouse CI gates (§8): at least 95 in all four categories, LCP ≤ 1.5 s on the mobile preset
 * and ≤ 0.8 s on desktop, CLS ≤ 0.02 and TBT ≤ 100 ms.
 *
 * Audits the production build as GitHub Pages serves it (HTTP/2 over TLS with gzip, see
 * scripts/serve-pages.mjs) under the same BASE_PATH it was built with: the simulated mobile
 * timings depend on the protocol, and Pages does not speak HTTP/1.1 to modern browsers.
 * Mobile is the default; `LIGHTHOUSE_DEVICE=desktop` runs the desktop pass (LHCI itself reads
 * every LHCI_* variable as a CLI flag, so the switch must not use that prefix).
 */
const desktop = process.env.LIGHTHOUSE_DEVICE === 'desktop';

/** Mirrors `normaliseBase` in build/plugins.ts so the URLs match the build. */
function normaliseBase(raw) {
  const trimmed = (raw ?? '/').trim();
  if (trimmed === '' || trimmed === '/') return '/';
  const withLeading = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withLeading.endsWith('/') ? withLeading : `${withLeading}/`;
}

const origin = 'https://localhost:4443';
const base = normaliseBase(process.env.BASE_PATH);

module.exports = {
  ci: {
    collect: {
      startServerCommand: 'node scripts/serve-pages.mjs',
      startServerReadyPattern: 'Local',
      startServerReadyTimeout: 60_000,
      url: [`${origin}${base}`, `${origin}${base}#/host`, `${origin}${base}#/display`],
      numberOfRuns: 3,
      settings: {
        ...(desktop ? { preset: 'desktop' } : {}),
        // CI runners and containers start Chrome without a user-namespace sandbox; the local
        // Pages stand-in uses a throwaway self-signed certificate.
        chromeFlags: '--no-sandbox --ignore-certificate-errors',
      },
    },
    assert: {
      // The median of all runs, not LHCI's default best run: one lucky run must not pass the gate.
      assertions: {
        'categories:performance': ['error', { minScore: 0.95, aggregationMethod: 'median' }],
        'categories:accessibility': ['error', { minScore: 0.95, aggregationMethod: 'median' }],
        'categories:best-practices': ['error', { minScore: 0.95, aggregationMethod: 'median' }],
        'categories:seo': ['error', { minScore: 0.95, aggregationMethod: 'median' }],
        'largest-contentful-paint': [
          'error',
          { maxNumericValue: desktop ? 800 : 1_500, aggregationMethod: 'median' },
        ],
        'cumulative-layout-shift': [
          'error',
          { maxNumericValue: 0.02, aggregationMethod: 'median' },
        ],
        'total-blocking-time': ['error', { maxNumericValue: 100, aggregationMethod: 'median' }],
      },
    },
    upload: {
      target: 'filesystem',
      outputDir: `.lighthouseci/${desktop ? 'desktop' : 'mobile'}`,
    },
  },
};
