// Parcours éditeur de bout en bout : connexion → nouveau billet → saisie → image → aperçu → publication → liste.
// Variables : E2E_BASE_URL (site Astro), E2E_PB_URL (PocketBase), E2E_EDITOR_EMAIL, E2E_EDITOR_PASSWORD.
// La MFA (OTP par e-mail) est active sur `editors` : sans SMTP, l'étape OTP est vérifiée puis la session
// est obtenue par impersonation superuser si E2E_PB_SUPERUSER_EMAIL / E2E_PB_SUPERUSER_PASSWORD sont fournis.
// E2E_CHROMIUM_PATH (optionnel) : binaire Chromium à utiliser.
// E2E_SCREENSHOT_DIR (optionnel) : dossier des captures (login, liste, éditeur 1440 et 390).
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';
import { expect, type Page, test } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL;
const PB = process.env.E2E_PB_URL;
const EMAIL = process.env.E2E_EDITOR_EMAIL;
const PASSWORD = process.env.E2E_EDITOR_PASSWORD;
const SU_EMAIL = process.env.E2E_PB_SUPERUSER_EMAIL;
const SU_PASSWORD = process.env.E2E_PB_SUPERUSER_PASSWORD;
const SHOTS = process.env.E2E_SCREENSHOT_DIR;

test.skip(
  !BASE || !PB || !EMAIL || !PASSWORD,
  'E2E_BASE_URL, E2E_PB_URL, E2E_EDITOR_EMAIL, E2E_EDITOR_PASSWORD requis',
);
test.use({
  baseURL: BASE,
  viewport: { width: 1440, height: 1000 },
  // Chromium préinstallé hors du cache Playwright (ex. /opt/pw-browsers/chromium).
  launchOptions: process.env.E2E_CHROMIUM_PATH ? { executablePath: process.env.E2E_CHROMIUM_PATH } : {},
});

// ---------- PNG minimal généré en mémoire (pas de fixture binaire) ----------
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = (CRC[(c ^ b) & 0xff] as number) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
/** Damier rouge/noir w×h (RGB 8 bits). */
function makePng(w: number, h: number): Buffer {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const on = ((x >> 4) + (y >> 4)) % 2 === 0;
      const o = y * (w * 3 + 1) + 1 + x * 3;
      raw[o] = on ? 0xff : 0x0b;
      raw[o + 1] = on ? 0x2a : 0x0b;
      raw[o + 2] = on ? 0x2a : 0x0b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: join(SHOTS, `${name}.png`), fullPage: false });
}

async function superuserToken(page: Page): Promise<string | null> {
  if (!SU_EMAIL || !SU_PASSWORD) return null;
  const su = await page.request.post(`${PB}/api/collections/_superusers/auth-with-password`, {
    data: { identity: SU_EMAIL, password: SU_PASSWORD },
  });
  return su.ok() ? ((await su.json()).token as string) : null;
}

/** Session éditeur via impersonation superuser (pas de SMTP pour l'OTP en local/CI). */
async function impersonate(page: Page): Promise<boolean> {
  const suToken = await superuserToken(page);
  if (!suToken) return false;
  const H = { Authorization: suToken };
  const list = await page.request.get(`${PB}/api/collections/editors/records`, {
    headers: H,
    params: { filter: `email="${EMAIL}"` },
  });
  const editor = (await list.json()).items?.[0];
  if (!editor) return false;
  const imp = await page.request.post(`${PB}/api/collections/editors/impersonate/${editor.id}`, {
    headers: H,
    data: { duration: 3600 },
  });
  if (!imp.ok()) return false;
  const { token, record } = await imp.json();
  await page.evaluate(
    ([t, r]) => localStorage.setItem('pocketbase_auth', JSON.stringify({ token: t, record: r })),
    [token, record] as const,
  );
  return true;
}

async function login(page: Page) {
  await page.goto('/admin/billets');
  await expect(page).toHaveURL(/\/admin\/login/);
  await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible();
  await shot(page, 'admin-login-1440');
  await page.getByLabel('E-mail').fill(EMAIL as string);
  await page.getByLabel('Mot de passe').fill(PASSWORD as string);
  await page.getByRole('button', { name: /Se connecter/ }).click();
  const otp = page.getByLabel('Code reçu par e-mail');
  const nav = page.getByRole('navigation', { name: 'Console' });
  await expect(otp.or(nav)).toBeVisible();
  if (await otp.isVisible()) {
    // MFA active : l'étape OTP est bien proposée ; sans boîte mail, on bascule sur l'impersonation.
    await expect(page.getByText('Étape 2/2')).toBeVisible();
    test.skip(
      !(await impersonate(page)),
      'MFA active : E2E_PB_SUPERUSER_EMAIL/PASSWORD requis pour finir le parcours',
    );
    await page.goto('/admin/billets');
  }
  await expect(nav).toBeVisible();
}

test('éditeur : créer, illustrer, prévisualiser et publier un billet', async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  await login(page);
  await expect(page.getByRole('heading', { name: /Billets/ })).toBeVisible();
  await shot(page, 'admin-list-1440');

  // --- nouveau billet ---
  await page.getByRole('link', { name: '+ Nouveau billet' }).click();
  await expect(page).toHaveURL(/\/admin\/billets\/nouveau$/);
  const title = `Test e2e ${Date.now().toString(36)}`;
  await page.getByLabel('Titre', { exact: true }).fill(title);
  await expect(page.getByLabel('Slug')).toHaveValue(/^test-e2e-/);

  const cm = page.locator('.cm-content');
  await cm.click();
  await page.keyboard.type('## Boucle de jeu\n\nUn paragraphe **important** pour le test.\n\n');
  await expect(page.locator('.adm-preview h2')).toContainText('Boucle de jeu');

  // Mod-S : première sauvegarde → l'URL prend l'identifiant du billet.
  await page.keyboard.press('ControlOrMeta+s');
  await expect(page).toHaveURL(/\/admin\/billets\/[a-z0-9]{15}$/);
  await expect(page.locator('.adm-save')).toHaveText('● Enregistré');

  // --- image via la toolbar (IMG → envoi) ---
  await page.getByRole('button', { name: 'Image (médiathèque ou envoi)' }).click();
  const picker = page.getByRole('dialog', { name: 'Insérer une image' });
  await expect(picker).toBeVisible();
  await picker
    .locator('input[type="file"]')
    .setInputFiles({ name: 'damier-rouge.png', mimeType: 'image/png', buffer: makePng(320, 180) });
  const meta = page.getByRole('dialog', { name: 'Image — description' });
  await expect(meta.getByLabel(/Texte alternatif/)).toHaveValue('damier rouge');
  await meta.getByLabel(/Légende/).fill('Damier de test');
  await meta.getByRole('button', { name: /Envoyer/ }).click();
  await expect(cm).toContainText(/!\[damier rouge\]\(media:[a-z0-9]{15}\)/, { timeout: 15_000 });

  // --- image par glisser-déposer ---
  const png = makePng(64, 64).toString('base64');
  const dt = await page.evaluateHandle((b64) => {
    const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const d = new DataTransfer();
    d.items.add(new File([bin], 'petit-carre.png', { type: 'image/png' }));
    return d;
  }, png);
  const box = await cm.boundingBox();
  await cm.dispatchEvent('drop', {
    dataTransfer: dt,
    clientX: (box?.x ?? 0) + 20,
    clientY: (box?.y ?? 0) + 10,
  });
  const meta2 = page.getByRole('dialog', { name: 'Image — description' });
  await expect(meta2.getByLabel(/Texte alternatif/)).toHaveValue('petit carre');
  await meta2.getByRole('button', { name: /Envoyer/ }).click();
  await expect(cm).toContainText(/!\[petit carre\]\(media:[a-z0-9]{15}\)/, { timeout: 15_000 });

  // --- aperçu : figure résolue depuis la médiathèque ---
  const figure = page.locator('.adm-preview figure.md-figure', { hasText: 'Damier de test' });
  const fig = figure.locator('img');
  await expect(fig).toBeVisible({ timeout: 10_000 });
  await expect(fig).toHaveAttribute('src', /\/api\/files\/[^/]+\/[a-z0-9]{15}\/damier_rouge/);
  await expect(fig).toHaveAttribute('alt', 'damier rouge');
  await expect(page.locator('.adm-preview figure.md-figure img')).toHaveCount(2);

  // Autosave (2 s) puis capture de l'éditeur.
  await expect(page.locator('.adm-save')).toHaveText('● Enregistré', { timeout: 10_000 });
  await shot(page, 'admin-editor-1440');

  // --- publication ---
  await page.getByRole('button', { name: '[ Publier ] >>>' }).click();
  await expect(page.getByRole('status').getByText('Billet publié.')).toBeVisible();
  await expect(page.getByRole('button', { name: /Statut : Publié/ })).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await shot(page, 'admin-editor-390');
  await page.setViewportSize({ width: 1440, height: 1000 });

  // --- conflit de révision : modification concurrente côté serveur ---
  const suToken = await superuserToken(page);
  if (suToken) {
    const postId = page.url().split('/').pop() as string;
    await page.request.patch(`${PB}/api/collections/posts/records/${postId}`, {
      headers: { Authorization: suToken },
      data: { excerpt: 'Modifié ailleurs' },
    });
    await cm.click();
    await page.keyboard.press('ControlOrMeta+End');
    await page.keyboard.type('\n\nAjout local.');
    const banner = page.getByRole('alert').filter({ hasText: 'Conflit' });
    await expect(banner).toBeVisible({ timeout: 10_000 });
    await banner.getByRole('button', { name: 'Recharger' }).click();
    await expect(banner).toBeHidden();
    await expect(page.getByLabel(/Extrait/)).toHaveValue('Modifié ailleurs');
    await expect(page.locator('.adm-save')).toHaveText('● Enregistré');
  }

  // --- liste ---
  await page
    .getByRole('navigation', { name: 'Console' })
    .getByRole('link', { name: /Billets/ })
    .click();
  const row = page.getByRole('row', { name: new RegExp(title) });
  await expect(row).toBeVisible();
  await expect(row.locator('.adm-badge')).toHaveText('Publié');
  await shot(page, 'admin-list-after-1440');
  await page.setViewportSize({ width: 390, height: 844 });
  await shot(page, 'admin-list-390');

  // Le billet publié est lisible publiquement (règle PocketBase).
  const pub = await page.request.get(`${PB}/api/collections/posts/records`, {
    params: { filter: `title="${title}"` },
  });
  expect((await pub.json()).totalItems).toBe(1);

  expect(errors).toEqual([]);
});
