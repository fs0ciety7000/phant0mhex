// Page de rendu du poster : même module que le site, rendu figé à POSTER_TIME.
// Expose window.__poster = { width, height, rgb (base64), stray } une fois le frame lu.
import { createHeroMonolith } from '../../../apps/web/src/islands/hero3d/HeroMonolith';
import { POSTER_DPR } from '../../../apps/web/src/islands/hero3d/poster';

declare global {
  interface Window {
    __poster?: { width: number; height: number; rgb: string; stray: number } | { error: string };
  }
}

const params = new URLSearchParams(location.search);
const w = Number(params.get('w') ?? 1280);
const h = Number(params.get('h') ?? 520);
const box = document.getElementById('box') as HTMLElement;
box.style.width = `${w}px`;
box.style.height = `${h}px`;

const PALETTE = [
  [0x0b, 0x0b, 0x0b],
  [0xea, 0xea, 0xea],
  [0xff, 0x2a, 0x2a],
];

try {
  createHeroMonolith({
    container: box,
    pixelRatio: POSTER_DPR,
    still: true,
    preserveDrawingBuffer: true,
    onFirstFrame: (canvas) => {
      const c2 = document.createElement('canvas');
      c2.width = canvas.width;
      c2.height = canvas.height;
      const ctx = c2.getContext('2d') as CanvasRenderingContext2D;
      ctx.drawImage(canvas, 0, 0);
      const data = ctx.getImageData(0, 0, c2.width, c2.height).data;
      const rgb = new Uint8Array(c2.width * c2.height * 3);
      let stray = 0;
      for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
        const r = data[i] ?? 0;
        const g = data[i + 1] ?? 0;
        const b = data[i + 2] ?? 0;
        // Ramène chaque pixel à la couleur de palette la plus proche (et compte les écarts).
        let best = PALETTE[0] as number[];
        let bd = Number.POSITIVE_INFINITY;
        for (const p of PALETTE) {
          const d = (r - (p[0] ?? 0)) ** 2 + (g - (p[1] ?? 0)) ** 2 + (b - (p[2] ?? 0)) ** 2;
          if (d < bd) {
            bd = d;
            best = p;
          }
        }
        if (bd > 0) stray++;
        rgb[j] = best[0] ?? 0;
        rgb[j + 1] = best[1] ?? 0;
        rgb[j + 2] = best[2] ?? 0;
      }
      let bin = '';
      for (let i = 0; i < rgb.length; i += 0x8000) bin += String.fromCharCode(...rgb.subarray(i, i + 0x8000));
      window.__poster = { width: c2.width, height: c2.height, rgb: btoa(bin), stray };
    },
  });
} catch (err) {
  window.__poster = { error: String(err) };
}
