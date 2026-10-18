/// <reference path="../../pb_data/types.d.ts" />
// Utilitaires partagés par les hooks. Chaque handler JSVM tourne dans un contexte isolé :
// les fonctions doivent être chargées via `require(`${__hooks}/lib/nd.js`)` dans le handler.

const WORDS_PER_MINUTE = 220;

const LIGATURES = {
  œ: 'oe',
  Œ: 'oe',
  æ: 'ae',
  Æ: 'ae',
  ß: 'ss',
  ø: 'o',
  Ø: 'o',
  đ: 'd',
  ł: 'l',
  '&': ' et ',
  '’': '-',
  "'": '-',
};

/** Slug ASCII depuis du français : « Été, l'œuvre ! » → « ete-l-oeuvre ». */
function slugify(input) {
  let s = String(input || '');
  s = s.replace(/[œŒæÆßøØđł&’']/g, (c) => LIGATURES[c]);
  s = s.normalize('NFD').replace(/[̀-ͯ]/g, '');
  s = s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (s.length > 80) s = s.slice(0, 80).replace(/-+$/g, '');
  return s;
}

function slugTaken(app, collectionName, slug, excludeId) {
  const rows = app.findRecordsByFilter(collectionName, 'slug = {:slug} && id != {:id}', '', 1, 0, {
    slug,
    id: excludeId || '',
  });
  return rows.length > 0;
}

/** Slug unique dans la collection : base, base-2, base-3… */
function uniqueSlug(app, collectionName, source, excludeId) {
  const base = slugify(source) || 'sans-titre';
  let candidate = base;
  let n = 2;
  while (slugTaken(app, collectionName, candidate, excludeId)) {
    candidate = `${base}-${n}`;
    n++;
  }
  return candidate;
}

/** Remplit le slug s'il est vide, à partir du champ source (title ou name). */
function ensureSlug(app, record, sourceField) {
  if (String(record.getString('slug')).trim() !== '') return;
  record.set('slug', uniqueSlug(app, record.collection().name, record.getString(sourceField), record.id));
}

/** Temps de lecture en minutes (≈220 mots/min, minimum 1). */
function readingTime(markdown) {
  const text = String(markdown || '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ') // images
    .replace(/\]\([^)]*\)/g, ']') // cibles de liens
    .replace(/<[^>]+>/g, ' ');
  const words = text.split(/\s+/).filter((w) => /[0-9A-Za-zÀ-ÖØ-öø-ÿ]/.test(w)).length;
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
}

/** Champs calculés et contrôles d'un billet avant validation (create et update). */
function preparePost(e, isNew) {
  const r = e.record;

  ensureSlug(e.app, r, 'title');
  r.set('reading_time', readingTime(r.getString('body')));
  r.set('revision', isNew ? 1 : r.original().getInt('revision') + 1);

  const status = r.getString('status');
  const publishedAt = r.getDateTime('published_at');

  if (status === 'published' && publishedAt.isZero()) {
    r.set('published_at', new DateTime());
  }

  if (status === 'scheduled') {
    const original = isNew ? null : r.original();
    const changed =
      isNew ||
      original.getString('status') !== 'scheduled' ||
      !original.getDateTime('published_at').equal(publishedAt);
    if (changed && (publishedAt.isZero() || !publishedAt.after(new DateTime()))) {
      throw new BadRequestError('Un billet programmé doit avoir une date de publication future.', {
        published_at: new ValidationError(
          'validation_scheduled_in_past',
          'La date de publication doit être dans le futur.',
        ),
      });
    }
  }
}

// --- dimensions d'image (lecture des en-têtes, sans dépendance) -----------------

function u16be(b, i) {
  return (b[i] << 8) | b[i + 1];
}
function u16le(b, i) {
  return b[i] | (b[i + 1] << 8);
}
function u24le(b, i) {
  return b[i] | (b[i + 1] << 8) | (b[i + 2] << 16);
}
function u32be(b, i) {
  return ((b[i] << 24) >>> 0) + ((b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]);
}
function ascii(b, i, n) {
  let s = '';
  for (let k = 0; k < n; k++) s += String.fromCharCode(b[i + k]);
  return s;
}

/** Retourne { width, height } pour PNG, JPEG, GIF, WebP, AVIF ; null sinon. */
function imageSize(b) {
  if (!b || b.length < 24) return null;
  // PNG
  if (b[0] === 0x89 && ascii(b, 1, 3) === 'PNG') {
    return { width: u32be(b, 16), height: u32be(b, 20) };
  }
  // GIF
  if (ascii(b, 0, 3) === 'GIF') {
    return { width: u16le(b, 6), height: u16le(b, 8) };
  }
  // WebP
  if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP') {
    const chunk = ascii(b, 12, 4);
    if (chunk === 'VP8X') return { width: u24le(b, 24) + 1, height: u24le(b, 27) + 1 };
    if (chunk === 'VP8 ') return { width: u16le(b, 26) & 0x3fff, height: u16le(b, 28) & 0x3fff };
    if (chunk === 'VP8L') {
      const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    return null;
  }
  // JPEG : parcours des segments jusqu'à un SOFn
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) {
        i++;
        continue;
      }
      const marker = b[i + 1];
      if (marker === 0xff) {
        i++;
        continue;
      }
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        i += 2;
        continue;
      }
      const len = u16be(b, i + 2);
      const isSOF = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isSOF) return { width: u16be(b, i + 7), height: u16be(b, i + 5) };
      i += 2 + len;
    }
    return null;
  }
  // AVIF / HEIF : boîte « ispe » (largeur, hauteur sur 32 bits après version/flags)
  if (ascii(b, 4, 4) === 'ftyp') {
    for (let i = 8; i + 20 < b.length; i++) {
      if (b[i] === 0x69 && ascii(b, i, 4) === 'ispe') {
        return { width: u32be(b, i + 8), height: u32be(b, i + 12) };
      }
    }
  }
  return null;
}

/** Lit les dimensions du premier fichier non encore sauvegardé du champ. */
function uploadedImageSize(record, field) {
  const files = record.getUnsavedFiles(field);
  if (!files || files.length === 0) return null;
  const reader = files[0].reader.open();
  try {
    return imageSize(toBytes(reader, 1024 * 1024));
  } finally {
    reader.close();
  }
}

/** Hook media : pose width/height depuis le fichier envoyé ; n'échoue jamais. */
function applyMediaDimensions(e) {
  try {
    const size = uploadedImageSize(e.record, 'file');
    if (size && size.width > 0 && size.height > 0) {
      e.record.set('width', size.width);
      e.record.set('height', size.height);
    }
  } catch (err) {
    e.app.logger().warn('media dimensions', 'error', String(err));
  }
}

// --- purge du cache Cloudflare --------------------------------------------------

/**
 * Purge les chemins donnés (relatifs à SITE_URL_FOR_PURGE). Ne lève jamais :
 * sans configuration, ne fait rien ; en cas d'échec, journalise seulement.
 */
function purgeCloudflare(app, paths) {
  try {
    const zone = $os.getenv('CF_ZONE_ID');
    const token = $os.getenv('CF_PURGE_TOKEN');
    const site = String($os.getenv('SITE_URL_FOR_PURGE') || '').replace(/\/+$/, '');
    if (!zone || !token || !site) return false;
    // CF_API_BASE : surcharge pour les tests locaux uniquement (serveur factice).
    const api = String($os.getenv('CF_API_BASE') || 'https://api.cloudflare.com/client/v4').replace(
      /\/+$/,
      '',
    );

    const seen = {};
    const files = [];
    for (const p of paths) {
      if (!p) continue;
      const url = site + (p.charAt(0) === '/' ? p : `/${p}`);
      if (seen[url]) continue;
      seen[url] = true;
      files.push(url);
    }
    // Cloudflare accepte 30 URLs par appel (offre gratuite).
    for (let i = 0; i < files.length; i += 30) {
      const res = $http.send({
        method: 'POST',
        url: `${api}/zones/${zone}/purge_cache`,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: files.slice(i, i + 30) }),
        timeout: 10,
      });
      if (res.statusCode < 200 || res.statusCode >= 300) {
        app.logger().warn('cloudflare purge failed', 'status', res.statusCode, 'body', toString(res.body));
      } else {
        app.logger().info('cloudflare purge ok', 'files', files.slice(i, i + 30).join(' '));
      }
    }
    return true;
  } catch (err) {
    try {
      app.logger().error('cloudflare purge error', 'error', String(err));
    } catch (_) {
      // rien
    }
    return false;
  }
}

function slugOfRecord(app, collectionName, id) {
  if (!id) return '';
  try {
    return app.findRecordById(collectionName, id).getString('slug');
  } catch (_) {
    return '';
  }
}

/** URLs publiques touchées par un billet (état donné en objet simple). */
function postPaths(app, state) {
  const paths = ['/', '/journal', '/rss.xml', '/sitemap.xml'];
  if (state.slug) paths.push(`/journal/${state.slug}`);
  const cat = slugOfRecord(app, 'categories', state.category);
  if (cat) paths.push(`/journal/categorie/${cat}`);
  for (const t of state.tags || []) {
    const tag = slugOfRecord(app, 'tags', t);
    if (tag) paths.push(`/journal/tag/${tag}`);
  }
  return paths;
}

/** Instantané des champs d'un billet utiles à la purge et à la visibilité. */
function postState(record) {
  if (!record) return null;
  return {
    status: record.getString('status'),
    slug: record.getString('slug'),
    category: record.getString('category'),
    tags: record.getStringSlice('tags'),
    publishedAt: record.getDateTime('published_at'),
  };
}

/** Le billet est-il (ou était-il) publiquement visible, ou le deviendra-t-il seul ? */
function isPublished(state) {
  return !!state && state.status === 'published';
}

module.exports = {
  slugify,
  uniqueSlug,
  ensureSlug,
  readingTime,
  preparePost,
  imageSize,
  uploadedImageSize,
  applyMediaDimensions,
  purgeCloudflare,
  postPaths,
  postState,
  isPublished,
};
