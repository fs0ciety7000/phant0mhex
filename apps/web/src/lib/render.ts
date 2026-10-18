import { extractMediaIds, type RenderResult, render } from '@nd/markdown';
import type { Data } from './data';

/**
 * Rendu Markdown via le pipeline partagé, avec résolution `media:<id>`
 * à partir d'une seule requête PocketBase (ids extraits avant le rendu).
 */
export async function renderMarkdown(db: Data, md: string): Promise<RenderResult> {
  const media = await db.media(extractMediaIds(md));
  return render(md, { resolveMedia: (id) => media.get(id) ?? null });
}
