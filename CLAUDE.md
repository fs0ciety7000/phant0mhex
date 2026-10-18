# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projet

Site vitrine + blog (avec admin de publication) de **Nicolas Dessenius**, lead dev / game designer — `dessenius.be`.
Statut : **phase 0 — design et system design en validation**. Aucun code applicatif encore ; ne pas scaffolder ni déployer avant validation des questions ouvertes de `docs/ARCHITECTURE.md` §10.

Documents de référence (à lire avant toute tâche structurante) :
- `docs/ARCHITECTURE.md` — stack, modèle de données, routes, déploiement, questions ouvertes.
- `docs/DESIGN.md` — tokens et grammaire visuelle ND-01.
- `.claude/skills/industrial-brutalist-ui` — règles de l'archétype (on applique **uniquement** Tactical Telemetry, sombre).

## Stack (cible)

pnpm workspaces · Node 22 · Astro SSR (`@astrojs/node`) + îlots React · Three.js + `postprocessing` · GSAP/Lenis · PocketBase (migrations et hooks JS versionnés) · unified/Shiki · CodeMirror 6 · Biome · Vitest · Playwright · Docker → Coolify · Cloudflare.

## Commandes (cible, une fois le monorepo créé)

```bash
pnpm install
docker compose up pb          # PocketBase local sur :8090
pnpm --filter web dev         # Astro sur :4321
pnpm lint && pnpm typecheck && pnpm test
pnpm --filter markdown test -- -t "nom du test"   # un seul test Vitest
pnpm e2e                      # Playwright contre docker compose
pnpm --filter pb-types gen    # regénérer les types après une migration
```

## Règles du projet

- **Un seul pipeline Markdown** (`packages/markdown`) pour le site et l'aperçu admin. Ne jamais rendre du Markdown ailleurs.
- **Schéma PocketBase uniquement via migrations** dans `apps/pb/pb_migrations` (jamais de modif manuelle dans le dashboard en prod). Regénérer `packages/pb-types` ensuite.
- Les règles d'accès PocketBase sont la frontière de sécurité : un billet non publié ne doit jamais être lisible publiquement (`status = "published" && published_at <= @now`).
- Design : tokens de `packages/tokens` uniquement, `border-radius: 0`, un seul accent `#FF2A2A`, `#4AF626` réservé au voyant SYS ONLINE. Pas de chiffres inventés sur Nicolas : placeholders `[…]`.
- 3D/motion : respecter `prefers-reduced-motion`, poster statique avant WebGL, budgets de `docs/ARCHITECTURE.md` §7.
- Copie du site en **français**.

## Infra (lecture faite le 2026-10-17)

- Coolify : `$COOLIFY_API_URL` (token `$COOLIFY_API_TOKEN`), serveur `localhost` = `$COOLIFY_SERVER_IP` (152.53.176.13), Traefik + Let's Encrypt (challenge DNS Cloudflare). Conventions : build pack **Dockerfile**, déploiement via la GitHub App privée déjà installée, noms `dessenius-web` / `dessenius-pb`, projet Coolify « Dessenius.be ».
- Cloudflare : `$CLOUDFLARE_API_TOKEN` est un **token de compte** (`/accounts/$CLOUDFLARE_ACCOUNT_ID/tokens/verify`, pas `/user/tokens/verify`). Zone `dessenius.be`, SSL Full (strict).
- `dessenius.be` / `www` sont **déjà servis par une autre app** (repo `fs0ciety7000/dessenius.be`) : ne pas réattribuer ces domaines sans accord explicite.
- Ne jamais toucher aux enregistrements DNS mail (MX, SPF, DKIM, DMARC) ni aux sous-domaines existants (`mariage`, `elodie`, `grace`, `wedding`).
- L'API Coolify renvoie des secrets en clair dans certaines réponses GET : ne jamais les afficher ni les committer.
- Toute action d'écriture sur Coolify ou Cloudflare (création d'app, DNS, domaines, purge) nécessite l'accord de l'utilisateur. Voir le skill `deploy-coolify`.

## Agents du projet

`.claude/agents/` : `frontend-astro`, `admin-react`, `pocketbase-backend`, `motion-3d`, `devops-coolify`, `design-reviewer`. L'orchestrateur répartit le travail par zone de fichiers (voir chaque agent) et fait passer toute UI par `design-reviewer` avant commit.
