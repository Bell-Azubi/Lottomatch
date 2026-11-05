import type { HtmlTagDescriptor, Plugin } from 'vite';

/** Content-Security-Policy applied to the production build (GitHub Pages cannot set headers). */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

/** Injects the CSP and referrer policy as the first elements of `<head>` in production builds. */
export function securityHeadersPlugin(): Plugin {
  return {
    name: 'lottomatch:security-headers',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(): HtmlTagDescriptor[] {
        return [
          {
            tag: 'meta',
            attrs: { 'http-equiv': 'Content-Security-Policy', content: CONTENT_SECURITY_POLICY },
            injectTo: 'head-prepend',
          },
          {
            tag: 'meta',
            attrs: { name: 'referrer', content: 'no-referrer' },
            injectTo: 'head-prepend',
          },
        ];
      },
    },
  };
}

function escapeAttribute(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
}

/** Builds the `404.html` that sends deep links back to the app root (no inline script). */
export function renderNotFoundPage(targetUrl: string): string {
  const url = escapeAttribute(targetUrl);
  return [
    '<!doctype html>',
    '<html lang="de-CH">',
    '<head>',
    '<meta charset="utf-8">',
    `<meta http-equiv="Content-Security-Policy" content="${escapeAttribute(CONTENT_SECURITY_POLICY)}">`,
    '<meta name="referrer" content="no-referrer">',
    '<meta name="robots" content="noindex">',
    `<meta http-equiv="refresh" content="0; url=${url}">`,
    '<title>Lottomatch Live</title>',
    '</head>',
    '<body>',
    `<p><a href="${url}">Weiter zur Lottomatch-App</a></p>`,
    '</body>',
    '</html>',
    '',
  ].join('\n');
}

export interface PagesOptions {
  /** Absolute URL of the deployed app root, e.g. `https://owner.github.io/repo/`. */
  readonly siteUrl: string | undefined;
  /** Optional custom domain written to `CNAME`. */
  readonly cname: string | undefined;
}

/** Emits GitHub Pages helper files: `404.html` and, when configured, `CNAME`. */
export function githubPagesPlugin(options: PagesOptions): Plugin {
  let base = '/';
  return {
    name: 'lottomatch:github-pages',
    apply: 'build',
    configResolved(config) {
      base = config.base;
    },
    generateBundle() {
      const target = options.siteUrl ?? base;
      this.emitFile({ type: 'asset', fileName: '404.html', source: renderNotFoundPage(target) });
      if (options.cname !== undefined) {
        this.emitFile({ type: 'asset', fileName: 'CNAME', source: `${options.cname}\n` });
      }
    },
  };
}

/** Normalises a base path to start and end with a slash. */
export function normaliseBase(raw: string | undefined): string {
  const trimmed = (raw ?? '/').trim();
  if (trimmed === '' || trimmed === '/') return '/';
  const withLeading = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withLeading.endsWith('/') ? withLeading : `${withLeading}/`;
}

/** Normalises an absolute site URL to end with a slash, or returns undefined when unset. */
export function normaliseSiteUrl(raw: string | undefined): string | undefined {
  const trimmed = raw?.trim();
  if (trimmed === undefined || trimmed === '') return undefined;
  const url = new URL(trimmed);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`SITE_URL must be http(s): ${trimmed}`);
  }
  return url.href.endsWith('/') ? url.href : `${url.href}/`;
}
