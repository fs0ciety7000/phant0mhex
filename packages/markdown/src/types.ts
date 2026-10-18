// Types du contrat du pipeline Markdown partagé (site + aperçu admin).

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
