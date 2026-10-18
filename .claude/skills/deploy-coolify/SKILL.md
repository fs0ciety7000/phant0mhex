---
name: deploy-coolify
description: Déployer ou diagnostiquer dessenius-web / dessenius-pb sur coolify.fs0ciety.org et gérer le DNS/cache Cloudflare de dessenius.be. À utiliser pour toute action Coolify ou Cloudflare.
---

# Déploiement Coolify + Cloudflare

Toute **écriture** (créer/modifier une app, des domaines, des variables, un enregistrement DNS, une purge massive) exige l'accord explicite de l'utilisateur dans la conversation en cours. Les lectures (GET) sont libres. Ne jamais afficher une valeur de secret : l'API Coolify en renvoie en clair (config proxy, GitHub App, variables).

## Accès

```bash
CO="$COOLIFY_API_URL/api/v1"   # adapter si COOLIFY_API_URL finit déjà par /api/v1
curl -sS -H "Authorization: Bearer $COOLIFY_API_TOKEN" "$CO/version"
CF=https://api.cloudflare.com/client/v4
curl -sS -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" "$CF/accounts/$CLOUDFLARE_ACCOUNT_ID/tokens/verify"
```

## Repères (2026-10-17)

- Serveur Coolify `localhost` (uuid `r0os4cws004gs88k840wckok`), IP publique 152.53.176.13, Traefik v3.
- Projet « Dessenius.be » uuid `eexoc66birjw2c1guhh9lfea`, env `production` uuid `lnmsg4nymoosc9sqpucfzt2l`.
- GitHub App privée uuid `cckkooog08wk8088gg8wg4sk` → `POST $CO/applications/private-github-app`.
- Zone Cloudflare `dessenius.be` id `64b1d307d7d4577ead5b7d704fedb0df`.

Revérifier ces identifiants par un GET avant de s'en servir.

## Apps déployées (2026-10-18)

| App | uuid | Domaine | Notes |
|---|---|---|---|
| `dessenius-pb` | `xonc5i58h1cghoutkrpqzjlp` | `https://pb.dessenius.be` | volume persistant `dessenius-pb-data` → `/pb/pb_data`, watch path `apps/pb/**` |
| `dessenius-web` | `ttc8svfscywqx9dtbdw0k7aa` | `dessenius.be`, `www` | env `PUBLIC_PB_URL`, `PB_INTERNAL_URL` (= URL publique pour l'instant), `SITE_URL` |

Branche déployée : `claude/jolly-noether-wy8emz` (auto-deploy) tant qu'il n'y a pas de `main`.
Statut d'un déploiement : `GET $CO/deployments/<deployment_uuid>` (champ `status`, logs JSON dans `logs`).
Premier démarrage de PocketBase : le lien `/_/#/pbinstall/<jwt>` des logs (valable 30 min) crée le superuser ; sinon redémarrer l'app pour en regénérer un.
Juste après un nouveau domaine, Cloudflare peut renvoyer 526 une à deux minutes, le temps que Traefik obtienne le certificat.

## Création des apps (une fois validé)

1. `dessenius-pb` : build pack `dockerfile`, base directory `/apps/pb`, port 8090, volume persistant `/pb/pb_data`, domaine `https://pb.dessenius.be`, healthcheck `/api/health`.
2. `dessenius-web` : build pack `dockerfile`, base directory `/` (Dockerfile `apps/web/Dockerfile`, contexte monorepo), port 4321, domaines `https://dessenius.be,https://www.dessenius.be`, healthcheck `/healthz`, variables `PB_INTERNAL_URL`, `PUBLIC_PB_URL=https://pb.dessenius.be`.
3. Auto-deploy sur `main`.

## DNS

- Créer `A pb` → 152.53.176.13, `proxied: true`. Apex et `www` existent déjà.
- Interdits : MX, SPF/TXT, DKIM, DMARC, `mariage`, `elodie`, `grace`, `wedding`.

## Vérifications après déploiement

```bash
curl -sSI https://dessenius.be | head -5          # 200, header cf-ray
curl -sS https://dessenius.be/healthz
curl -sS https://pb.dessenius.be/api/health
curl -sS "https://pb.dessenius.be/api/collections/posts/records?filter=status='draft'"  # doit renvoyer 0 élément
```

## Purge du cache

`POST $CF/zones/<zone>/purge_cache` avec `{"files":[...]}` — uniquement les URLs touchées (la purge normale est faite par le hook PocketBase).
