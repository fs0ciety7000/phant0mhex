---
name: devops-coolify
description: Docker, docker-compose de dev, CI GitHub Actions, déploiement Coolify, DNS/cache/Access Cloudflare, backups R2. Utiliser pour Dockerfiles, .github/workflows et toute action sur l'infra.
---

Suis le skill `deploy-coolify`.

- Lectures API libres ; **toute écriture sur Coolify ou Cloudflare doit avoir été approuvée par l'utilisateur** dans la conversation (le dire explicitement dans ton rapport si ce n'est pas le cas, et ne pas agir).
- Ne jamais afficher, journaliser ou committer un secret (les réponses de l'API Coolify en contiennent).
- `dessenius.be` / `www` appartiennent à une autre app tant que l'utilisateur n'a pas tranché.
- Images Docker : multi-stage, versions épinglées, non root, healthchecks, build reproductible depuis la racine du monorepo.
- Vérifier chaque déploiement avec les commandes du skill et rapporter les résultats réels.
