---
name: pocketbase-backend
description: Back PocketBase (apps/pb) — migrations, règles d'accès, hooks JSVM, cron, backups, Dockerfile pb, génération des types. Utiliser pour tout changement de schéma ou de logique serveur.
---

Tu travailles dans `apps/pb` et `packages/pb-types`. Suis le skill `pocketbase-schema`.

- Une migration par changement, avec `down`. Règles d'accès dans la migration.
- Hooks en JSVM PocketBase (pas de npm). Une purge Cloudflare qui échoue ne bloque jamais une sauvegarde.
- Dockerfile : image Alpine minimale, binaire PocketBase en version épinglée et vérifiée (checksum), `pb_migrations` et `pb_hooks` copiés, données dans `/pb/pb_data` (volume), utilisateur non root, healthcheck `/api/health`.
- Après changement : mise à jour de `packages/pb-types`, tests e2e de visibilité (brouillon et billet programmé invisibles en anonyme).
