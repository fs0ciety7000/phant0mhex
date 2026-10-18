/// <reference path="../pb_data/types.d.ts" />
// Billets programmés, toutes les 5 minutes :
// 1. un billet `scheduled` dont la date est passée passe en `published` (la sauvegarde
//    déclenche la purge du hook posts) ;
// 2. un billet `published` à date future devenu visible depuis le dernier passage
//    (aucune sauvegarde n'a eu lieu) → purge de /, /journal, /rss.xml et de sa page.

cronAdd('nd_scheduled_posts', '*/5 * * * *', () => {
  const nd = require(`${__hooks}/lib/nd.js`);
  const STORE_KEY = 'nd.scheduledPosts.lastRun';
  const now = new DateTime();
  const store = $app.store();
  const last = store.has(STORE_KEY) ? store.get(STORE_KEY) : now.add(-5 * 60 * 1000 * 1000 * 1000);
  store.set(STORE_KEY, now);

  try {
    const due = $app.findRecordsByFilter(
      'posts',
      'status = "scheduled" && published_at != "" && published_at <= {:now}',
      'published_at',
      100,
      0,
      { now: now.string() },
    );
    for (const post of due) {
      post.set('status', 'published');
      $app.save(post);
      $app.logger().info('scheduled post published', 'id', post.id, 'slug', post.getString('slug'));
    }
  } catch (err) {
    $app.logger().error('scheduled posts promotion', 'error', String(err));
  }

  try {
    const appeared = $app.findRecordsByFilter(
      'posts',
      'status = "published" && published_at > {:last} && published_at <= {:now}',
      '',
      100,
      0,
      { last: last.string(), now: now.string() },
    );
    if (appeared.length > 0) {
      const paths = ['/', '/journal', '/rss.xml', '/sitemap.xml'];
      for (const post of appeared) paths.push(`/journal/${post.getString('slug')}`);
      nd.purgeCloudflare($app, paths);
    }
  } catch (err) {
    $app.logger().error('scheduled posts purge', 'error', String(err));
  }
});
