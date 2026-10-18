import { expect, test } from '@playwright/test';

// Fumée du site public. Fonctionne avec ou sans PocketBase joignable :
// les pages d'index rendent toujours (placeholders), un slug inconnu donne 404 (ou 503 si PB est hors ligne).

const LIST_ROUTES = [
  '/',
  '/projets',
  '/journal',
  '/journal?q=test',
  '/rss.xml',
  '/sitemap.xml',
  '/og/site.png',
];

for (const path of LIST_ROUTES) {
  test(`GET ${path} répond 200`, async ({ request }) => {
    const res = await request.get(path);
    expect(res.status()).toBe(200);
    expect(res.headers()['x-content-type-options']).toBe('nosniff');
  });
}

test('pages publiques : Cache-Control edge et CSP', async ({ request }) => {
  const res = await request.get('/');
  expect(res.headers()['cache-control']).toMatch(/s-maxage=\d+/);
  expect(res.headers()['content-security-policy'] ?? '').toContain("frame-ancestors 'none'");
});

test('/healthz et /admin ne sont jamais mis en cache', async ({ request }) => {
  for (const path of ['/healthz', '/admin']) {
    const res = await request.get(path);
    expect(res.headers()['cache-control']).toBe('no-store');
  }
});

for (const path of ['/journal/slug-inexistant-e2e', '/projets/slug-inexistant-e2e', '/route-inconnue']) {
  test(`GET ${path} → 404 (503 si PocketBase hors ligne)`, async ({ request }) => {
    const res = await request.get(path);
    expect([404, 503]).toContain(res.status());
  });
}

test('robots.txt interdit /admin', async ({ request }) => {
  const res = await request.get('/robots.txt');
  expect(res.status()).toBe(200);
  expect(await res.text()).toMatch(/^Disallow:\s*\/admin/m);
});

test('RSS 2.0 valide en surface', async ({ request }) => {
  const xml = await (await request.get('/rss.xml')).text();
  expect(xml).toContain('<rss version="2.0"');
  expect(xml).toContain('<channel>');
});

test.describe('mobile 390px', () => {
  test.use({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });

  for (const path of ['/', '/projets', '/journal']) {
    test(`${path} : pas de défilement horizontal`, async ({ page }) => {
      await page.goto(path);
      const [scrollWidth, innerWidth] = await page.evaluate(() => [
        document.documentElement.scrollWidth,
        window.innerWidth,
      ]);
      expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
    });
  }

  test('accueil : SEO de base', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
    await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(1);
    await expect(page.locator('nav[aria-label="Navigation principale"] a')).toHaveCount(4);
  });
});
