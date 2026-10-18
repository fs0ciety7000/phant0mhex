import type { Element, ElementContent, Root, RootContent } from 'hast';
import { toString as hastToString } from 'hast-util-to-string';
import { SKIP, visit } from 'unist-util-visit';
import type { MediaRef, RenderContext, TocEntry } from '../types';

/** État partagé entre les plugins d'un même rendu (porté par `file.data`). */
export interface PipelineState {
  ctx: RenderContext;
  toc: TocEntry[];
  mediaIds: string[];
}

interface FileLike {
  data: Record<string, unknown>;
}

export const STATE_KEY = 'nd';

function state(file: FileLike): PipelineState {
  const existing = file.data[STATE_KEY] as PipelineState | undefined;
  if (existing) return existing;
  const created: PipelineState = { ctx: {}, toc: [], mediaIds: [] };
  file.data[STATE_KEY] = created;
  return created;
}

const el = (
  tagName: string,
  properties: Element['properties'],
  children: ElementContent[] = [],
): Element => ({
  type: 'element',
  tagName,
  properties,
  children,
});
const txt = (value: string): ElementContent => ({ type: 'text', value });

const isWhitespace = (node: RootContent): boolean => node.type === 'text' && node.value.trim() === '';

/* -------------------------------------------------------------------------- */
/* Médias                                                                     */
/* -------------------------------------------------------------------------- */

export const MEDIA_ID = /^[a-z0-9]{15}$/;
const MEDIA_PREFIX = 'media:';
const MISSING_LABEL = '[ MÉDIA INTROUVABLE ]';
const SIZES = '(max-width: 760px) 100vw, 760px';

const isMediaImg = (node: RootContent): node is Element =>
  node.type === 'element' &&
  node.tagName === 'img' &&
  String(node.properties.src ?? '').startsWith(MEDIA_PREFIX);

function mediaImg(ref: MediaRef, alt: string): Element {
  const srcSet = ([480, 960, 1920] as const)
    .filter((w) => ref.thumbs[w])
    .map((w) => `${ref.thumbs[w]} ${w}w`)
    .join(', ');
  return el('img', {
    src: ref.thumbs[960] ?? ref.url,
    ...(srcSet ? { srcSet, sizes: SIZES } : {}),
    ...(ref.width > 0 && ref.height > 0 ? { width: ref.width, height: ref.height } : {}),
    alt: alt || ref.alt,
    loading: 'lazy',
    decoding: 'async',
  });
}

/** `media:<id>` → `<figure>` (bloc) ou `<img>` / `<span>` (en ligne). */
function resolveMediaNode(node: Element, st: PipelineState, block: boolean): Element {
  const id = String(node.properties.src).slice(MEDIA_PREFIX.length);
  const valid = MEDIA_ID.test(id);
  if (valid && !st.mediaIds.includes(id)) st.mediaIds.push(id);
  const ref = valid ? st.ctx.resolveMedia?.(id) : null;
  const alt = String(node.properties.alt ?? '');
  const title = String(node.properties.title ?? '');

  if (!ref) {
    return el(block ? 'figure' : 'span', { className: ['md-figure', 'md-figure--missing'] }, [
      txt(MISSING_LABEL),
    ]);
  }
  const img = mediaImg(ref, alt);
  if (!block) return img;
  const caption = ref.caption || title;
  return el('figure', { className: ['md-figure'] }, [
    img,
    ...(caption ? [el('figcaption', {}, [txt(caption)])] : []),
  ]);
}

export function rehypeMedia() {
  return (tree: Root, file: FileLike) => {
    const st = state(file);

    // 1. Paragraphe ne contenant que des images media: → figures, sans <p> autour.
    visit(tree, 'element', (node, index, parent) => {
      if (node.tagName !== 'p' || parent === undefined || index === undefined) return;
      const content = node.children.filter((c) => !isWhitespace(c));
      if (content.length === 0 || !content.every(isMediaImg)) return;
      const figures = content.map((img) => resolveMediaNode(img as Element, st, true));
      parent.children.splice(index, 1, ...figures);
      return [SKIP, index + figures.length];
    });

    // 2. Images restantes : media: en ligne, images externes en lazy.
    visit(tree, 'element', (node, index, parent) => {
      if (node.tagName !== 'img' || parent === undefined || index === undefined) return;
      if (String(node.properties.src ?? '').startsWith(MEDIA_PREFIX)) {
        parent.children[index] = resolveMediaNode(node, st, false);
        return SKIP;
      }
      node.properties.loading = 'lazy';
      node.properties.decoding = 'async';
    });
  };
}

/* -------------------------------------------------------------------------- */
/* Typographie française                                                      */
/* -------------------------------------------------------------------------- */

const NNBSP = ' ';
const SKIP_TAGS = new Set(['code', 'pre', 'kbd', 'samp', 'script', 'style']);

/** Espace fine insécable avant `: ; ! ? »` et après `«`. */
export function frenchSpaces(value: string): string {
  return value.replace(/[  ]+([:;!?»])/g, `${NNBSP}$1`).replace(/«[  ]+/g, `«${NNBSP}`);
}

export function rehypeFrenchTypography() {
  const walk = (node: Root | Element) => {
    for (const child of node.children) {
      if (child.type === 'text') child.value = frenchSpaces(child.value);
      else if (child.type === 'element' && !SKIP_TAGS.has(child.tagName)) walk(child);
    }
  };
  return (tree: Root) => walk(tree);
}

/* -------------------------------------------------------------------------- */
/* Titres : slugs lisibles + table des matières                               */
/* -------------------------------------------------------------------------- */

const HEADING = /^h[1-6]$/;

/** Slug lisible : accents retirés (« Écrire une boucle » → `ecrire-une-boucle`). */
export function slugify(value: string): string {
  return (
    value
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .toLowerCase()
      .replace(/œ/g, 'oe')
      .replace(/æ/g, 'ae')
      .replace(/ß/g, 'ss')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'section'
  );
}

export function rehypeHeadings() {
  return (tree: Root, file: FileLike) => {
    const st = state(file);
    const seen = new Map<string, number>();
    visit(tree, 'element', (node) => {
      if (!HEADING.test(node.tagName) || node.properties.id) return;
      const text = hastToString(node)
        .replace(/[ \t\r\n]+/g, ' ')
        .trim();
      const base = slugify(text);
      const count = seen.get(base) ?? 0;
      seen.set(base, count + 1);
      const id = count === 0 ? base : `${base}-${count}`;
      node.properties.id = id;
      const depth = Number(node.tagName.slice(1));
      if (depth === 2 || depth === 3) st.toc.push({ depth, text, id });
    });
  };
}

/* -------------------------------------------------------------------------- */
/* Liens externes, tableaux                                                   */
/* -------------------------------------------------------------------------- */

const INTERNAL_HOSTS = new Set(['dessenius.be', 'www.dessenius.be']);

export function isExternalHref(href: string): boolean {
  const match = /^(?:https?:)?\/\/([^/?#:]+)/i.exec(href);
  return match !== null && !INTERNAL_HOSTS.has((match[1] ?? '').toLowerCase());
}

export function rehypeExternalLinks() {
  return (tree: Root) => {
    visit(tree, 'element', (node) => {
      if (node.tagName !== 'a' || !isExternalHref(String(node.properties.href ?? ''))) return;
      node.properties.target = '_blank';
      node.properties.rel = ['noopener', 'noreferrer'];
    });
  };
}

export function rehypeTables() {
  return (tree: Root) => {
    visit(tree, 'element', (node, index, parent) => {
      if (node.tagName !== 'table' || parent === undefined || index === undefined) return;
      // Conteneur défilant : focusable et nommé pour le clavier et les lecteurs d'écran.
      parent.children[index] = el(
        'div',
        { className: ['md-table'], tabIndex: 0, role: 'region', ariaLabel: 'Tableau' },
        [node],
      );
      return [SKIP, index + 1];
    });
  };
}

/* -------------------------------------------------------------------------- */
/* Code : Shiki (thème nd-01)                                                 */
/* -------------------------------------------------------------------------- */

const TITLE = /(?:^|\s)title=(?:"([^"]*)"|'([^']*)'|(\S+))/;

export function parseTitle(meta: string | undefined): string | undefined {
  const m = meta ? TITLE.exec(meta) : null;
  return m ? (m[1] ?? m[2] ?? m[3]) : undefined;
}

function langOf(code: Element): string | undefined {
  const classes = Array.isArray(code.properties.className) ? code.properties.className : [];
  for (const c of classes) {
    if (typeof c === 'string' && c.startsWith('language-')) return c.slice('language-'.length).toLowerCase();
  }
  return undefined;
}

function codeFigure(label: string, pre: Element): Element {
  return el('figure', { className: ['md-code'] }, [
    el('figcaption', {}, [
      el('span', {}, [txt(label)]),
      el('button', { type: 'button', className: ['md-code__copy'], dataCopy: true }, [txt('[ COPIER ]')]),
    ]),
    pre,
  ]);
}

/** Précharge le highlighter Shiki (import différé + init mémoïsée). */
export async function loadHighlighter() {
  const { getHighlighter } = await import('../highlighter');
  return getHighlighter();
}

interface CodeBlock {
  pre: Element;
  code: Element;
  parent: Root | Element;
  index: number;
}

export function rehypeCode() {
  return async (tree: Root) => {
    const blocks: CodeBlock[] = [];
    visit(tree, 'element', (node, index, parent) => {
      if (node.tagName !== 'pre' || parent === undefined || index === undefined) return;
      const code = node.children.find((c): c is Element => c.type === 'element' && c.tagName === 'code');
      if (code) blocks.push({ pre: node, code, parent, index });
      return SKIP;
    });
    if (blocks.length === 0) return;

    const needsShiki = blocks.some((b) => langOf(b.code) !== undefined);
    // Shiki (cœur + grammaires) est chargé à la demande : chunk séparé côté navigateur.
    const highlighter = needsShiki ? await loadHighlighter() : undefined;
    const loaded = new Set(highlighter?.getLoadedLanguages() ?? []);

    for (const { pre, code, parent, index } of blocks) {
      const lang = langOf(code);
      const title = parseTitle((code.data as { meta?: string } | undefined)?.meta);
      const label = title ?? (lang ? `Code ${lang}` : 'Bloc de code');
      // bloc défilant : atteignable au clavier et nommé
      Object.assign(pre.properties, { tabIndex: 0, role: 'region', ariaLabel: label });
      let output: Element = pre;

      if (highlighter && lang && loaded.has(lang)) {
        const source = hastToString(code).replace(/\n$/, '');
        const root = highlighter.codeToHast(source, { lang, theme: 'nd-01' });
        const highlighted = root.children.find(
          (c): c is Element => c.type === 'element' && c.tagName === 'pre',
        );
        if (highlighted) {
          // On ne garde que la couleur de fond/texte : classes et attributs Shiki inutiles ici.
          highlighted.properties = {
            style: highlighted.properties.style,
            tabIndex: 0,
            role: 'region',
            ariaLabel: label,
          };
          output = codeFigure(title ?? lang, highlighted);
        }
      } else if (title) {
        output = codeFigure(title, pre);
      }
      parent.children[index] = output;
    }
  };
}
