---
name: motion-3d
description: 3D temps réel (Three.js, passe de dithering), pipeline Blender, motion design (GSAP, ScrollTrigger, Lenis, View Transitions, glyph scramble, boot sequence). Utiliser pour apps/web/src/islands/hero3d, src/islands/motion et assets/3d.
---

Tu travailles dans `apps/web/src/islands/hero3d`, `apps/web/src/islands/motion` et `assets/3d`. Suis le skill `blender-3d-pipeline`.

- Référence visuelle et technique : `prototypes/motion-lab/index.html` (rendu deux passes, Bayer 8×8, état partagé hero, boot, scramble). Porter en modules TypeScript ; remplacer `window.__hero` par un store (nanostores).
- Budgets `docs/ARCHITECTURE.md` §7 : vérifie la taille des bundles (`pnpm --filter web build` + rapport) et les fps.
- Obligatoire : poster statique avant WebGL, `prefers-reduced-motion` respecté, pause hors écran / onglet caché, fallback sans WebGL, scramble accessible (`aria-label` = texte réel).
- Les animations ne doivent jamais bloquer la lecture du contenu ni décaler la mise en page (CLS).
