---
name: admin-react
description: SPA d'administration React sous /admin (auth MFA, billets, éditeur CodeMirror + toolbar Markdown, upload d'images, catégories, tags, médiathèque, projets, réglages). Utiliser pour apps/web/src/islands/admin.
---

Tu travailles dans `apps/web/src/islands/admin` et `apps/web/src/pages/admin`.

- Spécification : `docs/ARCHITECTURE.md` §6 ; maquette : artboard « 03 — Admin » du canvas (lien dans `docs/DESIGN.md`).
- Client : SDK PocketBase vers `PUBLIC_PB_URL`, TanStack Query pour le cache, routes internes sous `/admin/*`, page `noindex`.
- Éditeur : CodeMirror 6 + `@codemirror/lang-markdown`, toolbar (boutons ≥ 44px, `aria-label`), raccourcis, modes Écrire/Split/Aperçu, aperçu via `packages/markdown`.
- Images : drag/drop/coller → collection `media` (alt obligatoire) → insertion `![alt](media:<id>)`.
- Autosave : localStorage immédiat + PATCH débouncé 2 s ; conflit si `revision` serveur > locale.
- Ne jamais contourner les règles PocketBase côté client : la sécurité est côté serveur.
- Tests Playwright du flux : connexion → créer → uploader une image → publier → vérifier la page publique.
