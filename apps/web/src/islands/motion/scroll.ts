/**
 * Lenis (piloté par le ticker GSAP) + révélations ScrollTrigger + slam-in des lettres.
 * Jamais appelé sous `prefers-reduced-motion` (le contenu reste alors statique et visible).
 *
 * Attributs pris en charge :
 * - `[data-split]` : lettres masquées qui montent (power4.out, stagger 35 ms) à l'entrée dans l'écran.
 * - `[data-reveal]` : y 40 → 0 + fondu (par lots, stagger 80 ms). `data-reveal="line"` : trait qui se trace
 *   (scaleX 0 → 1 depuis la gauche). `data-reveal="fade"` : fondu seul.
 * - `[data-parallax="-22"]` : yPercent lié au défilement de la section parente (scrub).
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { splitLetters } from './split';

gsap.registerPlugin(ScrollTrigger);

const TOPBAR = '[data-topbar], .topbar, body > header';

export interface ScrollOptions {
  smooth: boolean;
  bootDone: Promise<void>;
  booting: boolean;
}

export function mountScroll(signal: AbortSignal, { smooth, bootDone, booting }: ScrollOptions): void {
  const root = document.documentElement;
  let lenis: Lenis | null = null;
  const raf = (t: number) => lenis?.raf(t * 1000);

  if (smooth) {
    lenis = new Lenis({ lerp: 0.11, wheelMultiplier: 1, autoRaf: false });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);
    if (booting) lenis.stop();

    // Ancres internes via lenis.scrollTo. Phase de capture + preventDefault : le ClientRouter
    // d'Astro ignore les clics déjà traités.
    document.addEventListener(
      'click',
      (e) => {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        const a = e.target instanceof Element ? e.target.closest<HTMLAnchorElement>('a[href*="#"]') : null;
        if (!a || a.target === '_blank' || a.pathname !== location.pathname || a.origin !== location.origin)
          return;
        const hash = decodeURIComponent(a.hash.slice(1));
        const target = hash === '' || hash === 'top' ? 0 : document.getElementById(hash);
        if (target === null) return;
        e.preventDefault();
        const bar = document.querySelector<HTMLElement>(TOPBAR);
        lenis?.scrollTo(target, { offset: -((bar?.offsetHeight ?? 0) + 2), duration: 1.4 });
      },
      { capture: true, signal },
    );
  }

  const ctx = gsap.context(() => {
    // États initiaux posés tout de suite (pendant le boot) pour éviter tout flash.
    for (const el of document.querySelectorAll<HTMLElement>('[data-split]')) {
      gsap.set(splitLetters(el), { yPercent: 118 });
    }
    for (const el of document.querySelectorAll<HTMLElement>('[data-reveal]')) {
      const kind = el.dataset.reveal;
      if (kind === 'line') gsap.set(el, { scaleX: 0, transformOrigin: 'left center' });
      else if (kind === 'fade') gsap.set(el, { autoAlpha: 0 });
      else gsap.set(el, { y: 40, autoAlpha: 0 });
    }
  });
  root.classList.remove('nd-hold');

  bootDone.then(() => {
    if (signal.aborted) return;
    lenis?.start();
    ctx.add(() => {
      for (const el of document.querySelectorAll<HTMLElement>('[data-split]')) {
        const chars = el.querySelectorAll('.nd-ch');
        gsap.to(chars, {
          yPercent: 0,
          duration: 1,
          ease: 'power4.out',
          stagger: 0.035,
          scrollTrigger: { trigger: el, start: 'top 88%', once: true },
        });
      }
      const lines = gsap.utils.toArray<HTMLElement>('[data-reveal="line"]');
      for (const el of lines) {
        gsap.to(el, {
          scaleX: 1,
          duration: 1.2,
          ease: 'expo.out',
          scrollTrigger: { trigger: el, start: 'top 90%', once: true },
        });
      }
      const blocks = gsap.utils.toArray<HTMLElement>('[data-reveal]:not([data-reveal="line"])');
      if (blocks.length) {
        ScrollTrigger.batch(blocks, {
          start: 'top 88%',
          once: true,
          onEnter: (batch) =>
            gsap.to(batch, { y: 0, autoAlpha: 1, duration: 0.8, ease: 'power3.out', stagger: 0.08 }),
        });
      }
      for (const el of document.querySelectorAll<HTMLElement>('[data-parallax]')) {
        const amount = Number(el.dataset.parallax) || -22;
        const trigger = el.closest('[data-hero], section') ?? el;
        gsap.to(el, {
          yPercent: amount,
          ease: 'none',
          scrollTrigger: { trigger, start: 'top top', end: 'bottom top', scrub: true },
        });
      }
    });
    document.fonts?.ready.then(() => {
      if (!signal.aborted) ScrollTrigger.refresh();
    });
  });

  signal.addEventListener('abort', () => {
    ctx.revert();
    gsap.ticker.remove(raf);
    gsap.ticker.lagSmoothing(500, 33);
    lenis?.destroy();
    lenis = null;
  });
}
