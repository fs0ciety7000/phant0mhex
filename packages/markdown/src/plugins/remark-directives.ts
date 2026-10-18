import type { Paragraph, PhrasingContent, Root, RootContent, Text } from 'mdast';
import type { ContainerDirective, LeafDirective, TextDirective } from 'mdast-util-directive';
import { toString as mdToString } from 'mdast-util-to-string';
import { SKIP, visit } from 'unist-util-visit';

type Directive = ContainerDirective | LeafDirective | TextDirective;

const CALLOUTS: Record<string, string> = { note: 'NOTE', warning: 'ATTENTION' };
const YOUTUBE_ID = /^[\w-]{11}$/;

const text = (value: string): Text => ({ type: 'text', value });

function isDirective(node: { type: string }): node is Directive {
  return node.type === 'containerDirective' || node.type === 'leafDirective' || node.type === 'textDirective';
}

function serializeAttributes(attributes: Directive['attributes']): string {
  const entries = Object.entries(attributes ?? {});
  if (entries.length === 0) return '';
  return `{${entries.map(([k, v]) => (v ? `${k}="${v}"` : k)).join(' ')}}`;
}

/** Remet une directive inconnue sous forme de texte (`:nom[label]{attrs}`), sans perdre son contenu. */
function asText(node: Directive): RootContent[] {
  const attrs = serializeAttributes(node.attributes);
  if (node.type === 'textDirective') {
    const label: PhrasingContent[] = node.children.length ? [text('['), ...node.children, text(']')] : [];
    return [text(`:${node.name}`), ...label, ...(attrs ? [text(attrs)] : [])];
  }
  if (node.type === 'leafDirective') {
    const label: PhrasingContent[] = node.children.length ? [text('['), ...node.children, text(']')] : [];
    const paragraph: Paragraph = {
      type: 'paragraph',
      children: [text(`::${node.name}`), ...label, ...(attrs ? [text(attrs)] : [])],
    };
    return [paragraph];
  }
  const [first, ...rest] = node.children;
  const hasLabel = first?.type === 'paragraph' && first.data?.directiveLabel === true;
  const head: Paragraph = {
    type: 'paragraph',
    children: [
      text(`:::${node.name}`),
      ...(hasLabel ? [text('['), ...(first as Paragraph).children, text(']')] : []),
      ...(attrs ? [text(attrs)] : []),
    ],
  };
  return [head, ...((hasLabel ? rest : node.children) as RootContent[])];
}

/**
 * Directives maison :
 * - `:::note` / `:::warning` → `<aside class="md-callout md-callout--…">` + étiquette ;
 * - `::youtube{id=…}` → façade « clic pour charger » (aucune iframe émise) ;
 * - toute autre directive → texte brut.
 */
export function remarkNdDirectives() {
  return (tree: Root) => {
    visit(tree, (node, index, parent) => {
      if (!isDirective(node) || parent === undefined || index === undefined) return;

      if (node.type === 'containerDirective' && node.name in CALLOUTS) {
        const [first, ...rest] = node.children;
        const hasLabel = first?.type === 'paragraph' && first.data?.directiveLabel === true;
        const label = hasLabel ? mdToString(first).trim() : '';
        const labelNode: Paragraph = {
          type: 'paragraph',
          data: { hProperties: { className: ['md-callout__label'] } },
          children: [text(label || (CALLOUTS[node.name] as string))],
        };
        node.children = [labelNode, ...(hasLabel ? rest : node.children)];
        node.data = {
          hName: 'aside',
          hProperties: { className: ['md-callout', `md-callout--${node.name}`] },
        };
        return;
      }

      const youtubeId = node.attributes?.id ?? '';
      if (node.type === 'leafDirective' && node.name === 'youtube' && YOUTUBE_ID.test(youtubeId)) {
        node.children = [];
        node.data = {
          hName: 'div',
          hProperties: { className: ['md-embed'], dataYoutube: youtubeId },
          hChildren: [
            {
              type: 'element',
              tagName: 'button',
              properties: { type: 'button' },
              children: [{ type: 'text', value: '[ LIRE LA VIDÉO ]' }],
            },
          ],
        };
        return SKIP;
      }

      // Directive inconnue : on la remplace par du texte et on revisite le contenu réinjecté.
      (parent.children as RootContent[]).splice(index, 1, ...asText(node));
      return index;
    });
  };
}
