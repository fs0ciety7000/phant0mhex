import '@nd/markdown/markdown.css';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { Annotation, EditorState, Prec } from '@codemirror/state';
import {
  drawSelection,
  dropCursor,
  EditorView,
  highlightActiveLine,
  keymap,
  placeholder,
} from '@codemirror/view';
import type { Media } from '@nd/pb-types';
import { type ReactNode, useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  getCachedMedia,
  loadMissingMedia,
  mediaSnippet,
  mediaVersion,
  subscribeMedia,
  toMediaRef,
  uploadMedia,
} from '../lib/media';
import { errorMessage, usePb } from '../lib/pb';
import { countWords, store } from '../lib/util';
import { useDialogs } from '../ui/Dialogs';
import { useToast } from '../ui/Toasts';
import * as cmd from './commands';
import { MediaPicker } from './MediaPicker';
import { nd01Highlight, nd01Theme } from './theme';
import { useAskMeta } from './useAskMeta';

export type Mode = 'write' | 'split' | 'preview';
const MODES: [Mode, string][] = [
  ['write', 'Écrire'],
  ['split', 'Split'],
  ['preview', 'Aperçu'],
];

type MdModule = typeof import('@nd/markdown');
let mdPromise: Promise<MdModule> | null = null;
/** Le pipeline Markdown (unified + Shiki) est chargé à part, à la première utilisation. */
export function useMarkdownModule(): MdModule | null {
  const [mod, setMod] = useState<MdModule | null>(null);
  useEffect(() => {
    let alive = true;
    mdPromise ??= import('@nd/markdown');
    mdPromise.then((m) => alive && setMod(m)).catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return mod;
}

const External = Annotation.define<boolean>();
const UploadAnn = Annotation.define<number>();

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSave?: () => void;
  /** Nom accessible de la zone d'édition. */
  label: string;
  /** Relation `media.post` des images envoyées depuis ce billet. */
  postId?: string;
  /** Barre d'infos en plus du compteur de mots. */
  extra?: ReactNode;
  onStats?: (s: { words: number; minutes: number | null }) => void;
}

interface Tool {
  glyph: ReactNode;
  label: string;
  run: (v: EditorView) => unknown;
}

export function MarkdownEditor({ value, onChange, onSave, label, postId, extra, onStats }: Props) {
  const pb = usePb();
  const toast = useToast();
  const dialogs = useDialogs();
  const askMeta = useAskMeta();
  const md = useMarkdownModule();
  const host = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [mode, setModeState] = useState<Mode>(() => store.get<Mode>('nd-admin:mode') ?? 'split');
  const modeRef = useRef(mode);
  const lastEditMode = useRef<Mode>(mode === 'preview' ? 'split' : mode);
  const [html, setHtml] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const uploads = useRef(new Map<number, { from: number; to: number; next: string }>());
  const upSeq = useRef(0);
  const emitted = useRef<string[]>([]);
  const mediaVer = useSyncExternalStore(subscribeMedia, mediaVersion, mediaVersion);

  const setMode = useCallback((m: Mode) => {
    if (m !== 'preview') lastEditMode.current = m;
    modeRef.current = m;
    setModeState(m);
    store.set('nd-admin:mode', m);
    requestAnimationFrame(() => viewRef.current?.requestMeasure());
  }, []);

  // ---------- upload d'images (glisser, coller, bouton) ----------
  const replaceUpload = useCallback((id: number, text: string) => {
    const view = viewRef.current;
    const r = uploads.current.get(id);
    if (!view || !r) return;
    r.next = text;
    view.dispatch({ changes: { from: r.from, to: r.to, insert: text }, annotations: UploadAnn.of(id) });
  }, []);

  const handleFiles = useCallback(
    async (files: File[], pos?: number) => {
      let at = pos;
      for (const file of files) {
        const meta = await askMeta(file);
        const view = viewRef.current;
        if (!meta || !view) continue;
        const { state } = view;
        const p = Math.min(at ?? state.selection.main.head, state.doc.length);
        const line = state.doc.lineAt(p);
        const pre = p > line.from ? '\n\n' : '';
        const post = p < line.to ? '\n\n' : '';
        const id = ++upSeq.current;
        const text = '![Envoi… 0%]()';
        uploads.current.set(id, { from: p + pre.length, to: p + pre.length, next: text });
        view.dispatch({
          changes: { from: p, insert: pre + text + post },
          annotations: UploadAnn.of(id),
          selection: { anchor: p + pre.length + text.length + post.length },
        });
        at = undefined;
        try {
          const rec = await uploadMedia(pb, file, { ...meta, post: postId }, (pct) =>
            replaceUpload(id, `![Envoi… ${pct}%]()`),
          );
          replaceUpload(id, mediaSnippet(rec));
          toast(`Image « ${meta.alt} » envoyée.`);
        } catch (e) {
          replaceUpload(id, '');
          toast(`Envoi impossible : ${errorMessage(e)}`, 'error');
        } finally {
          uploads.current.delete(id);
        }
      }
    },
    [askMeta, pb, postId, replaceUpload, toast],
  );

  const askLink = useCallback(async () => {
    const url = await dialogs.prompt('Insérer un lien', 'URL', 'https://', 'url');
    const v = viewRef.current;
    if (url && v) cmd.insertLink(v, url);
  }, [dialogs]);

  const askYoutube = useCallback(async () => {
    const raw = await dialogs.prompt('Vidéo YouTube', 'Identifiant ou URL de la vidéo');
    const v = viewRef.current;
    if (!raw || !v) return;
    const id = cmd.youtubeId(raw);
    if (id) cmd.youtube(v, id);
    else toast('Identifiant YouTube non reconnu.', 'error');
  }, [dialogs, toast]);

  // Callbacks lus par les extensions CodeMirror (créées une seule fois).
  const cb = useRef({ onChange, onSave, handleFiles, askLink });
  cb.current = { onChange, onSave, handleFiles, askLink };

  // ---------- création de la vue CodeMirror ----------
  // biome-ignore lint/correctness/useExhaustiveDependencies: la vue est créée une fois ; `value` est synchronisée plus bas
  useEffect(() => {
    if (!host.current) return;
    // Tous les fichiers déposés passent par la validation (refus explicite des non-images).
    const imageFiles = (list: FileList | null | undefined) => [...(list ?? [])];
    const view = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          history(),
          drawSelection(),
          dropCursor(),
          highlightActiveLine(),
          EditorView.lineWrapping,
          markdown({ base: markdownLanguage }),
          nd01Theme,
          nd01Highlight,
          placeholder('Écrire en Markdown… (glisser ou coller une image pour l’envoyer)'),
          EditorView.contentAttributes.of({ 'aria-label': label, lang: 'fr', spellcheck: 'true' }),
          Prec.highest(
            keymap.of([
              { key: 'Mod-b', run: (v) => cmd.wrap(v, '**') },
              { key: 'Mod-i', run: (v) => cmd.wrap(v, '_') },
              {
                key: 'Mod-k',
                run: () => {
                  cb.current.askLink();
                  return true;
                },
              },
            ]),
          ),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          EditorView.updateListener.of((u) => {
            if (!u.docChanged) return;
            for (const tr of u.transactions) {
              if (!tr.docChanged) continue;
              const own = tr.annotation(UploadAnn);
              for (const [id, r] of uploads.current) {
                if (id === own) {
                  r.to = r.from + r.next.length;
                } else {
                  r.from = tr.changes.mapPos(r.from, 1);
                  r.to = Math.max(r.from, tr.changes.mapPos(r.to, -1));
                }
              }
            }
            if (u.transactions.some((tr) => tr.annotation(External))) return;
            const doc = u.state.doc.toString();
            emitted.current.push(doc);
            if (emitted.current.length > 32) emitted.current.shift();
            cb.current.onChange(doc);
          }),
          EditorView.domEventHandlers({
            dragover(e) {
              if (e.dataTransfer?.types.includes('Files')) {
                e.preventDefault();
                return true;
              }
              return false;
            },
            drop(e, v) {
              const files = imageFiles(e.dataTransfer?.files);
              if (!files.length) return false;
              e.preventDefault();
              setDragging(false);
              const pos = v.posAtCoords({ x: e.clientX, y: e.clientY }) ?? v.state.selection.main.head;
              cb.current.handleFiles(files, pos);
              return true;
            },
            paste(e, v) {
              const dt = e.clipboardData;
              const files = [...(dt?.files ?? [])].filter((f) => f.type.startsWith('image/'));
              // Tableurs/traitements de texte collent aussi une image de rendu : on garde le texte.
              if (!files.length || dt?.getData('text/plain')) return false;
              e.preventDefault();
              cb.current.handleFiles(files, v.state.selection.main.head);
              return true;
            },
          }),
        ],
      }),
    });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  // Valeur modifiée de l'extérieur (rechargement serveur, brouillon restauré). Une valeur déjà
  // émise par l'éditeur n'est qu'un rendu React en retard sur la vue : on l'ignore.
  useEffect(() => {
    const v = viewRef.current;
    if (!v || emitted.current.includes(value)) return;
    const cur = v.state.doc.toString();
    if (cur !== value)
      v.dispatch({ changes: { from: 0, to: cur.length, insert: value }, annotations: External.of(true) });
  }, [value]);

  // ---------- raccourcis globaux (Mod-S, Mod-Shift-P) ----------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === 's' && !e.shiftKey) {
        e.preventDefault();
        cb.current.onSave?.();
      } else if (k === 'p' && e.shiftKey) {
        e.preventDefault();
        setMode(modeRef.current === 'preview' ? lastEditMode.current : 'preview');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setMode]);

  // ---------- aperçu (même pipeline que le site), débouncé 150 ms ----------
  // biome-ignore lint/correctness/useExhaustiveDependencies: mediaVer force le re-rendu quand un média arrive dans le cache
  useEffect(() => {
    if (mode === 'write' || !md) return;
    let alive = true;
    const t = window.setTimeout(async () => {
      try {
        await loadMissingMedia(pb, md.extractMediaIds(value)).catch(() => {});
        const res = await md.render(value, {
          resolveMedia: (id) => {
            const m = getCachedMedia(id);
            return m ? toMediaRef(pb, m) : null;
          },
        });
        if (alive) setHtml(res.html);
      } catch (e) {
        if (alive)
          setHtml(`<p class="adm-error">⚠ Rendu impossible : ${String(e).replace(/</g, '&lt;')}</p>`);
      }
    }, 150);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, [value, md, mode, pb, mediaVer]);

  // ---------- défilement synchronisé (approximation par ratio) ----------
  useEffect(() => {
    if (mode !== 'split') return;
    const a = viewRef.current?.scrollDOM;
    const b = previewRef.current;
    if (!a || !b) return;
    let lock: Element | null = null;
    let timer = 0;
    const follow = (src: HTMLElement, dst: HTMLElement) => () => {
      if (lock && lock !== src) return;
      lock = src;
      const max = src.scrollHeight - src.clientHeight;
      const ratio = max > 0 ? src.scrollTop / max : 0;
      dst.scrollTop = ratio * (dst.scrollHeight - dst.clientHeight);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        lock = null;
      }, 80);
    };
    const fa = follow(a, b);
    const fb = follow(b, a);
    a.addEventListener('scroll', fa, { passive: true });
    b.addEventListener('scroll', fb, { passive: true });
    return () => {
      a.removeEventListener('scroll', fa);
      b.removeEventListener('scroll', fb);
      window.clearTimeout(timer);
    };
  }, [mode]);

  const words = countWords(value);
  const minutes = md ? md.readingTime(value) : null;
  useEffect(() => onStats?.({ words, minutes }), [words, minutes, onStats]);

  const insertMedia = (m: Media) => {
    setPickerOpen(false);
    const v = viewRef.current;
    if (v) requestAnimationFrame(() => cmd.insertBlock(v, mediaSnippet(m)));
  };

  const tools: (Tool | 'sep')[] = [
    { glyph: 'H1', label: 'Titre de niveau 1', run: cmd.heading(1) },
    { glyph: 'H2', label: 'Titre de niveau 2', run: cmd.heading(2) },
    { glyph: 'H3', label: 'Titre de niveau 3', run: cmd.heading(3) },
    'sep',
    { glyph: <b>B</b>, label: 'Gras (Ctrl+B)', run: (v) => cmd.wrap(v, '**') },
    { glyph: <i>I</i>, label: 'Italique (Ctrl+I)', run: (v) => cmd.wrap(v, '_') },
    { glyph: <s>S</s>, label: 'Barré', run: (v) => cmd.wrap(v, '~~') },
    { glyph: '</>', label: 'Code en ligne', run: (v) => cmd.wrap(v, '`', '`', 'code') },
    { glyph: '{ }', label: 'Bloc de code', run: cmd.codeBlock },
    'sep',
    { glyph: '❝', label: 'Citation', run: cmd.quote },
    { glyph: '•', label: 'Liste à puces', run: cmd.bullet },
    { glyph: '1.', label: 'Liste numérotée', run: cmd.ordered },
    'sep',
    { glyph: 'LINK', label: 'Lien (Ctrl+K)', run: () => askLink() },
    { glyph: 'IMG', label: 'Image (médiathèque ou envoi)', run: () => setPickerOpen(true) },
    { glyph: 'TBL', label: 'Tableau', run: cmd.table },
    { glyph: '!', label: 'Encart :::note', run: (v) => cmd.callout(v, 'note') },
    { glyph: '—', label: 'Séparateur horizontal', run: cmd.hr },
    { glyph: 'YT', label: 'Vidéo YouTube', run: () => askYoutube() },
  ];

  return (
    <section className={`adm-ed is-${mode}`} aria-label="Éditeur Markdown">
      <div className="adm-ed-bar">
        <div role="toolbar" aria-label="Mise en forme Markdown" className="adm-tools">
          {tools.map((t, i) =>
            t === 'sep' ? (
              // biome-ignore lint/suspicious/noArrayIndexKey: séparateurs statiques
              <span key={`s${i}`} className="adm-tools-sep" aria-hidden="true" />
            ) : (
              <button
                key={t.label}
                type="button"
                className="adm-tool"
                aria-label={t.label}
                title={t.label}
                disabled={mode === 'preview'}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => viewRef.current && t.run(viewRef.current)}
              >
                {t.glyph}
              </button>
            ),
          )}
        </div>
        <fieldset className="adm-modes">
          <legend className="adm-sr">Mode d'affichage (Ctrl+Maj+P : aperçu)</legend>
          {MODES.map(([m, l]) => (
            <button
              key={m}
              type="button"
              className="adm-mode"
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
            >
              {l}
            </button>
          ))}
        </fieldset>
      </div>
      <div className="adm-ed-panes">
        {/* biome-ignore lint/a11y/noStaticElementInteractions: retour visuel du glisser-déposer ; équivalent clavier = bouton IMG */}
        <div
          className={`adm-ed-src${dragging ? ' is-drag' : ''}`}
          onDragEnter={(e) => e.dataTransfer.types.includes('Files') && setDragging(true)}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
          }}
          onDrop={() => setDragging(false)}
        >
          <div className="adm-ed-head adm-micro adm-muted">
            Source — Markdown · {words} mots · {minutes ?? '—'} min
          </div>
          <div className="adm-cm" ref={host} />
          <div className="adm-ed-drop adm-micro adm-muted">
            Glisser-déposer ou coller une image → envoi PocketBase → <code>![alt](media:id)</code> inséré · ≤
            15 Mo
          </div>
        </div>
        <div className="adm-ed-prev">
          <div className="adm-ed-head adm-micro adm-muted">Aperçu — même moteur de rendu que le site</div>
          <div
            ref={previewRef}
            className="adm-preview md-prose"
            // Le HTML vient de @nd/markdown (sanitisé par le pipeline, identique au site).
            // biome-ignore lint/security/noDangerouslySetInnerHtml: sortie du pipeline Markdown partagé
            dangerouslySetInnerHTML={{ __html: md ? html : '<p>Chargement du moteur de rendu…</p>' }}
          />
        </div>
      </div>
      {extra && <div className="adm-ed-extra">{extra}</div>}
      <MediaPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={insertMedia}
        onFiles={(files) => {
          setPickerOpen(false);
          handleFiles(files);
        }}
      />
    </section>
  );
}
