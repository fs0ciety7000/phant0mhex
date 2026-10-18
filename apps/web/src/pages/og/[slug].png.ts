// Image Open Graph brutaliste 1200×630 (satori → SVG → resvg → PNG).
// Polices : Archivo Black et JetBrains Mono (OFL) embarquées via @fontsource, lues une fois puis gardées en mémoire.
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { Resvg } from '@resvg/resvg-js';
import type { APIRoute } from 'astro';
import satori from 'satori';
import { createData } from '../../lib/data';
import { logId } from '../../lib/format';

const require = createRequire(import.meta.url);
type FontSet = { name: string; data: Buffer; weight: 400 | 700; style: 'normal' }[];
let fonts: Promise<FontSet> | undefined;

function loadFonts(): Promise<FontSet> {
  fonts ??= Promise.all([
    readFile(require.resolve('@fontsource/archivo-black/files/archivo-black-latin-400-normal.woff')),
    readFile(require.resolve('@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff')),
    readFile(require.resolve('@fontsource/jetbrains-mono/files/jetbrains-mono-latin-700-normal.woff')),
  ]).then(([macro, mono, monoBold]) => [
    { name: 'Archivo Black', data: macro, weight: 400, style: 'normal' },
    { name: 'JetBrains Mono', data: mono, weight: 400, style: 'normal' },
    { name: 'JetBrains Mono', data: monoBold, weight: 700, style: 'normal' },
  ]);
  return fonts;
}

const C = { bg: '#0b0b0b', fg: '#eaeaea', muted: '#8c8c8c', line: '#2a2a2a', accent: '#ff2a2a' };

type Node = { type: string; props: Record<string, unknown> & { style?: Record<string, unknown> } };
const h = (type: string, style: Record<string, unknown>, children?: unknown): Node => ({
  type,
  props: { style, children },
});

function barcode(): Node {
  const widths = [3, 1, 2, 1, 4, 1, 1, 3, 2, 1, 1, 2, 4, 1, 2, 3, 1, 1, 2, 1, 3, 2, 1, 4, 1, 2];
  return h(
    'div',
    { display: 'flex', height: 40, alignItems: 'stretch' },
    widths.map((w, i) =>
      h('div', { width: w * 2, marginRight: 3, background: i % 5 === 2 ? C.accent : C.fg }),
    ),
  );
}

function card(opts: { id: string; kicker: string; title: string }): Node {
  const len = opts.title.length;
  const size = len < 24 ? 104 : len < 44 ? 84 : len < 70 ? 64 : 52;
  return h(
    'div',
    {
      width: 1200,
      height: 630,
      display: 'flex',
      flexDirection: 'column',
      background: C.bg,
      color: C.fg,
      fontFamily: 'JetBrains Mono',
    },
    [
      h('div', {
        height: 14,
        display: 'flex',
        backgroundImage: `repeating-linear-gradient(-45deg, ${C.bg} 0 12px, ${C.accent} 12px 24px)`,
      }),
      h(
        'div',
        {
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          padding: '48px 64px 52px',
          borderTop: `1px solid ${C.line}`,
        },
        [
          h(
            'div',
            {
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: 22,
              letterSpacing: 2,
              paddingBottom: 20,
              borderBottom: `1px solid ${C.line}`,
            },
            [
              h(
                'div',
                { display: 'flex', alignItems: 'flex-start', fontFamily: 'Archivo Black', fontSize: 40 },
                [
                  'ND',
                  h(
                    'span',
                    { fontFamily: 'JetBrains Mono', fontSize: 16, color: C.accent, marginTop: 4 },
                    '®',
                  ),
                ],
              ),
              h('div', { display: 'flex', color: C.accent, fontWeight: 700 }, opts.id),
            ],
          ),
          h(
            'div',
            {
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              fontFamily: 'Archivo Black',
              fontSize: size,
              lineHeight: 0.92,
              letterSpacing: -size * 0.04,
              textTransform: 'uppercase',
            },
            opts.title,
          ),
          h(
            'div',
            {
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
              paddingTop: 20,
              borderTop: `1px solid ${C.line}`,
              fontSize: 20,
              letterSpacing: 2,
              color: C.muted,
            },
            [
              h('div', { display: 'flex', flexDirection: 'column' }, [
                h('span', { color: C.fg }, 'NICOLAS DESSENIUS™'),
                h('span', {}, `${opts.kicker} — DESSENIUS.BE`),
              ]),
              barcode(),
            ],
          ),
        ],
      ),
    ],
  );
}

export const GET: APIRoute = async ({ params, locals }) => {
  const slug = params.slug ?? '';
  let opts = { id: 'ND-01', kicker: 'LEAD DEV / GAME DESIGNER', title: 'Nicolas Dessenius' };
  if (slug !== 'site') {
    const db = createData(locals);
    const [found, index] = await Promise.all([db.post(slug), db.logIndex()]);
    if (found.state === 'missing') return new Response('Introuvable', { status: 404 });
    if (found.state === 'ok') {
      const no = index.find((e) => e.id === found.value.id)?.no;
      opts = { id: logId(no), kicker: 'JOURNAL', title: found.value.title };
    }
  }
  const svg = await satori(card(opts) as Parameters<typeof satori>[0], {
    width: 1200,
    height: 630,
    fonts: await loadFonts(),
  });
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
};
