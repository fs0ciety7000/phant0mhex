import type { HighlighterCore } from 'shiki/core';
import { createHighlighterCore } from 'shiki/core';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';
import { nd01Theme } from './theme';

/**
 * Langages chargés (bundle fin, imports dynamiques → découpés en chunks côté navigateur).
 * Les alias (`ts`, `js`, `sh`, `yml`, `md`, `cs`…) sont fournis par les grammaires elles-mêmes.
 */
const LANGS = [
  () => import('shiki/langs/typescript.mjs'),
  () => import('shiki/langs/tsx.mjs'),
  () => import('shiki/langs/javascript.mjs'),
  () => import('shiki/langs/json.mjs'),
  () => import('shiki/langs/bash.mjs'),
  () => import('shiki/langs/css.mjs'),
  () => import('shiki/langs/html.mjs'),
  () => import('shiki/langs/csharp.mjs'),
  () => import('shiki/langs/gdscript.mjs'),
  () => import('shiki/langs/go.mjs'),
  () => import('shiki/langs/rust.mjs'),
  () => import('shiki/langs/glsl.mjs'),
  () => import('shiki/langs/yaml.mjs'),
  () => import('shiki/langs/markdown.mjs'),
  () => import('shiki/langs/diff.mjs'),
];

let highlighter: Promise<HighlighterCore> | undefined;

/** Highlighter Shiki unique (promesse mémoïsée), moteur regex JavaScript : aucun WASM. */
export function getHighlighter(): Promise<HighlighterCore> {
  highlighter ??= createHighlighterCore({
    themes: [nd01Theme],
    langs: LANGS,
    engine: createJavaScriptRegexEngine({ forgiving: true }),
  }).catch((error: unknown) => {
    highlighter = undefined;
    throw error;
  });
  return highlighter;
}
