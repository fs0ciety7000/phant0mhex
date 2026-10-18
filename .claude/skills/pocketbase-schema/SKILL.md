---
name: pocketbase-schema
description: Modifier le schéma, les règles d'accès ou les hooks PocketBase de apps/pb (collections posts, categories, tags, media, projects, site, editors). À utiliser avant toute modification de données côté back.
---

# PocketBase : schéma, règles, hooks

Source de vérité : `docs/ARCHITECTURE.md` §4.

## Règles

- Toute modification de schéma = **nouvelle migration** JS dans `apps/pb/pb_migrations/<timestamp>_<verbe>_<objet>.js` avec `up` **et** `down`. Ne jamais éditer une migration déjà déployée.
- Générer une migration de départ : modifier en local dans le dashboard (`http://localhost:8090/_/`) avec `--automigrate`, puis relire et nettoyer le fichier généré.
- Après migration : mettre à jour `packages/pb-types/src/index.ts`, puis `pnpm typecheck`.
- Règles d'accès : écrire-les dans la migration. Lecture publique de `posts` = `status = "published" && published_at <= @now` ; toute écriture = `@request.auth.collectionName = "editors"`.
- `editors` : pas de `createRule` publique ; MFA (OTP) activée.

## Hooks (`apps/pb/pb_hooks/*.pb.js`)

- Runtime JSVM de PocketBase (pas Node : pas de `require` npm ; utiliser `$http.send`, `$app`, `$os.getenv`).
- Hooks existants prévus : slug, reading_time, revision, published_at, dimensions des médias, purge Cloudflare, cron des billets programmés.
- Chaque hook doit appeler `e.next()` et ne jamais bloquer une sauvegarde sur un échec de purge (journaliser seulement).

## Tests

Les tests e2e (Playwright) démarrent `docker compose up pb` avec les migrations et vérifient au minimum : un brouillon est invisible en anonyme, un billet programmé dans le futur est invisible, un éditeur peut créer/publier.
