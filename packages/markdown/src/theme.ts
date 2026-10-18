import type { ThemeRegistration } from 'shiki/core';

/** Couleurs du thème `nd-01` (ND-01 Tactical Telemetry) : niveaux de gris + un seul accent. */
export const ND01_COLORS = {
  bg: '#121212',
  fg: '#D6D6D6',
  strong: '#EAEAEA',
  muted: '#8C8C8C',
  accent: '#FF2A2A',
} as const;

const c = ND01_COLORS;

/** Thème Shiki maison : monochrome sur `#121212`, mots-clés en `#FF2A2A`, commentaires `#8C8C8C`. */
export const nd01Theme: ThemeRegistration = {
  name: 'nd-01',
  type: 'dark',
  bg: c.bg,
  fg: c.fg,
  colors: {
    'editor.background': c.bg,
    'editor.foreground': c.fg,
  },
  settings: [
    { settings: { foreground: c.fg, background: c.bg } },
    {
      scope: [
        'punctuation',
        'meta.brace',
        'keyword.operator',
        'markup.list',
        'meta.diff.header',
        'meta.diff.range',
      ],
      settings: { foreground: c.muted },
    },
    {
      scope: [
        'string',
        'constant.numeric',
        'constant.language',
        'constant.character',
        'markup.inserted',
        'markup.inline.raw',
        'entity.name.function',
        'support.function',
        'entity.name.type',
        'entity.name.class',
        'support.type',
        'support.class',
        'entity.other.attribute-name',
        'support.type.property-name',
        'meta.object-literal.key',
      ],
      settings: { foreground: c.strong },
    },
    {
      scope: [
        'keyword',
        'keyword.operator.new',
        'keyword.operator.expression',
        'storage',
        'storage.type',
        'storage.modifier',
        'variable.language',
        'constant.language.boolean',
        'markup.heading',
        'entity.name.tag',
        'markup.deleted',
      ],
      settings: { foreground: c.accent },
    },
    // Placés en dernier : priment sur les règles plus générales ci-dessus.
    { scope: ['keyword.operator', 'punctuation.definition.string'], settings: { foreground: c.muted } },
    { scope: ['keyword.operator.new', 'keyword.operator.expression'], settings: { foreground: c.accent } },
    {
      scope: ['comment', 'punctuation.definition.comment', 'string.comment'],
      settings: { foreground: c.muted },
    },
  ],
};
