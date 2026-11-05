/**
 * Serves the production build the way GitHub Pages does, so Lighthouse CI measures what visitors
 * get (§8): HTTP/2 over TLS, gzip for text, a 10-minute cache lifetime, the app under BASE_PATH,
 * a redirect for directories without a trailing slash and `404.html` for unknown paths.
 *
 * A throwaway self-signed certificate for localhost is created with `openssl` on start and
 * removed on exit; browsers need `--ignore-certificate-errors`.
 *
 * Usage: BASE_PATH=/Lottomatch/ node scripts/serve-pages.mjs [--port 4443] [--dir dist]
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { createSecureServer } from 'node:http2';
import { tmpdir } from 'node:os';
import { extname, join, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';
import { gzipSync } from 'node:zlib';

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};
/** GitHub Pages compresses text formats only. */
const COMPRESSIBLE = /^(text\/|application\/(json|manifest\+json)|image\/svg\+xml)/;

/** Mirrors `normaliseBase` in build/plugins.ts. */
function normaliseBase(raw) {
  const trimmed = (raw ?? '/').trim();
  if (trimmed === '' || trimmed === '/') return '/';
  const withLeading = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withLeading.endsWith('/') ? withLeading : `${withLeading}/`;
}

function createCertificate() {
  const dir = mkdtempSync(join(tmpdir(), 'lottomatch-pages-'));
  const key = join(dir, 'key.pem');
  const cert = join(dir, 'cert.pem');
  execFileSync(
    'openssl',
    [
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-nodes',
      '-keyout',
      key,
      '-out',
      cert,
      '-days',
      '1',
      '-subj',
      '/CN=localhost',
      '-addext',
      'subjectAltName=DNS:localhost,IP:127.0.0.1',
    ],
    { stdio: 'ignore' },
  );
  return { dir, key: readFileSync(key), cert: readFileSync(cert) };
}

const { values } = parseArgs({
  options: { port: { type: 'string', default: '4443' }, dir: { type: 'string', default: 'dist' } },
});
const port = Number(values.port);
if (!Number.isInteger(port) || port <= 0 || port > 65_535)
  throw new Error(`Invalid port ${values.port}`);
const root = resolve(values.dir);
const base = normaliseBase(process.env.BASE_PATH);

/** Resolves a URL path inside the build; undefined for paths outside the site or the build. */
function resolveFile(pathname) {
  if (!pathname.startsWith(base)) return undefined;
  const relative = pathname.slice(base.length);
  const file = resolve(root, `.${sep}${relative}`);
  return file === root || file.startsWith(`${root}${sep}`) ? file : undefined;
}

async function load(file) {
  try {
    const info = await stat(file);
    if (info.isDirectory()) return { directory: true };
    return { body: await readFile(file) };
  } catch {
    return undefined;
  }
}

async function respond(request, response) {
  const send = (status, body, file, extra = {}) => {
    const type = CONTENT_TYPES[extname(file)] ?? 'application/octet-stream';
    const headers = { 'content-type': type, 'cache-control': 'max-age=600', ...extra };
    let payload = body;
    const acceptsGzip = /\bgzip\b/.test(request.headers['accept-encoding'] ?? '');
    if (COMPRESSIBLE.test(type) && acceptsGzip) {
      payload = gzipSync(body);
      headers['content-encoding'] = 'gzip';
      headers.vary = 'Accept-Encoding';
    }
    response.writeHead(status, headers);
    response.end(request.method === 'HEAD' ? undefined : payload);
  };
  const notFound = async () => {
    const page = await load(join(root, '404.html'));
    if (page?.body === undefined) {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Not Found');
      return;
    }
    send(404, page.body, '404.html');
  };
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { allow: 'GET, HEAD' });
    response.end();
    return;
  }
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url ?? '/', 'https://localhost').pathname);
  } catch {
    await notFound();
    return;
  }
  if (`${pathname}/` === base) {
    response.writeHead(301, { location: base });
    response.end();
    return;
  }
  const file = resolveFile(pathname);
  if (file === undefined) {
    await notFound();
    return;
  }
  const found = await load(file);
  if (found?.directory === true) {
    if (!pathname.endsWith('/')) {
      response.writeHead(301, { location: `${pathname}/` });
      response.end();
      return;
    }
    const index = await load(join(file, 'index.html'));
    if (index?.body === undefined) await notFound();
    else send(200, index.body, 'index.html');
    return;
  }
  if (found?.body === undefined) await notFound();
  else send(200, found.body, file);
}

const certificate = createCertificate();
const cleanup = () => {
  rmSync(certificate.dir, { recursive: true, force: true });
};
const server = createSecureServer({
  key: certificate.key,
  cert: certificate.cert,
  allowHTTP1: true,
});
server.on('request', (request, response) => {
  respond(request, response).catch((error) => {
    console.error(error);
    if (!response.headersSent) response.writeHead(500);
    response.end();
  });
});
server.on('error', (error) => {
  cleanup();
  console.error(error.message);
  process.exit(1);
});
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close();
    cleanup();
    process.exit(0);
  });
}
server.listen(port, 'localhost', () => {
  console.log(`Serving ${root} like GitHub Pages (HTTP/2, TLS, gzip)`);
  console.log(`Local: https://localhost:${port}${base}`);
});
