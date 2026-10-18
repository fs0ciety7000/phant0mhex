---
name: markdown-pipeline
description: Modifier le rendu Markdown (packages/markdown) partagé par le site et l'aperçu admin : syntaxes, directives (:::note), images media:<id>, coloration Shiki, sanitisation.
---

# Pipeline Markdown partagé

`packages/markdown` expose `render(md, ctx) → { html, toc, readingTime }`, utilisé :
- côté serveur par Astro (`/journal/[slug]`) ;
- côté navigateur par l'aperçu de l'éditeur admin (Shiki chargé en différé).

## Chaîne

remark-parse → remark-gfm → remark-directive (+ handlers maison) → remark-rehype → rehype-slug → rehype-autolink-headings → Shiki (thème ND-01 : monochrome + `#FF2A2A`) → plugin `media` → rehype-sanitize (schéma maison) → stringify.

## Syntaxes maison

| Syntaxe | Rendu |
|---|---|
| `:::note` / `:::warning` … `:::` | encart bordure rouge 4px, fond `--surface` |
| `![alt](media:<id>)` | `<figure><img srcset>` depuis les miniatures PocketBase, `width`/`height`, `loading="lazy"`, `<figcaption>` = légende du média |
| `::youtube{id=…}` | iframe nocookie, chargée au clic |
| ```` ```ts title="loop.ts" ```` | bloc de code avec barre titre + bouton copier |

## Règles

- Toute nouvelle syntaxe : handler + entrée dans le schéma de sanitisation + bouton de toolbar si pertinent + test Vitest (snapshot HTML).
- Le rendu doit être **identique** serveur/navigateur : pas d'API Node dans le package.
- Lancer : `pnpm --filter markdown test`.
