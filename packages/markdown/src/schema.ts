import type { Options as SanitizeSchema } from 'rehype-sanitize';
import { defaultSchema } from 'rehype-sanitize';

type Attributes = NonNullable<SanitizeSchema['attributes']>;
type Definition = Attributes[string][number];

/** Couleurs inline émises par Shiki (thème nd-01) et rien d'autre. */
const SHIKI_SPAN_STYLE = /^color:#[0-9a-fA-F]{6}(?:;font-style:italic)?;?$/;
const SHIKI_PRE_STYLE = /^background-color:#[0-9a-fA-F]{6};color:#[0-9a-fA-F]{6};?$/;

const base: Attributes = defaultSchema.attributes ?? {};

const nameOf = (d: Definition): string => (typeof d === 'string' ? d : d[0]);

/**
 * Ajoute des définitions à celles du schéma par défaut pour une balise. `hast-util-sanitize` ne lit que
 * la première définition d'une propriété : on fusionne donc les listes de valeurs (`className` surtout).
 */
function extend(tag: string, extra: Definition[]): Definition[] {
  const result: Definition[] = [...(base[tag] ?? [])];
  for (const def of extra) {
    const i = result.findIndex((d) => nameOf(d) === nameOf(def));
    const existing = result[i];
    if (existing === undefined) {
      result.push(def);
    } else if (typeof existing !== 'string' && typeof def !== 'string') {
      result[i] = [existing[0], ...existing.slice(1), ...def.slice(1)] as Definition;
    } else {
      result[i] = def;
    }
  }
  return result;
}

/**
 * Schéma de sanitisation : celui de GitHub (`defaultSchema`) + exactement ce qu'émet le pipeline.
 * La sanitisation tourne en DERNIER (après Shiki) : les `style` ne passent que sur `span`/`pre`
 * et uniquement sous la forme de couleurs hexadécimales.
 */
export const sanitizeSchema: SanitizeSchema = {
  ...defaultSchema,
  // Les ids des titres doivent correspondre à la TOC et aux URLs : pas de préfixe `user-content-`
  // (les notes GFM sont déjà préfixées par remark-rehype).
  clobber: [],
  clobberPrefix: '',
  tagNames: [...(defaultSchema.tagNames ?? []), 'aside', 'figure', 'figcaption', 'button'],
  attributes: {
    ...base,
    a: extend('a', [
      ['className', 'md-anchor'],
      ['target', '_blank'],
      ['rel', 'noopener', 'noreferrer'],
      ['ariaHidden', 'true'],
      ['tabIndex', -1],
    ]),
    aside: [['className', 'md-callout', 'md-callout--note', 'md-callout--warning']],
    p: extend('p', [['className', 'md-callout__label']]),
    div: extend('div', [
      ['className', 'md-embed', 'md-table'],
      ['dataYoutube', /^[\w-]{11}$/],
      ['tabIndex', 0],
      ['role', 'region'],
      'ariaLabel',
    ]),
    figure: [['className', 'md-figure', 'md-figure--missing', 'md-code']],
    figcaption: [],
    button: [['type', 'button'], ['className', 'md-code__copy'], 'dataCopy'],
    img: extend('img', [
      'srcSet',
      'sizes',
      'width',
      'height',
      ['loading', 'lazy'],
      ['decoding', 'async'],
      ['className', 'md-figure', 'md-figure--missing'],
    ]),
    span: extend('span', [
      ['className', 'md-figure', 'md-figure--missing'],
      ['style', SHIKI_SPAN_STYLE],
    ]),
    pre: extend('pre', [['style', SHIKI_PRE_STYLE], ['tabIndex', 0], ['role', 'region'], 'ariaLabel']),
  },
};
