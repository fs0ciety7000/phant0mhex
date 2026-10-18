/**
 * Curseur réticule (pointeurs fins uniquement).
 * - Variante « hot » (cadre rouge) sur liens / boutons / `[data-cursor="hot"]`.
 * - Masqué (curseur natif rendu) sur les champs de saisie et sur la barre du haut
 *   (`[data-topbar]`, `.topbar`, `body > header`) ou tout `[data-cursor="native"]`, pour éviter le chevauchement.
 */
const NATIVE =
  'input, textarea, select, [contenteditable=""], [contenteditable="true"], [data-cursor="native"]';
const TOPBAR = '[data-topbar], .topbar, body > header';
const HOT = 'a, button, [role="button"], label, summary, [data-cursor="hot"]';

const pad4 = (n: number) => String(Math.max(0, Math.round(n))).padStart(4, '0');

export function mountCursor(signal: AbortSignal, reduced: boolean): void {
  const root = document.documentElement;
  const el = document.createElement('div');
  el.className = 'nd-xhair';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = '<i class="h"></i><i class="v"></i><i class="box"></i><span class="lbl"></span>';
  const lbl = el.querySelector<HTMLElement>('.lbl');
  document.body.appendChild(el);
  root.classList.add('nd-cursor');

  let px = innerWidth / 2;
  let py = innerHeight / 2;
  let cx = px;
  let cy = py;
  let raf = 0;
  let shown = false;
  let lastLbl = '';
  const k = reduced ? 1 : 0.35;

  const loop = () => {
    cx += (px - cx) * k;
    cy += (py - cy) * k;
    el.style.transform = `translate3d(${cx}px,${cy}px,0)`;
    const t = `${pad4(cx)} / ${pad4(cy)}`;
    if (lbl && t !== lastLbl) lbl.textContent = lastLbl = t;
    raf = Math.abs(px - cx) + Math.abs(py - cy) > 0.1 ? requestAnimationFrame(loop) : 0;
  };
  const kick = () => {
    if (!raf) raf = requestAnimationFrame(loop);
  };

  addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
      px = e.clientX;
      py = e.clientY;
      if (!shown) {
        cx = px;
        cy = py;
        shown = true;
      }
      const target = e.target instanceof Element ? e.target : null;
      const native = !!target?.closest(NATIVE) || !!target?.closest(TOPBAR);
      el.classList.toggle('off', native);
      el.classList.toggle('hot', !native && !!target?.closest(HOT));
      kick();
    },
    { passive: true, signal },
  );
  addEventListener(
    'pointerout',
    (e) => {
      if (e.relatedTarget) return;
      shown = false;
      el.classList.add('off');
    },
    { passive: true, signal },
  );
  el.classList.add('off');

  signal.addEventListener('abort', () => {
    cancelAnimationFrame(raf);
    el.remove();
    root.classList.remove('nd-cursor');
  });
}
