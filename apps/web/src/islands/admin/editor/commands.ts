// Commandes Markdown de la toolbar : enveloppent ou préfixent la sélection.
import { EditorSelection } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';

function done(view: EditorView): boolean {
  view.focus();
  return true;
}

/** Entoure chaque sélection (ou un texte d'exemple sélectionné) ; bascule si déjà entourée. */
export function wrap(view: EditorView, before: string, after = before, sample = 'texte'): boolean {
  const { state } = view;
  const spec = state.changeByRange((r) => {
    const outerFrom = r.from - before.length;
    const outerTo = r.to + after.length;
    if (
      !r.empty &&
      outerFrom >= 0 &&
      state.sliceDoc(outerFrom, r.from) === before &&
      state.sliceDoc(r.to, outerTo) === after
    ) {
      return {
        changes: [
          { from: outerFrom, to: r.from, insert: '' },
          { from: r.to, to: outerTo, insert: '' },
        ],
        range: EditorSelection.range(outerFrom, r.to - before.length),
      };
    }
    const inner = r.empty ? sample : state.sliceDoc(r.from, r.to);
    return {
      changes: { from: r.from, to: r.to, insert: before + inner + after },
      range: EditorSelection.range(r.from + before.length, r.from + before.length + inner.length),
    };
  });
  view.dispatch(state.update(spec, { scrollIntoView: true, userEvent: 'input.format' }));
  return done(view);
}

/** Préfixe les lignes sélectionnées ; retire le préfixe si toutes l'ont déjà. */
export function toggleLines(view: EditorView, strip: RegExp, make: (i: number) => string): boolean {
  const { state } = view;
  const nums = new Set<number>();
  for (const r of state.selection.ranges) {
    const a = state.doc.lineAt(r.from).number;
    const b = state.doc.lineAt(r.to).number;
    for (let n = a; n <= b; n++) nums.add(n);
  }
  const lines = [...nums].sort((x, y) => x - y).map((n) => state.doc.line(n));
  const all = lines.every((l, i) => l.text.startsWith(make(i)));
  const changes = lines.map((l, i) => {
    const m = strip.exec(l.text);
    const cut = m ? m[0].length : 0;
    return { from: l.from, to: l.from + cut, insert: all ? '' : make(i) };
  });
  view.dispatch({ changes, scrollIntoView: true, userEvent: 'input.format' });
  return done(view);
}

export const heading = (level: number) => (v: EditorView) =>
  toggleLines(v, /^#{1,6}\s+/, () => `${'#'.repeat(level)} `);
export const quote = (v: EditorView) => toggleLines(v, /^>\s?/, () => '> ');
export const bullet = (v: EditorView) => toggleLines(v, /^([-*+]|\d+\.)\s+/, () => '- ');
export const ordered = (v: EditorView) => toggleLines(v, /^([-*+]|\d+\.)\s+/, (i) => `${i + 1}. `);

/**
 * Insère un bloc sur ses propres lignes (avec ligne vide autour).
 * `sel` = [début, fin] relatifs au texte inséré à sélectionner ensuite.
 */
export function insertBlock(view: EditorView, text: string, sel?: [number, number], at?: number): boolean {
  const { state } = view;
  const r = state.selection.main;
  const from = at ?? r.from;
  const to = at ?? r.to;
  const lineA = state.doc.lineAt(from);
  const lineB = state.doc.lineAt(to);
  let pre = '';
  if (from > lineA.from) pre = '\n\n';
  else if (lineA.number > 1 && state.doc.line(lineA.number - 1).text.trim() !== '') pre = '\n';
  let post = '';
  if (to < lineB.to) post = '\n\n';
  else if (lineB.number < state.doc.lines && state.doc.line(lineB.number + 1).text.trim() !== '') post = '\n';
  else if (lineB.number === state.doc.lines) post = '\n';
  const insert = pre + text + post;
  const base = from + pre.length;
  const selection = sel
    ? EditorSelection.range(base + sel[0], base + sel[1])
    : EditorSelection.cursor(base + text.length);
  view.dispatch({
    changes: { from, to, insert },
    selection,
    scrollIntoView: true,
    userEvent: 'input.format',
  });
  return done(view);
}

export function codeBlock(view: EditorView): boolean {
  const r = view.state.selection.main;
  const inner = r.empty ? 'code' : view.state.sliceDoc(r.from, r.to);
  return insertBlock(view, `\`\`\`ts\n${inner}\n\`\`\``, [6, 6 + inner.length]);
}

export function callout(view: EditorView, kind: 'note' | 'warning' = 'note'): boolean {
  const r = view.state.selection.main;
  const inner = r.empty ? 'Texte de l’encart.' : view.state.sliceDoc(r.from, r.to);
  const open = `:::${kind}\n`;
  return insertBlock(view, `${open}${inner}\n:::`, [open.length, open.length + inner.length]);
}

export function table(view: EditorView): boolean {
  const t = '| Colonne | Colonne |\n| --- | --- |\n| Valeur | Valeur |';
  return insertBlock(view, t, [2, 9]);
}

export function hr(view: EditorView): boolean {
  return insertBlock(view, '---');
}

export function insertLink(view: EditorView, url: string): boolean {
  const { state } = view;
  const r = state.selection.main;
  const text = r.empty ? 'texte du lien' : state.sliceDoc(r.from, r.to);
  const insert = `[${text}](${url})`;
  view.dispatch({
    changes: { from: r.from, to: r.to, insert },
    selection: EditorSelection.range(r.from + 1, r.from + 1 + text.length),
    scrollIntoView: true,
    userEvent: 'input.format',
  });
  return done(view);
}

/** Accepte un id YouTube ou une URL (watch?v=, youtu.be/, /embed/, /shorts/). */
export function youtubeId(input: string): string | null {
  const s = input.trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  const m = /(?:v=|youtu\.be\/|\/embed\/|\/shorts\/)([\w-]{11})/.exec(s);
  return m ? (m[1] as string) : null;
}

export function youtube(view: EditorView, id: string): boolean {
  return insertBlock(view, `::youtube{id=${id}}`);
}
