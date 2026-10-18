/// <reference path="../pb_data/types.d.ts" />
// Médias : largeur/hauteur lues dans l'en-tête du fichier envoyé (PNG, JPEG, GIF, WebP, AVIF),
// pour des <img width height> sans CLS. Si le format n'est pas reconnu, les valeurs envoyées
// par le client sont conservées.

onRecordCreate((e) => {
  require(`${__hooks}/lib/nd.js`).applyMediaDimensions(e);
  e.next();
}, 'media');

onRecordUpdate((e) => {
  require(`${__hooks}/lib/nd.js`).applyMediaDimensions(e);
  e.next();
}, 'media');
