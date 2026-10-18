/**
 * Glyph scramble au survol / focus de `[data-scramble]` (≈ 2 frames par caractère, révélation gauche → droite).
 * Seuls les nœuds texte sont brouillés : la structure (ex. `<b>01</b> DOSSIER`) est conservée.
 * L'hôte interactif (lien/bouton le plus proche) reçoit `aria-label` = texte réel pour que les lecteurs
 * d'écran n'entendent jamais les glyphes intermédiaires.
 */
const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&/<>[]+=*';
const KEEP = /[\s>]/;
const MS_PER_CHAR = 33;

interface Target {
  nodes: Text[];
  originals: string[];
  raf: number;
}

const targets = new WeakMap<HTMLElement, Target>();

function textNodes(el: HTMLElement): Text[] {
  const out: Text[] = [];
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if ((n.textContent ?? '').trim()) out.push(n as Text);
  }
  return out;
}

export function scramble(el: HTMLElement): void {
  if (targets.get(el)?.raf) return;
  // Relu à chaque déclenchement : le texte peut avoir changé (ex. bouton « COPIÉ ✓ »).
  const nodes = textNodes(el);
  const target: Target = { nodes, originals: nodes.map((n) => n.textContent ?? ''), raf: 0 };
  targets.set(el, target);
  const total = target.originals.reduce((a, s) => a + s.length, 0);
  const start = performance.now();
  const duration = Math.max(1, total) * MS_PER_CHAR;
  const tick = (now: number) => {
    const revealed = ((now - start) / duration) * total;
    let offset = 0;
    target.nodes.forEach((node, k) => {
      const orig = target.originals[k] ?? '';
      let out = '';
      for (let i = 0; i < orig.length; i++) {
        const c = orig[i] ?? '';
        out += KEEP.test(c) || offset + i < revealed ? c : (GLYPHS[(Math.random() * GLYPHS.length) | 0] ?? c);
      }
      offset += orig.length;
      node.textContent = out;
    });
    if (revealed < total) target.raf = requestAnimationFrame(tick);
    else {
      restore(target);
    }
  };
  target.raf = requestAnimationFrame(tick);
}

function restore(t: Target): void {
  if (t.raf) cancelAnimationFrame(t.raf);
  t.raf = 0;
  t.nodes.forEach((n, k) => {
    n.textContent = t.originals[k] ?? '';
  });
}

export function bindScramble(root: ParentNode, signal: AbortSignal, enabled: boolean): void {
  const els = Array.from(root.querySelectorAll<HTMLElement>('[data-scramble]'));
  for (const el of els) {
    const host = el.closest<HTMLElement>('a, button') ?? el;
    if ((host.tagName === 'A' || host.tagName === 'BUTTON') && !host.hasAttribute('aria-label')) {
      host.setAttribute('aria-label', (host.textContent ?? '').replace(/\s+/g, ' ').trim());
    }
    if (!enabled) continue;
    const run = () => scramble(el);
    host.addEventListener('mouseenter', run, { signal });
    host.addEventListener('focus', run, { signal });
  }
  signal.addEventListener('abort', () => {
    for (const el of els) {
      const t = targets.get(el);
      if (t) restore(t);
    }
  });
}
