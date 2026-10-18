import type { APIRoute } from 'astro';
import { createData } from '../lib/data';
import { rfc822, escapeXml as x } from '../lib/format';

/** RSS 2.0 — 20 derniers billets publiés. */
export const GET: APIRoute = async ({ locals, site, url }) => {
  const origin = (site ?? url).origin;
  const db = createData(locals);
  const { items } = await db.posts({ perPage: 20 });
  const last = items[0]?.published_at;

  const entries = items
    .map((p) => {
      const link = `${origin}/journal/${p.slug}`;
      const cat = p.expand?.category?.name;
      return [
        '    <item>',
        `      <title>${x(p.title)}</title>`,
        `      <link>${x(link)}</link>`,
        `      <guid isPermaLink="true">${x(link)}</guid>`,
        `      <pubDate>${rfc822(p.published_at)}</pubDate>`,
        p.excerpt ? `      <description>${x(p.excerpt)}</description>` : '',
        cat ? `      <category>${x(cat)}</category>` : '',
        '    </item>',
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Journal — Nicolas Dessenius</title>
    <link>${origin}/journal</link>
    <description>Game design, développement, outils et post-mortems.</description>
    <language>fr</language>
    <atom:link href="${origin}/rss.xml" rel="self" type="application/rss+xml" />
    ${last ? `<lastBuildDate>${rfc822(last)}</lastBuildDate>` : ''}
${entries}
  </channel>
</rss>
`;
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
};
