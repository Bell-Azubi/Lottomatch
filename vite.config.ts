import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import {
  fontPreloadPlugin,
  githubPagesPlugin,
  normaliseBase,
  normaliseSiteUrl,
  securityHeadersPlugin,
} from './build/plugins.ts';

interface PackageJson {
  readonly version: string;
}

const pkg = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as PackageJson;

function resolveCommitSha(): string {
  const fromEnv = process.env.GITHUB_SHA?.trim();
  if (fromEnv !== undefined && fromEnv !== '') return fromEnv;
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return 'unversioned';
  }
}

const base = normaliseBase(process.env.BASE_PATH);
const siteUrl = normaliseSiteUrl(process.env.SITE_URL);
const cnameRaw = process.env.PAGES_CNAME?.trim();
const cname = cnameRaw === undefined || cnameRaw === '' ? undefined : cnameRaw;

/** Browser targets: latest Chrome, Edge, Firefox and Safari ≥ 16.4 (see README). */
const CSS_TARGETS = {
  chrome: 111 << 16,
  edge: 111 << 16,
  firefox: 115 << 16,
  safari: (16 << 16) | (4 << 8),
  ios_saf: (16 << 16) | (4 << 8),
};

export default defineConfig({
  base,
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __COMMIT_SHA__: JSON.stringify(resolveCommitSha()),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
  },
  oxc: {
    jsx: { runtime: 'automatic', importSource: 'preact' },
  },
  css: {
    transformer: 'lightningcss',
    lightningcss: {
      targets: CSS_TARGETS,
      cssModules: { pattern: '[hash]_[local]', grid: false },
    },
  },
  build: {
    target: ['es2022', 'chrome111', 'edge111', 'firefox115', 'safari16.4'],
    cssMinify: 'lightningcss',
    manifest: true,
    sourcemap: false,
    assetsInlineLimit: 0,
    reportCompressedSize: true,
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
  plugins: [
    securityHeadersPlugin(),
    fontPreloadPlugin(),
    githubPagesPlugin({ siteUrl, cname }),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      strategies: 'generateSW',
      includeManifestIcons: false,
      manifest: {
        id: base,
        name: 'Lottomatch Live – FC Laufenburg-Kaisten',
        short_name: 'Lottomatch',
        description: 'Ziehung und Anzeige für den Lottomatch des FC Laufenburg-Kaisten.',
        lang: 'de-CH',
        dir: 'ltr',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'any',
        background_color: '#1E1E21',
        theme_color: '#1E1E21',
        icons: [
          { src: 'icons/pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: 'icons/pwa-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,png,json}'],
        globIgnores: ['icons/pwa-512.png', 'icons/pwa-maskable-512.png', '404.html'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        clientsClaim: false,
        skipWaiting: false,
      },
    }),
  ],
});
