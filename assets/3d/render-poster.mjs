#!/usr/bin/env node
// Rend les posters statiques du hero en exécutant la VRAIE scène WebGL (HeroMonolith.ts) dans Chromium headless.
//
//   node assets/3d/render-poster.mjs            # écrit apps/web/public/posters/hero{,-m}.{png,webp}
//
// Étapes : build Vite (celui d'Astro, aucune dépendance ajoutée) de assets/3d/poster → serveur HTTP local
// → Playwright/Chromium (SwiftShader) → lecture des pixels du canvas → PNG palette + WebP sans perte (sharp,
// lui aussi fourni par Astro). Aucun accès réseau.
//
// Variables : CHROMIUM (défaut /opt/pw-browsers/chromium), OUT_DIR (défaut apps/web/public/posters).
import { mkdtemp, readFile, realpath, rm, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../..');
const web = join(repo, 'apps/web');
const outDir = resolve(process.env.OUT_DIR ?? join(web, 'public/posters'));

// Miroir de POSTERS / POSTER_DPR dans apps/web/src/islands/hero3d/poster.ts.
const VARIANTS = [
  { file: 'hero', w: 1280, h: 520 },
  { file: 'hero-m', w: 480, h: 720 },
];

// vite et sharp sont des dépendances d'astro : on les résout depuis apps/web/node_modules/astro.
const astroReq = createRequire(await realpath(join(web, 'node_modules/astro/package.json')));
const load = async (name) => import(pathToFileURL(astroReq.resolve(name)).href);
const { build } = await load('vite');
const sharp = (await load('sharp')).default;
const { chromium } = await import('@playwright/test');

const dist = await mkdtemp(join(tmpdir(), 'nd-poster-'));
await build({
  configFile: false,
  root: join(here, 'poster'),
  logLevel: 'warn',
  base: './',
  build: { outDir: dist, emptyOutDir: true, minify: false, modulePreload: false },
});

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = createServer(async (req, res) => {
  try {
    const p = join(dist, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    const body = await readFile(p.endsWith('/') ? join(p, 'index.html') : p);
    res.writeHead(200, { 'content-type': MIME[extname(p)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
try {
  for (const v of VARIANTS) {
    const page = await browser.newPage({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: 1 });
    page.on('console', (m) => m.type() === 'error' && console.error('[page]', m.text()));
    await page.goto(`http://127.0.0.1:${port}/index.html?w=${v.w}&h=${v.h}`);
    await page.waitForFunction(() => window.__poster, null, { timeout: 30_000 });
    const res = await page.evaluate(() => window.__poster);
    await page.close();
    if (res.error) throw new Error(res.error);
    const raw = Buffer.from(res.rgb, 'base64');
    const img = () => sharp(raw, { raw: { width: res.width, height: res.height, channels: 3 } });
    const png = join(outDir, `${v.file}.png`);
    const webp = join(outDir, `${v.file}.webp`);
    await img().png({ palette: true, colors: 4, dither: 0, compressionLevel: 9, effort: 10 }).toFile(png);
    await img().webp({ lossless: true, effort: 6 }).toFile(webp);
    const kb = async (f) => `${((await stat(f)).size / 1024).toFixed(1)} KB`;
    console.log(
      `${v.file}: ${res.width}×${res.height} (pixels hors palette avant normalisation : ${res.stray}) png ${await kb(png)} webp ${await kb(webp)}`,
    );
  }
} finally {
  await browser.close();
  server.close();
  await rm(dist, { recursive: true, force: true });
}
