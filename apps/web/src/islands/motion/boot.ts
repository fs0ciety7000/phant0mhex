/**
 * Séquence de boot (accueil, une fois par session).
 * Le script inline de Motion.astro décide de l'afficher (`<body data-boot>`, pas de reduced motion,
 * `sessionStorage['nd-boot']` absent) avant le premier rendu ; ce module l'anime.
 * Passer : Échap ou bouton `[ PASSER ]`. Durée max ≈ 4,2 s. Résout la promesse à la sortie.
 */
const LINES = [
  '> INIT UNITÉ ND-01 .................. OK',
  '> CHARGEMENT : RENDU / MOTION / TÉLÉMÉTRIE',
  '> CALIBRAGE DITHER BAYER 8×8 ........ OK',
  '> LIAISON 50.8503N 4.3517E ......... OK',
  '> SIGNAL ÉTABLI. BIENVENUE.',
];
const MAX_MS = 4200;
const EXIT_MS = 700;

export function runBoot(signal: AbortSignal): Promise<void> {
  const boot = document.getElementById('nd-boot');
  const root = document.documentElement;
  if (!boot || boot.hidden) return Promise.resolve();
  const log = boot.querySelector<HTMLElement>('[data-boot-log]');
  const bar = boot.querySelector<HTMLElement>('[data-boot-bar]');
  const skip = boot.querySelector<HTMLButtonElement>('[data-boot-skip]');
  const timers: number[] = [];
  const later = (fn: () => void, ms: number) => timers.push(window.setTimeout(fn, ms));

  return new Promise<void>((resolve) => {
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      try {
        sessionStorage.setItem('nd-boot', '1');
      } catch {
        /* stockage indisponible : le boot rejouera, sans gravité */
      }
      root.classList.remove('nd-booting');
      boot.classList.add('is-out');
      later(() => {
        boot.hidden = true;
        boot.classList.remove('is-out');
      }, EXIT_MS);
      // Les animations d'entrée démarrent pendant le wipe de sortie (comme le prototype : +250 ms).
      later(resolve, 250);
    };

    skip?.addEventListener('click', finish, { signal });
    addEventListener(
      'keydown',
      (e) => {
        if (e.key === 'Escape') finish();
      },
      { signal },
    );
    signal.addEventListener('abort', () => {
      for (const t of timers) clearTimeout(t);
      root.classList.remove('nd-booting');
      boot.hidden = true;
      resolve();
    });

    let li = 0;
    let ci = 0;
    let done = '';
    const caret = document.createElement('span');
    caret.className = 'nd-caret';
    const type = () => {
      if (finished || signal.aborted) return;
      const line = LINES[li];
      if (line === undefined) {
        if (bar) bar.style.width = '100%';
        later(finish, 260);
        return;
      }
      ci += 3;
      if (log) {
        log.textContent = done + line.slice(0, ci);
        log.appendChild(caret);
      }
      if (bar)
        bar.style.width = `${Math.round(((li + Math.min(ci, line.length) / line.length) / LINES.length) * 100)}%`;
      if (ci >= line.length) {
        done += `${line}\n`;
        li++;
        ci = 0;
        later(type, 90);
      } else later(type, 14);
    };
    type();
    later(finish, MAX_MS);
    skip?.focus({ preventScroll: true });
  });
}
