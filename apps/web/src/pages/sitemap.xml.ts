import type { APIRoute } from 'astro';
import { createData } from '../lib/data';
import { escapeXml, isoDate } from '../lib/format';

export const GET: APIRoute = async ({ locals, site, url }) => {
  const origin = (site ?? url).origin;
  const db = createData(locals);
  const [index, projects, categories, tags] = await Promise.all([
    db.logIndex(),
    db.projects(),
    db.categories(),
    db.tags(),
  ]);

  const urls: { loc: string; lastmod?: string }[] = [
    { loc: '/' },
    { loc: '/projets' },
    { loc: '/journal' },
    ...projects.map((p) => ({ loc: `/projets/${p.slug}`, lastmod: isoDate(p.updated) })),
    ...index.map((p) => ({ loc: `/journal/${p.slug}`, lastmod: isoDate(p.published_at) })),
    ...categories.map((c) => ({ loc: `/journal/categorie/${c.slug}` })),
    ...tags.map((t) => ({ loc: `/journal/tag/${t.slug}` })),
  ];

  const body = urls
    .map(
      (u) =>
        `  <url><loc>${escapeXml(origin + u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`,
    )
    .join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
