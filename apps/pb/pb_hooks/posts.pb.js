/// <reference path="../pb_data/types.d.ts" />
// Billets : slug, temps de lecture, révision, dates de publication, purge du cache.
// Hooks « modèle » (onRecordCreate/Update) : ils s'appliquent à toute sauvegarde,
// API REST comme dashboard ou cron.

onRecordCreate((e) => {
  require(`${__hooks}/lib/nd.js`).preparePost(e, true);
  e.next();
}, 'posts');

onRecordUpdate((e) => {
  require(`${__hooks}/lib/nd.js`).preparePost(e, false);
  e.next();
}, 'posts');

// --- purge Cloudflare (après commit ; un échec ne bloque jamais la sauvegarde) ---

onRecordAfterCreateSuccess((e) => {
  e.next();
  try {
    const nd = require(`${__hooks}/lib/nd.js`);
    const now = nd.postState(e.record);
    if (nd.isPublished(now)) nd.purgeCloudflare(e.app, nd.postPaths(e.app, now));
  } catch (err) {
    e.app.logger().error('posts purge (create)', 'error', String(err));
  }
}, 'posts');

onRecordAfterUpdateSuccess((e) => {
  e.next();
  try {
    const nd = require(`${__hooks}/lib/nd.js`);
    const now = nd.postState(e.record);
    const before = nd.postState(e.record.original());
    if (!nd.isPublished(now) && !nd.isPublished(before)) return;
    let paths = nd.postPaths(e.app, now);
    if (before && (before.slug !== now.slug || before.category !== now.category)) {
      paths = paths.concat(nd.postPaths(e.app, before));
    }
    nd.purgeCloudflare(e.app, paths);
  } catch (err) {
    e.app.logger().error('posts purge (update)', 'error', String(err));
  }
}, 'posts');

onRecordAfterDeleteSuccess((e) => {
  e.next();
  try {
    const nd = require(`${__hooks}/lib/nd.js`);
    const state = nd.postState(e.record);
    if (nd.isPublished(state)) nd.purgeCloudflare(e.app, nd.postPaths(e.app, state));
  } catch (err) {
    e.app.logger().error('posts purge (delete)', 'error', String(err));
  }
}, 'posts');
