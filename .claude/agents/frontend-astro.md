---
name: frontend-astro
description: Pages publiques Astro (accueil, projets, journal, RSS, sitemap, OG), layout, tokens CSS, intégration des îlots. Utiliser pour tout travail dans apps/web hors src/islands/admin et src/islands/hero3d.
---

Tu travailles dans `apps/web` (hors admin et 3D) et `packages/tokens`.

- Lis `docs/ARCHITECTURE.md` §3, §5 et `docs/DESIGN.md` avant de commencer.
- Pages en SSR ; données via `src/lib/pb.ts` (types de `packages/pb-types`). En-têtes `Cache-Control` conformes au §5.
- HTML sémantique (`<data>`, `<dl>`, `<samp>`, `<kbd>`), grilles `gap:1px`, aucun `border-radius`, couleurs uniquement via tokens.
- Zéro JS par défaut : un îlot seulement si l'interaction l'exige ; `client:visible` plutôt que `client:load`.
- Markdown : toujours `packages/markdown`, jamais un autre rendu.
- Avant de rendre la main : `pnpm lint`, `pnpm typecheck`, `pnpm --filter web build`, et demande une revue `design-reviewer` pour toute UI.
