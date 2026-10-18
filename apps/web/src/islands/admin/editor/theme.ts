import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { EditorView } from '@codemirror/view';
import { tags as t } from '@lezer/highlight';
import { colors } from '@nd/tokens';

/** Thème CodeMirror ND-01 (Tactical Telemetry, sombre uniquement). */
export const nd01Theme = EditorView.theme(
  {
    '&': {
      color: colors.fg,
      backgroundColor: colors.bg,
      fontSize: '13px',
      height: '100%',
    },
    '&.cm-focused': { outline: 'none' },
    '.cm-scroller': {
      fontFamily: 'var(--f-mono)',
      lineHeight: '1.7',
      letterSpacing: '0.01em',
    },
    '.cm-content': { padding: '16px 0', caretColor: colors.accent, maxWidth: '86ch' },
    '.cm-line': { padding: '0 16px' },
    '.cm-cursor, .cm-dropCursor': { borderLeft: `2px solid ${colors.accent}` },
    '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, ::selection':
      { backgroundColor: '#3a1414 !important' },
    '.cm-activeLine': { backgroundColor: '#111111' },
    '.cm-placeholder': { color: colors.muted },
    '.cm-gutters': { display: 'none' },
  },
  { dark: true },
);

const style = HighlightStyle.define([
  {
    tag: [t.heading1, t.heading2, t.heading3, t.heading4, t.heading5, t.heading6],
    color: colors.fg,
    fontWeight: '700',
  },
  { tag: t.heading1, textDecoration: 'underline', textDecorationColor: colors.accent },
  { tag: t.strong, fontWeight: '700', color: colors.fg },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.strikethrough, textDecoration: 'line-through' },
  { tag: [t.link, t.url], color: colors.accent },
  { tag: t.monospace, color: '#d6d6d6', backgroundColor: colors.surface },
  { tag: t.quote, color: colors.muted, fontStyle: 'italic' },
  { tag: [t.processingInstruction, t.meta, t.contentSeparator, t.labelName], color: colors.muted },
  { tag: t.list, color: colors.fg },
  { tag: [t.keyword, t.atom, t.bool], color: colors.accent },
  { tag: [t.string, t.number], color: '#d6d6d6' },
  { tag: t.comment, color: colors.muted, fontStyle: 'italic' },
]);

export const nd01Highlight = syntaxHighlighting(style);
