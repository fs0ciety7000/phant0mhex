/**
 * Chargeur léger de l'îlot hero : n'importe Three.js (chunk séparé) que si
 * - pas de `prefers-reduced-motion` (sinon poster seul, aucun contexte WebGL),
 * - WebGL2 disponible (Three r186 l'exige ; sinon poster seul),
 * - le hero approche de l'écran (IntersectionObserver, marge 200 px).
 * Démonte tout sur `astro:before-swap`.
 */
import { onPage, prefersReducedMotion } from '../motion/lifecycle';
import { heroState } from '../motion/store';

function hasWebGL2(): boolean {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2');
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

function mount(host: HTMLElement): () => void {
  const q = (k: string) => host.querySelector<HTMLElement>(`[data-hud="${k}"]`);
  const fps = q('fps');
  if (prefersReducedMotion()) {
    host.dataset.state = 'still';
    if (fps) fps.textContent = 'FIXE';
    return () => {};
  }
  if (!hasWebGL2()) {
    host.dataset.state = 'fallback';
    if (fps) fps.textContent = '0';
    return () => {};
  }
  let alive = true;
  let dispose: (() => void) | undefined;
  const stage = host.querySelector<HTMLElement>('[data-hero3d-stage]') ?? host;
  const io = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      host.dataset.state = 'loading';
      import('./HeroMonolith')
        .then(({ createHeroMonolith }) => {
          if (!alive) return;
          const inst = createHeroMonolith({
            container: stage,
            hud: { fps, rot: q('rot'), sweep: q('sweep'), px: q('px') },
            getInput: () => heroState.get(),
            onFirstFrame: () => {
              host.dataset.state = 'live';
            },
            onContextLost: () => {
              host.dataset.state = 'fallback';
              inst.dispose();
            },
          });
          dispose = inst.dispose;
        })
        .catch((err) => {
          console.error('[hero3d]', err);
          host.dataset.state = 'fallback';
        });
    },
    { rootMargin: '200px' },
  );
  io.observe(host);
  return () => {
    alive = false;
    io.disconnect();
    dispose?.();
  };
}

onPage(() => {
  const cleanups = Array.from(document.querySelectorAll<HTMLElement>('[data-hero3d]')).map(mount);
  return () => {
    for (const c of cleanups) c();
  };
});
