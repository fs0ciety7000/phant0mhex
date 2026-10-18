/**
 * Point d'entrée motion (chargé une fois par Motion.astro).
 * Base légère exécutée immédiatement : scramble, réticule, boot, CRT, télémétrie pointeur/défilement.
 * GSAP + ScrollTrigger + Lenis sont chargés en import dynamique (chunk séparé), jamais sous reduced motion.
 */
import { runBoot } from './boot';
import { mountCursor } from './cursor';
import { isCoarsePointer, isFinePointer, onPage, prefersReducedMotion } from './lifecycle';
import { bindScramble } from './scramble';
import { heroState } from './store';

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

function trackTelemetry(signal: AbortSignal): void {
  const hero =
    document.querySelector<HTMLElement>('[data-hero]') ??
    document.querySelector('[data-hero3d]')?.closest('section') ??
    null;
  const pcts = Array.from(document.querySelectorAll<HTMLElement>('[data-scroll-pct]'));
  let raf = 0;
  const update = () => {
    raf = 0;
    if (hero) {
      const r = hero.getBoundingClientRect();
      heroState.setKey('scroll', r.height > 0 ? clamp01(-r.top / r.height) : 0);
    }
    if (pcts.length) {
      const max = document.documentElement.scrollHeight - innerHeight;
      const p = String(Math.round(clamp01(max > 0 ? scrollY / max : 0) * 100)).padStart(3, '0');
      for (const el of pcts) if (el.textContent !== p) el.textContent = p;
    }
  };
  const schedule = () => {
    if (!raf) raf = requestAnimationFrame(update);
  };
  addEventListener('scroll', schedule, { passive: true, signal });
  addEventListener('resize', schedule, { passive: true, signal });
  addEventListener(
    'pointermove',
    (e) => {
      const s = heroState.get();
      heroState.set({
        scroll: s.scroll,
        mx: (e.clientX / innerWidth) * 2 - 1,
        my: (e.clientY / innerHeight) * 2 - 1,
      });
    },
    { passive: true, signal },
  );
  update();
  signal.addEventListener('abort', () => {
    cancelAnimationFrame(raf);
    heroState.set({ scroll: 0, mx: 0, my: 0 });
  });
}

/** Bascule CRT : boutons `[data-crt-toggle]` (aria-pressed + enfant `[data-crt-state]` ON/OFF), mémorisée. */
function bindCrt(signal: AbortSignal): void {
  const root = document.documentElement;
  const buttons = Array.from(document.querySelectorAll<HTMLElement>('[data-crt-toggle]'));
  const sync = () => {
    const off = root.classList.contains('nd-crt-off');
    for (const b of buttons) {
      b.setAttribute('aria-pressed', off ? 'false' : 'true');
      const state = b.querySelector('[data-crt-state]');
      if (state) state.textContent = off ? 'OFF' : 'ON';
    }
  };
  for (const b of buttons) {
    b.addEventListener(
      'click',
      () => {
        root.classList.toggle('nd-crt-off');
        try {
          localStorage.setItem('nd-crt', root.classList.contains('nd-crt-off') ? 'off' : 'on');
        } catch {
          /* stockage indisponible */
        }
        sync();
      },
      { signal },
    );
  }
  sync();
}

onPage(() => {
  const ac = new AbortController();
  const { signal } = ac;
  const root = document.documentElement;
  const reduced = prefersReducedMotion();

  bindScramble(document, signal, !reduced);
  if (isFinePointer()) mountCursor(signal, reduced);
  bindCrt(signal);
  trackTelemetry(signal);

  const bootEl = document.getElementById('nd-boot');
  const booting = !!bootEl && !bootEl.hidden;
  const bootDone = runBoot(signal);

  if (reduced) {
    root.classList.remove('nd-hold');
  } else {
    import('./scroll')
      .then(({ mountScroll }) => {
        if (!signal.aborted) mountScroll(signal, { smooth: !isCoarsePointer(), bootDone, booting });
      })
      .catch((err) => {
        console.error('[motion]', err);
        root.classList.remove('nd-hold');
      });
  }
  return () => ac.abort();
});
