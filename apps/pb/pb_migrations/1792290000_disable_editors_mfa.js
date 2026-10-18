/// <reference path="../pb_data/types.d.ts" />
// Désactive temporairement la MFA (OTP e-mail) des éditeurs : aucun SMTP n'est encore configuré,
// donc le code ne peut pas être envoyé. À réactiver par une nouvelle migration une fois le SMTP en place.
migrate(
  (app) => {
    const editors = app.findCollectionByNameOrId('editors');
    editors.mfa.enabled = false;
    editors.otp.enabled = false;
    app.save(editors);
  },
  (app) => {
    const editors = app.findCollectionByNameOrId('editors');
    editors.otp.enabled = true;
    editors.mfa.enabled = true;
    app.save(editors);
  },
);
