/// <reference path="../pb_data/types.d.ts" />
// Contenu initial : ligne unique `site` (placeholders), catégories et projets.
// Aucun billet de blog ici. Les slugs sont posés explicitement (les hooks ne tournent pas
// forcément pendant les migrations).

const CATEGORIES = [
  { name: 'Game design', slug: 'game-design', order: 1 },
  { name: 'Dev', slug: 'dev', order: 2 },
  { name: 'Lead', slug: 'lead', order: 3 },
];

const PROJECTS = [
  {
    title: 'Cardormedia',
    slug: 'cardormedia',
    url: 'https://cardormedia.com',
    role: '[RÔLE]',
    year: '[ANNÉE]',
    order: 1,
  },
  {
    title: 'Arbre',
    slug: 'arbre',
    url: 'https://arbre.cardormedia.com',
    role: '[RÔLE]',
    year: '[ANNÉE]',
    order: 2,
  },
  { title: '[Projet 03]', slug: 'projet-03', url: '', role: '[RÔLE]', year: '[ANNÉE]', order: 3 },
];

const insert = (app, collectionName, data) => {
  const record = new Record(app.findCollectionByNameOrId(collectionName));
  for (const key of Object.keys(data)) record.set(key, data[key]);
  app.save(record);
};

const removeBySlug = (app, collectionName, slug) => {
  try {
    app.delete(app.findFirstRecordByData(collectionName, 'slug', slug));
  } catch (_) {
    // déjà supprimé
  }
};

migrate(
  (app) => {
    insert(app, 'site', {
      bio: '[BIO — à fournir]',
      email: '[EMAIL]',
      socials: [],
      availability: '[DISPONIBILITÉ]',
      base: '[VILLE]',
    });
    for (const c of CATEGORIES) insert(app, 'categories', c);
    for (const p of PROJECTS) insert(app, 'projects', p);
  },
  (app) => {
    for (const p of PROJECTS) removeBySlug(app, 'projects', p.slug);
    for (const c of CATEGORIES) removeBySlug(app, 'categories', c.slug);
    for (const r of app.findAllRecords('site')) app.delete(r);
  },
);
