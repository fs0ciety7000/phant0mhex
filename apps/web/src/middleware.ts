// En-têtes HTTP du site : Cache-Control (docs/ARCHITECTURE.md §5) + sécurité (CSP, etc.).

import { defineMiddleware } from 'astro:middleware';
import { createHash } from 'node:crypto';
import { pbOrigin } from './lib/pb';

/** Pages SSR publiques : CDN 5 min, servi périmé jusqu'à 24 h pendant la revalidation ; purge à la publication. */
const CACHE_EDGE = 'public, max-age=0, s-maxage=300, stale-while-revalidate=86400';
/** PocketBase injoignable : on ne fige pas les placeholders au CDN. */
const CACHE_DEGRADED = 'public, max-age=0, s-maxage=30';
const CACHE_404 = 'public, max-age=0, s-maxage=60';
/** Images OG : 7 jours au CDN. */
const CACHE_OG = 'public, max-age=86400, s-maxage=604800';

function cacheControl(path: string, status: number, degraded: boolean): string | null {
  if (path === '/healthz' || path === '/admin' || path.startsWith('/admin/')) return 'no-store';
  if (status >= 500) return 'no-store';
  if (status === 404) return CACHE_404;
  if (status !== 200) return null;
  if (degraded) return CACHE_DEGRADED;
  if (path.startsWith('/og/')) return CACHE_OG;
  return CACHE_EDGE;
}

const INLINE_SCRIPT = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
const DATA_TYPE = /\btype\s*=\s*["']?(application\/(ld\+)?json|text\/(template|plain))/i;

/** Hash SHA-256 de chaque script inline exécutable du document (CSP sans 'unsafe-inline'). */
function inlineScriptHashes(html: string): string[] {
  const out = new Set<string>();
  for (const m of html.matchAll(INLINE_SCRIPT)) {
    const attrs = m[1] ?? '';
    const body = m[2] ?? '';
    if (/\bsrc\s*=/i.test(attrs) || DATA_TYPE.test(attrs) || body.length === 0) continue;
    out.add(`'sha256-${createHash('sha256').update(body, 'utf8').digest('base64')}'`);
  }
  return [...out];
}

function csp(scriptHashes: string[]): string {
  const pb = pbOrigin();
  return [
    "default-src 'self'",
    `script-src 'self' 'wasm-unsafe-eval' ${scriptHashes.join(' ')}`.trim(),
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    `img-src 'self' data: blob: ${pb}`.trim(),
    `media-src 'self' ${pb}`.trim(),
    `connect-src 'self' ${pb}`.trim(),
    'frame-src https://www.youtube-nocookie.com',
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

export const onRequest = defineMiddleware(async (ctx, next) => {
  ctx.locals.degraded = false;
  const res = await next();
  const path = ctx.url.pathname;
  const headers = new Headers(res.headers);

  if (!headers.has('Cache-Control') || path === '/healthz' || path.startsWith('/admin')) {
    const cc = cacheControl(path, res.status, ctx.locals.degraded);
    if (cc) headers.set('Cache-Control', cc);
  }
  if (path === '/admin' || path.startsWith('/admin/')) headers.set('X-Robots-Tag', 'noindex, nofollow');

  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
  );
  headers.set('X-Frame-Options', 'DENY');

  const isHtml = headers.get('Content-Type')?.includes('text/html') ?? false;
  if (!isHtml) {
    return new Response(res.body, { status: res.status, headers });
  }

  const html = await res.text();
  // En dev, Vite injecte ses propres scripts : CSP uniquement en production.
  if (import.meta.env.PROD) headers.set('Content-Security-Policy', csp(inlineScriptHashes(html)));
  headers.delete('Content-Length');
  return new Response(html, { status: res.status, headers });
});
