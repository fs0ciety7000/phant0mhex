/// <reference path="../pb_data/types.d.ts" />
// Contenu réel (fourni par Nicolas) : bio CARDOR Media, liens et six projets en ligne.
// Ne remplace que les valeurs encore à l'état de placeholder du seed (1792280200) : une saisie
// faite entre-temps dans l'admin n'est jamais écrasée. Les projets sont mis à jour par slug.

const SEED_BIO = '[BIO — à fournir]';

const BIO = `Fondateur de **CARDOR Media**, holding de divertissement basée à Mons, je conçois et développe des jeux vidéo narratifs, des outils self-hosted et des expériences interactives, avec une attention marquée pour le design, la documentation et l’expérience utilisateur.

CARDOR Media réunit quatre studios autour d’un même noyau créatif :

- **CM Interactive** — jeux vidéo 3D, expériences web temps réel et plateformes interactives
- **CM Soundworks** — sound design, voix, musique et mixage
- **CM Creative Lab** — illustration, direction artistique, lore et identité
- **CM Publishing** — édition numérique et liseuse interactive

Développeur full-stack et game developer, je privilégie les solutions local-first, libres et bien architecturées, du prototype rapide à la production : exports multi-plateformes, packaging, CI, déploiement.

Je livre des projets complets, documentés et utilisables, du premier croquis au dernier sample, avec un ancrage local assumé : Mons et le patrimoine du Doudou.`;

const SOCIALS = [
  { label: 'GITHUB', url: 'https://github.com/fs0ciety7000' },
  { label: 'CARDOR MEDIA', url: 'https://cardormedia.com' },
];

const ROLE = 'CONCEPTION / DÉV';

const PROJECTS = [
  {
    slug: 'clearance',
    title: 'CLEARANCE',
    url: 'https://clearance.cardormedia.com',
    summary:
      'Jeu de contrôle d’identité cyberpunk inspiré de Papers, Please : documents holographiques, règles qui changent chaque jour, dix fins.',
    body: `Halcyon Gate, 2187. Station orbitale du Consortium : vous êtes l’agent de contrôle au guichet d’entrée. Chaque jour apporte une nouvelle règle ; il faut comparer des documents holographiques et choisir qui passe.

- Campagne complète : jours 1 à 30 en trois actes, puis un épilogue
- 10 fins et des dilemmes moraux
- Documents holographiques, mode récit et options d’accessibilité
- Windows, macOS, Linux et Steam Deck

**Stack** : Godot 4, GDScript.`,
  },
  {
    slug: 'chronoflore',
    title: 'ChronoFlore',
    url: 'https://chronoflore.cardormedia.com',
    summary:
      'Jeu d’action-arcade en développement : lucide dans son rêve, une botaniste-chasseuse capture les plantes nées de ses émotions avant le réveil.',
    body: `Huit heures de sommeil, toute une flore à capturer. Chaque plante est une émotion, un souvenir, une pensée ; la chasseuse a jusqu’au réveil pour en sauver le plus possible.

Une run, c’est une nuit : chaque plante capturée fait avancer l’heure, et si la lucidité s’éteint avant l’aube, le réveil sonne trop tôt.

En développement : prototype jouable, versions macOS, Windows et Linux à venir.`,
  },
  {
    slug: 'arbre',
    title: 'L’Arbre aux absents',
    url: 'https://arbre.cardormedia.com',
    summary:
      'Jeu d’enquête généalogique en solo : croiser archives, registres et photographies pour reconstituer l’arbre d’une famille de la Velmarche.',
    body: `Velmarche, octobre 1974. La Régence est tombée depuis vingt ans et une loi nouvelle permet enfin de rendre leur nom aux « absents », ces citoyens rayés des registres. Rapporteur à l’Office de Réinscription civile, vous avez un bureau, une lampe et tout l’automne pour reconstituer une famille.

- Enquête par recoupement d’archives, de registres et de photographies
- Jouable dans le navigateur ; Windows, macOS, Linux et Android
- Carte du monde et artbook

Un projet CM Interactive et CM Creative Lab.`,
  },
  {
    slug: 'aether',
    title: 'Aether',
    url: 'https://aether.fs0ciety.org',
    summary: 'Serveur multimédia libre et self-hosted pour films, séries et musique, sous licence AGPL-3.0.',
    body: `Une alternative libre à Plex, Emby et Jellyfin, pensée pour être belle, calme et fiable. Aether range films, séries et musique où qu’ils se trouvent (disque local, NAS, seedbox, autre machine) et les rejoue partout, en qualité d’origine dès que l’appareil le permet.

- Reconnaissance des bibliothèques et métadonnées
- Lecture directe ou transcodage matériel (HLS)
- Sources distantes : dossier, agent Aether, SFTP
- Multi-utilisateurs, synchronisation Trakt et Simkl
- Aucun compte cloud, aucune télémétrie par défaut

**Stack** : Go, SvelteKit. Licence AGPL-3.0.`,
  },
  {
    slug: 'portico',
    title: 'Portico',
    url: 'https://portico.dessenius.be',
    summary:
      'Gestionnaire de sessions SSH local-first et keyboard-first : un moteur Rust, une TUI et une GUI.',
    body: `Un client SSH rapide et pensé pour le clavier, pour macOS, Linux et Windows. Un seul moteur Rust, deux interfaces (terminal et graphique), et le fichier \`~/.ssh/config\` reste la source de vérité.

- Local-first : aucun compte, aucun cloud
- TUI et GUI sur le même moteur
- Navigation entièrement au clavier

**Stack** : Rust.`,
  },
  {
    slug: 'le-reseau',
    title: 'Le Réseau',
    url: 'https://reseau.fs0ciety.org',
    summary:
      'Carte illustrée et vivante de la Belgique : tous les trains de voyageurs SNCB en temps réel, leur retard en couleur, et la journée en replay.',
    body: `Une carte illustrée de la Belgique où roulent, en ce moment, tous les trains de voyageurs SNCB. Le retard de chaque train se lit à sa couleur, et la journée entière peut être rejouée.`,
  },
];

// Seed d'origine, retiré seulement s'il n'a pas été retouché.
const SEED_LEFTOVERS = [
  { slug: 'cardormedia', title: 'Cardormedia' },
  { slug: 'projet-03', title: '[Projet 03]' },
];

const find = (app, slug) => {
  try {
    return app.findFirstRecordByData('projects', 'slug', slug);
  } catch (_) {
    return null;
  }
};

migrate(
  (app) => {
    for (const site of app.findAllRecords('site')) {
      if ((site.getString('bio') || '').trim() === SEED_BIO || !site.getString('bio').trim())
        site.set('bio', BIO);
      const socials = site.getString('socials').replace(/\s/g, '');
      if (!socials || socials === '[]' || socials === 'null') site.set('socials', SOCIALS);
      app.save(site);
    }

    for (const s of SEED_LEFTOVERS) {
      const r = find(app, s.slug);
      if (r && r.getString('title') === s.title) app.delete(r);
    }

    const collection = app.findCollectionByNameOrId('projects');
    PROJECTS.forEach((p, i) => {
      const r = find(app, p.slug) ?? new Record(collection);
      r.set('slug', p.slug);
      r.set('title', p.title);
      r.set('url', p.url);
      r.set('summary', p.summary);
      r.set('body', p.body);
      r.set('order', i + 1);
      const role = r.getString('role');
      if (!role || role === '[RÔLE]') r.set('role', ROLE);
      if (r.getString('year') === '[ANNÉE]') r.set('year', '');
      app.save(r);
    });
  },
  (app) => {
    for (const p of PROJECTS) {
      if (p.slug === 'arbre') continue;
      const r = find(app, p.slug);
      if (r) app.delete(r);
    }
    const arbre = find(app, 'arbre');
    if (arbre) {
      arbre.set('title', 'Arbre');
      arbre.set('summary', '');
      arbre.set('body', '');
      arbre.set('role', '[RÔLE]');
      arbre.set('year', '[ANNÉE]');
      arbre.set('order', 2);
      app.save(arbre);
    }
    const collection = app.findCollectionByNameOrId('projects');
    const seed = [
      { title: 'Cardormedia', slug: 'cardormedia', url: 'https://cardormedia.com', order: 1 },
      { title: '[Projet 03]', slug: 'projet-03', url: '', order: 3 },
    ];
    for (const p of seed) {
      if (find(app, p.slug)) continue;
      const r = new Record(collection);
      for (const k of Object.keys(p)) r.set(k, p[k]);
      r.set('role', '[RÔLE]');
      r.set('year', '[ANNÉE]');
      app.save(r);
    }
    for (const site of app.findAllRecords('site')) {
      if (site.getString('bio') === BIO) site.set('bio', SEED_BIO);
      if (site.getString('socials').replace(/\s/g, '') === JSON.stringify(SOCIALS).replace(/\s/g, ''))
        site.set('socials', []);
      app.save(site);
    }
  },
);
