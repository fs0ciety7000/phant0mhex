// Contrat du pipeline Markdown partagé (site + aperçu admin). Implémentation : skill markdown-pipeline.

export interface MediaRef {
  id: string;
  /** URL du fichier original */
  url: string;
  /** URL d'une miniature PocketBase par largeur (480, 960, 1920) */
  thumbs: Record<number, string>;
  alt: string;
  caption: string;
  width: number;
  height: number;
}

export interface RenderContext {
  /** Résout `media:<id>` ; renvoie null si inconnu (rendu d'un placeholder). */
  resolveMedia?: (id: string) => MediaRef | null | undefined;
}

export interface TocEntry {
  depth: number;
  text: string;
  id: string;
}

export interface RenderResult {
  html: string;
  toc: TocEntry[];
  readingTime: number;
  /** ids `media:<id>` rencontrés, pour précharger les médias côté serveur */
  mediaIds: string[];
}

/** Liste les ids `media:<id>` d'un document sans le rendre. */
export function extractMediaIds(md: string): string[] {
  return [...new Set([...md.matchAll(/\(media:([a-z0-9]{15})\)/g)].map((m) => m[1] as string))];
}

export function readingTime(md: string): number {
  const words = md.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

export async function render(md: string, _ctx: RenderContext = {}): Promise<RenderResult> {
  // Implémentation provisoire, remplacée par le pipeline unified.
  const esc = md.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return { html: `<pre>${esc}</pre>`, toc: [], readingTime: readingTime(md), mediaIds: extractMediaIds(md) };
}
