import { deflateSync } from 'node:zlib';
import { type APIRequestContext, expect, request as pwRequest, test } from '@playwright/test';

// Tests API de PocketBase : règles d'accès (frontière de sécurité) et hooks.
// Prérequis : une instance avec les migrations/hooks du repo et un superuser.
//   E2E_PB_URL (défaut http://localhost:8090)
//   E2E_PB_SUPERUSER_EMAIL / E2E_PB_SUPERUSER_PASSWORD
// Le superuser crée un éditeur jetable puis l'impersonne (le login éditeur réel exige l'OTP).

const PB_URL = process.env.E2E_PB_URL ?? 'http://localhost:8090';
const SU_EMAIL = process.env.E2E_PB_SUPERUSER_EMAIL ?? '';
const SU_PASSWORD = process.env.E2E_PB_SUPERUSER_PASSWORD ?? '';
const RUN = `e2e${Date.now().toString(36)}`;
const EDITOR_PASSWORD = 'e2e-Editor-Passw0rd!';

test.describe.configure({ mode: 'serial' });
test.skip(!SU_EMAIL || !SU_PASSWORD, 'E2E_PB_SUPERUSER_EMAIL / E2E_PB_SUPERUSER_PASSWORD requis');

let anon: APIRequestContext;
let su: APIRequestContext;
let editor: APIRequestContext;
let editorId = '';
const created: { collection: string; id: string }[] = [];

const iso = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString().replace('T', ' ');
const HOUR = 3600 * 1000;

// --- PNG minimal généré à la volée (couleur unie) --------------------------------
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = (CRC_TABLE[(c ^ b) & 0xff] as number) ^ (c >>> 8);
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
function makePng(width: number, height: number): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // profondeur
  ihdr.writeUInt8(2, 9); // RGB
  const row = Buffer.alloc(1 + width * 3);
  for (let x = 0; x < width; x++) row.writeUInt8(0xff, 1 + x * 3); // rouge
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
const pngWidth = (buf: Buffer) => buf.readUInt32BE(16);

// --- helpers -----------------------------------------------------------------------
async function createRecord(ctx: APIRequestContext, collection: string, data: Record<string, unknown>) {
  const res = await ctx.post(`/api/collections/${collection}/records`, { data });
  const body = await res.json();
  if (res.ok()) created.push({ collection, id: body.id });
  return { res, body };
}

async function createPost(data: Record<string, unknown>) {
  const { res, body } = await createRecord(editor, 'posts', data);
  expect(res.status(), JSON.stringify(body)).toBe(200);
  return body;
}

async function anonSlugs(): Promise<string[]> {
  const res = await anon.get('/api/collections/posts/records', {
    params: { filter: `slug ~ "${RUN}"`, perPage: 200 },
  });
  expect(res.status()).toBe(200);
  return (await res.json()).items.map((p: { slug: string }) => p.slug);
}

test.beforeAll(async () => {
  anon = await pwRequest.newContext({ baseURL: PB_URL });
  const auth = await anon.post('/api/collections/_superusers/auth-with-password', {
    data: { identity: SU_EMAIL, password: SU_PASSWORD },
  });
  expect(auth.status(), 'auth superuser').toBe(200);
  const suToken = (await auth.json()).token as string;
  su = await pwRequest.newContext({ baseURL: PB_URL, extraHTTPHeaders: { Authorization: suToken } });

  const ed = await su.post('/api/collections/editors/records', {
    data: {
      email: `${RUN}@example.test`,
      password: EDITOR_PASSWORD,
      passwordConfirm: EDITOR_PASSWORD,
      name: 'Éditeur e2e',
      verified: true,
    },
  });
  expect(ed.status(), await ed.text()).toBe(200);
  editorId = (await ed.json()).id;

  const imp = await su.post(`/api/collections/editors/impersonate/${editorId}`, { data: { duration: 3600 } });
  expect(imp.status(), await imp.text()).toBe(200);
  const edToken = (await imp.json()).token as string;
  editor = await pwRequest.newContext({ baseURL: PB_URL, extraHTTPHeaders: { Authorization: edToken } });
});

test.afterAll(async () => {
  if (!su) return;
  for (const { collection, id } of [...created].reverse()) {
    await su.delete(`/api/collections/${collection}/records/${id}`);
  }
  if (editorId) await su.delete(`/api/collections/editors/records/${editorId}`);
  await Promise.all([anon?.dispose(), su.dispose(), editor?.dispose()]);
});

test.describe('editors', () => {
  test('inscription publique refusée', async () => {
    const res = await anon.post('/api/collections/editors/records', {
      data: { email: `${RUN}-x@example.test`, password: EDITOR_PASSWORD, passwordConfirm: EDITOR_PASSWORD },
    });
    expect([400, 403]).toContain(res.status());
  });

  // MFA désactivée temporairement (migration 1792290000) tant qu'aucun SMTP n'est configuré.
  test('connexion éditeur par mot de passe (MFA désactivée)', async () => {
    const res = await anon.post('/api/collections/editors/auth-with-password', {
      data: { identity: `${RUN}@example.test`, password: EDITOR_PASSWORD },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.token).toBeTruthy();
    expect(body.mfaId).toBeUndefined();
  });

  test('un anonyme ne liste pas les éditeurs', async () => {
    const res = await anon.get('/api/collections/editors/records');
    expect(res.status()).toBe(200);
    expect((await res.json()).totalItems).toBe(0);
  });
});

test.describe('posts : visibilité publique', () => {
  const ids: Record<string, string> = {};

  test.beforeAll(async () => {
    ids.draft = (await createPost({ title: 'Brouillon', slug: `${RUN}-draft`, status: 'draft' })).id;
    ids.scheduled = (
      await createPost({
        title: 'Programmé',
        slug: `${RUN}-scheduled`,
        status: 'scheduled',
        published_at: iso(48 * HOUR),
      })
    ).id;
    ids.futurePublished = (
      await createPost({
        title: 'Publié dans le futur',
        slug: `${RUN}-future`,
        status: 'published',
        published_at: iso(48 * HOUR),
      })
    ).id;
    ids.published = (await createPost({ title: 'Publié', slug: `${RUN}-published`, status: 'published' })).id;
    ids.past = (
      await createPost({
        title: 'Publié hier',
        slug: `${RUN}-past`,
        status: 'published',
        published_at: iso(-24 * HOUR),
      })
    ).id;
  });

  test('anonyme : seuls les billets publiés et datés du passé sont listés', async () => {
    expect((await anonSlugs()).sort()).toEqual([`${RUN}-past`, `${RUN}-published`]);
  });

  test('anonyme : brouillon et programmés introuvables en lecture directe', async () => {
    for (const key of ['draft', 'scheduled', 'futurePublished']) {
      const res = await anon.get(`/api/collections/posts/records/${ids[key]}`);
      expect(res.status(), key).toBe(404);
    }
    const ok = await anon.get(`/api/collections/posts/records/${ids.published}`);
    expect(ok.status()).toBe(200);
  });

  test('anonyme : pas de fuite via filtre ou expand depuis media', async () => {
    const m = await editor.post('/api/collections/media/records', {
      multipart: {
        file: { name: 'leak.png', mimeType: 'image/png', buffer: makePng(4, 4) },
        alt: 'test fuite',
        post: ids.draft as string,
      },
    });
    expect(m.status(), await m.text()).toBe(200);
    created.push({ collection: 'media', id: (await m.json()).id });

    const filtered = await anon.get('/api/collections/media/records', {
      params: { filter: `post.slug = "${RUN}-draft"` },
    });
    expect((await filtered.json()).totalItems).toBe(0);

    const expanded = await anon.get('/api/collections/media/records', {
      params: { filter: 'alt = "test fuite"', expand: 'post' },
    });
    const items = (await expanded.json()).items as { expand?: { post?: unknown } }[];
    expect(items.length).toBeGreaterThan(0);
    for (const it of items) expect(it.expand?.post).toBeUndefined();
  });

  test('anonyme : écriture refusée', async () => {
    const c = await anon.post('/api/collections/posts/records', {
      data: { title: 'pirate', slug: `${RUN}-pirate`, status: 'published' },
    });
    expect([400, 403]).toContain(c.status());
    const u = await anon.patch(`/api/collections/posts/records/${ids.published}`, { data: { title: 'x' } });
    expect(u.status()).toBe(404);
    const d = await anon.delete(`/api/collections/posts/records/${ids.published}`);
    expect(d.status()).toBe(404);
  });

  test('éditeur : voit tout', async () => {
    const res = await editor.get('/api/collections/posts/records', {
      params: { filter: `slug ~ "${RUN}"`, perPage: 200 },
    });
    expect((await res.json()).totalItems).toBe(5);
  });

  test('publier un brouillon le rend visible, le dépublier le cache', async () => {
    const pub = await editor.patch(`/api/collections/posts/records/${ids.draft}`, {
      data: { status: 'published' },
    });
    expect(pub.status()).toBe(200);
    expect((await pub.json()).published_at).not.toBe('');
    expect(await anonSlugs()).toContain(`${RUN}-draft`);

    const unpub = await editor.patch(`/api/collections/posts/records/${ids.draft}`, {
      data: { status: 'draft' },
    });
    expect(unpub.status()).toBe(200);
    expect(await anonSlugs()).not.toContain(`${RUN}-draft`);
  });
});

test.describe('posts : hooks', () => {
  test('slug FR → ASCII et unicité', async () => {
    const title = `Été à l’œuvre : ça démarre ! ${RUN}`;
    const a = await createPost({ title, status: 'draft' });
    const b = await createPost({ title, status: 'draft' });
    expect(a.slug).toBe(`ete-a-l-oeuvre-ca-demarre-${RUN}`);
    expect(b.slug).toBe(`ete-a-l-oeuvre-ca-demarre-${RUN}-2`);
  });

  test('slug unique imposé par index', async () => {
    const slug = `${RUN}-unique`;
    await createPost({ title: 'Un', slug, status: 'draft' });
    const { res } = await createRecord(editor, 'posts', { title: 'Deux', slug, status: 'draft' });
    expect(res.status()).toBe(400);
  });

  test('reading_time (≈220 mots/min, min 1) et revision++', async () => {
    const body = Array.from({ length: 500 }, (_, i) => `mot${i}`).join(' ');
    const p = await createPost({ title: `Lecture ${RUN}`, body, status: 'draft', revision: 42 });
    expect(p.reading_time).toBe(3);
    expect(p.revision).toBe(1);

    const u = await editor.patch(`/api/collections/posts/records/${p.id}`, { data: { body: 'court' } });
    const up = await u.json();
    expect(up.reading_time).toBe(1);
    expect(up.revision).toBe(2);

    const u2 = await editor.patch(`/api/collections/posts/records/${p.id}`, { data: { revision: 0 } });
    expect((await u2.json()).revision).toBe(3);
  });

  test('programmé : date future exigée', async () => {
    const past = await createRecord(editor, 'posts', {
      title: `Programmé passé ${RUN}`,
      status: 'scheduled',
      published_at: iso(-HOUR),
    });
    expect(past.res.status()).toBe(400);
    expect(past.body.data?.published_at?.code).toBe('validation_scheduled_in_past');

    const none = await createRecord(editor, 'posts', {
      title: `Programmé sans date ${RUN}`,
      status: 'scheduled',
    });
    expect(none.res.status()).toBe(400);
  });

  test('éditeur : suppression', async () => {
    const p = await createPost({ title: `À supprimer ${RUN}`, status: 'published' });
    const d = await editor.delete(`/api/collections/posts/records/${p.id}`);
    expect(d.status()).toBe(204);
  });
});

test.describe('autres collections', () => {
  test('lecture publique : site, catégories, projets (seed)', async () => {
    const site = await (await anon.get('/api/collections/site/records')).json();
    expect(site.totalItems).toBe(1);
    expect(site.items[0].email).toBeDefined();

    const cats = await (
      await anon.get('/api/collections/categories/records', { params: { perPage: 200 } })
    ).json();
    const catSlugs = cats.items.map((c: { slug: string }) => c.slug);
    for (const s of ['game-design', 'dev', 'lead']) expect(catSlugs).toContain(s);

    const projects = await (
      await anon.get('/api/collections/projects/records', { params: { sort: 'order' } })
    ).json();
    const titles = projects.items.map((p: { title: string }) => p.title);
    expect(titles).toEqual(expect.arrayContaining(['Cardormedia', 'Arbre', '[Projet 03]']));
  });

  test('site : ni création ni suppression via l’API, modification par un éditeur', async () => {
    const c = await editor.post('/api/collections/site/records', { data: { bio: 'x' } });
    expect(c.status()).toBe(403);
    const site = (await (await anon.get('/api/collections/site/records')).json()).items[0];
    const u = await editor.patch(`/api/collections/site/records/${site.id}`, { data: { base: site.base } });
    expect(u.status()).toBe(200);
    const a = await anon.patch(`/api/collections/site/records/${site.id}`, { data: { base: 'pirate' } });
    expect(a.status()).toBe(404);
  });

  test('slug auto pour catégories, tags et projets', async () => {
    const cat = await createRecord(editor, 'categories', { name: `Réflexions ${RUN}` });
    expect(cat.res.status()).toBe(200);
    expect(cat.body.slug).toBe(`reflexions-${RUN}`);
    const tag = await createRecord(editor, 'tags', { name: `Moteur de jeu ${RUN}` });
    expect(tag.body.slug).toBe(`moteur-de-jeu-${RUN}`);
    const proj = await createRecord(editor, 'projects', { title: `Démo n°1 ${RUN}` });
    expect(proj.body.slug).toBe(`demo-n-1-${RUN}`);

    const anonCat = await anon.post('/api/collections/categories/records', { data: { name: 'pirate' } });
    expect([400, 403]).toContain(anonCat.status());
  });
});

test.describe('media', () => {
  test('alt requis', async () => {
    const res = await editor.post('/api/collections/media/records', {
      multipart: { file: { name: 'no-alt.png', mimeType: 'image/png', buffer: makePng(8, 8) } },
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).data?.alt).toBeTruthy();
  });

  test('upload : dimensions calculées et miniatures', async () => {
    const res = await editor.post('/api/collections/media/records', {
      multipart: {
        file: { name: 'cover.png', mimeType: 'image/png', buffer: makePng(1200, 800) },
        alt: 'Aplat rouge',
      },
    });
    expect(res.status(), await res.text()).toBe(200);
    const m = await res.json();
    created.push({ collection: 'media', id: m.id });
    expect(m.width).toBe(1200);
    expect(m.height).toBe(800);

    const fileUrl = `/api/files/media/${m.id}/${m.file}`;
    const original = await anon.get(fileUrl);
    expect(original.status()).toBe(200);
    expect(pngWidth(await original.body())).toBe(1200);

    for (const [thumb, w] of [
      ['480x0', 480],
      ['960x0', 960],
    ] as const) {
      const t = await anon.get(fileUrl, { params: { thumb } });
      expect(t.status()).toBe(200);
      expect(pngWidth(await t.body()), thumb).toBe(w);
    }
  });

  test('upload refusé pour un non-image', async () => {
    const res = await editor.post('/api/collections/media/records', {
      multipart: {
        file: { name: 'note.txt', mimeType: 'text/plain', buffer: Buffer.from('bonjour') },
        alt: 'texte',
      },
    });
    expect(res.status()).toBe(400);
  });
});
