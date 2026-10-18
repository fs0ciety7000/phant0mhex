/**
 * Cycle de vie compatible avec et sans `<ClientRouter />` (Astro View Transitions).
 * - Sans routeur : `setup` s'exécute une fois au chargement.
 * - Avec routeur : `astro:page-load` (initial + après chaque navigation) monte, `astro:before-swap` nettoie.
 * Le garde `mounted` évite le double montage au premier chargement (DOMContentLoaded + astro:page-load).
 */
export type Cleanup = () => void;

export function onPage(setup: () => Cleanup | undefined): void {
  let cleanup: Cleanup | undefined;
  let mounted = false;
  const run = () => {
    if (mounted) return;
    mounted = true;
    try {
      cleanup = setup();
    } catch (err) {
      console.error('[motion]', err);
    }
  };
  const stop = () => {
    if (!mounted) return;
    mounted = false;
    try {
      cleanup?.();
    } finally {
      cleanup = undefined;
    }
  };
  document.addEventListener('astro:page-load', run);
  document.addEventListener('astro:before-swap', stop);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once: true });
  else run();
}

const mq = (q: string): boolean => typeof matchMedia === 'function' && matchMedia(q).matches;

export const prefersReducedMotion = (): boolean => mq('(prefers-reduced-motion: reduce)');
export const isFinePointer = (): boolean => mq('(hover: hover) and (pointer: fine)');
export const isCoarsePointer = (): boolean => mq('(pointer: coarse)');
