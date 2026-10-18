/**
 * Découpe `[data-split]` en lettres masquées pour le slam-in.
 * Structure produite : élément → `.nd-w` (mot, inline-flex, overflow masqué = masque par ligne) → `.nd-ch` (lettre).
 * Les espaces restent des nœuds texte entre les mots pour garder le retour à la ligne naturel.
 * Un enfant élément (ex. `<span class="ac">.</span>`) est conservé tel quel comme une « lettre ».
 * Accessibilité : texte réel en `aria-label` sur les titres/liens/boutons, sinon copie visuellement masquée.
 */
const LABELLABLE = /^(H[1-6]|A|BUTTON)$/;

export function splitLetters(el: HTMLElement): HTMLElement[] {
  if (el.dataset.splitDone !== undefined) return Array.from(el.querySelectorAll<HTMLElement>('.nd-ch'));
  const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
  const visual = document.createElement('span');
  visual.className = 'nd-split';
  visual.setAttribute('aria-hidden', 'true');
  const chars: HTMLElement[] = [];
  let word: HTMLElement | null = null;
  const pushUnit = (unit: HTMLElement) => {
    if (!word) {
      word = document.createElement('span');
      word.className = 'nd-w';
      visual.appendChild(word);
    }
    unit.classList.add('nd-ch');
    word.appendChild(unit);
    chars.push(unit);
  };
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      for (const c of node.textContent ?? '') {
        if (/\s/.test(c)) {
          if (word) visual.appendChild(document.createTextNode(' '));
          word = null;
          continue;
        }
        const s = document.createElement('span');
        s.textContent = c;
        pushUnit(s);
      }
    } else if (node instanceof HTMLElement) {
      pushUnit(node);
    }
  }
  el.textContent = '';
  el.appendChild(visual);
  const alreadyHidden =
    el.closest('[aria-hidden="true"]') !== null && el.closest('[aria-hidden="true"]') !== el;
  if (!alreadyHidden && el.getAttribute('aria-hidden') !== 'true') {
    if (LABELLABLE.test(el.tagName)) {
      if (!el.hasAttribute('aria-label')) el.setAttribute('aria-label', text);
    } else {
      const sr = document.createElement('span');
      sr.className = 'nd-sr';
      sr.textContent = text;
      el.appendChild(sr);
    }
  }
  el.dataset.splitDone = '';
  return chars;
}
