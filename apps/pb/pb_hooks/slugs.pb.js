/// <reference path="../pb_data/types.d.ts" />
// Slug automatique (FR → ASCII, unique) pour catégories, tags et projets.
// Les billets sont gérés dans posts.pb.js.

onRecordCreate(
  (e) => {
    const field = e.record.collection().name === 'projects' ? 'title' : 'name';
    require(`${__hooks}/lib/nd.js`).ensureSlug(e.app, e.record, field);
    e.next();
  },
  'categories',
  'tags',
  'projects',
);

onRecordUpdate(
  (e) => {
    const field = e.record.collection().name === 'projects' ? 'title' : 'name';
    require(`${__hooks}/lib/nd.js`).ensureSlug(e.app, e.record, field);
    e.next();
  },
  'categories',
  'tags',
  'projects',
);
