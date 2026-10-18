// Contrat du pipeline Markdown partagé (site + aperçu admin). Voir le skill markdown-pipeline.
// Aucune API Node : le même code tourne en SSR (Astro) et dans le navigateur (aperçu admin).

import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeSanitize from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import remarkDirective from 'remark-directive';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import {
  type PipelineState,
  rehypeCode,
  rehypeExternalLinks,
  rehypeFrenchTypography,
  rehypeHeadings,
  rehypeMedia,
  rehypeTables,
  STATE_KEY,
} from './plugins/rehype';
import { remarkNdDirectives } from './plugins/remark-directives';
import { sanitizeSchema } from './schema';
import type { RenderContext, RenderResult } from './types';

export { frenchSpaces, isExternalHref, loadHighlighter, slugify } from './plugins/rehype';
export { sanitizeSchema } from './schema';
export { ND01_COLORS, nd01Theme } from './theme';
export type { MediaRef, RenderContext, RenderResult, TocEntry } from './types';

/** Liste les ids `media:<id>` d'un document sans le rendre. */
export function extractMediaIds(md: string): string[] {
  return [...new Set([...md.matchAll(/\(media:([a-z0-9]{15})\)/g)].map((m) => m[1] as string))];
}

export function readingTime(md: string): number {
  const words = md.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

/**
 * Ordre : Markdown → mdast (GFM, directives) → hast (le HTML brut est abandonné : pas de
 * `allowDangerousHtml`) → transformations maison → Shiki → sanitisation (dernière, schéma maison
 * qui n'autorise que ce que le pipeline émet ; les `style` Shiki sont filtrés par regex) → HTML.
 */
const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkDirective)
  .use(remarkNdDirectives)
  .use(remarkRehype, { footnoteLabel: 'Notes', footnoteBackLabel: 'Retour au texte' })
  .use(rehypeMedia)
  .use(rehypeFrenchTypography)
  .use(rehypeHeadings)
  .use(rehypeAutolinkHeadings, {
    behavior: 'append',
    properties: { className: ['md-anchor'], ariaHidden: 'true', tabIndex: -1 },
    content: { type: 'text', value: '#' },
    test: (node) => node.properties.id !== 'footnote-label',
  })
  .use(rehypeExternalLinks)
  .use(rehypeTables)
  .use(rehypeCode)
  .use(rehypeSanitize, sanitizeSchema)
  .use(rehypeStringify)
  .freeze();

export async function render(md: string, ctx: RenderContext = {}): Promise<RenderResult> {
  const st: PipelineState = { ctx, toc: [], mediaIds: [] };
  const file = await processor.process({ value: md, data: { [STATE_KEY]: st } });
  return { html: String(file), toc: st.toc, readingTime: readingTime(md), mediaIds: st.mediaIds };
}
