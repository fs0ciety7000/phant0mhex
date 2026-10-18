/// <reference path="../pb_data/types.d.ts" />
// Réglages de l'instance. Aucun identifiant superuser ici : il est créé à la main
// (`pocketbase superuser upsert`) au premier déploiement.

migrate(
  (app) => {
    const settings = app.settings();

    settings.meta.appName = 'dessenius';
    settings.meta.senderName = 'dessenius';

    // Limitation de débit (règles par défaut de PocketBase).
    settings.rateLimits.enabled = true;

    // Pas d'API batch ni de stockage S3.
    settings.batch.enabled = false;
    settings.s3.enabled = false;

    // Derrière Cloudflare puis Traefik (Coolify) : l'IP réelle vient de CF-Connecting-IP,
    // à défaut de X-Forwarded-For (dernière IP = proxy le plus proche, donc pas leftmost).
    settings.trustedProxy.headers = ['CF-Connecting-IP', 'X-Forwarded-For'];
    settings.trustedProxy.useLeftmostIP = false;

    app.save(settings);
  },
  (app) => {
    const settings = app.settings();
    settings.meta.appName = 'Acme';
    settings.meta.senderName = 'Support';
    settings.rateLimits.enabled = false;
    settings.trustedProxy.headers = [];
    app.save(settings);
  },
);
