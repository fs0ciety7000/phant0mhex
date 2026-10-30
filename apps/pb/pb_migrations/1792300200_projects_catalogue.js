/// <reference path="../pb_data/types.d.ts" />
// Refonte « portfolio » : les projets portent un type (filtre du catalogue), un libellé court
// et un drapeau « ancré à Mons ». Charge le catalogue complet des projets en ligne (31).
// Mise à jour par slug : un résumé ou un corps déjà saisis dans l'admin ne sont jamais écrasés.
// Les captures par défaut sont servies par le site (apps/web/public/projets/<slug>.webp) ;
// une couverture envoyée depuis l'admin reste prioritaire.

const TYPES = ['jeu', 'outil', 'creation'];

// [slug, titre, url, type, libellé, mons, à la une, résumé]
const CATALOGUE = [
  [
    'clearance',
    'CLEARANCE',
    'https://clearance.cardormedia.com',
    'jeu',
    'Jeu · Godot 4',
    false,
    true,
    'Contrôle d’identité cyberpunk inspiré de Papers, Please. 30 jours en trois actes, 10 fins, sur PC, Mac, Linux et Steam Deck.',
  ],
  [
    'lumecon',
    'LUMEÇON',
    'https://shooter.fs0ciety.org',
    'jeu',
    'FPS',
    true,
    true,
    'Un FPS infernal au cœur de la Ducasse de Mons. Windows, macOS, Linux et Android.',
  ],
  [
    'chambre-noire',
    'Chambre Noire',
    'https://darkroom.fs0ciety.org',
    'jeu',
    'Jeu d’enquête',
    false,
    true,
    'Bruxelles, 1928. Une photographe judiciaire reconstitue des rapports mot à mot. Windows, macOS, Linux et Android.',
  ],
  [
    'arbre',
    'L’Arbre aux absents',
    'https://arbre.cardormedia.com',
    'jeu',
    'Jeu d’enquête',
    false,
    true,
    'Enquête généalogique en solo : croiser archives, registres et photographies pour rendre leurs noms aux absents.',
  ],
  [
    'aether',
    'Aether',
    'https://aether.fs0ciety.org',
    'outil',
    'Logiciel libre · Go',
    false,
    true,
    'Serveur multimédia self-hosted, alternative libre à Plex et Jellyfin. AGPL-3.0.',
  ],
  [
    'le-reseau',
    'Le Réseau',
    'https://reseau.fs0ciety.org',
    'outil',
    'Carte temps réel',
    false,
    false,
    'Tous les trains SNCB en direct, leur retard en couleur, et la journée en replay.',
  ],
  [
    'privatix',
    'Privatix',
    'https://privatix.fs0ciety.org',
    'jeu',
    'Roguelite',
    false,
    false,
    'Un cheminot en 3x8 contre les consultants qui privatisent le rail belge. Navigateur, PC, Mac, Linux et Android.',
  ],
  [
    'chronoflore',
    'ChronoFlore',
    'https://chronoflore.cardormedia.com',
    'jeu',
    'Action-arcade · en développement',
    false,
    false,
    'Lucide dans son rêve, une botaniste capture les plantes nées de ses émotions avant le réveil.',
  ],
  [
    'kernel-panic',
    'Kernel_Panic',
    'https://kernel.fs0ciety.org',
    'jeu',
    'Enquête de hacking',
    false,
    false,
    'Explorer un OS virtuel, terminal, mails et logs, pour remonter la piste d’une intrusion.',
  ],
  [
    'echo-trace',
    'Echo Trace',
    'https://echo.fs0ciety.org',
    'jeu',
    'Simulation pédagogique',
    false,
    false,
    'Une simulation d’enquête cyber où tout laisse un écho.',
  ],
  [
    'meurtre-au-beffroi',
    'Meurtre au beffroi',
    'https://beffroi.fs0ciety.org',
    'jeu',
    'Coop · 3 à 6 joueurs',
    true,
    false,
    'Une nuit de Ducasse, le gardien du beffroi est retrouvé mort. Enquête coopérative, chacun sur son téléphone.',
  ],
  [
    'poste-aiguillage',
    'Poste d’aiguillage',
    'https://aiguillage.fs0ciety.org',
    'jeu',
    'Coop à deux',
    false,
    false,
    'L’aiguilleur voit le tableau, le régulateur lit le manuel. Un train approche : parlez-vous.',
  ],
  [
    'fuel-x',
    'Fuel-X',
    'https://fuel.fs0ciety.org',
    'jeu',
    'Stratégie',
    false,
    false,
    'Un pas de tir vivant : décrocher des contrats, remplir, compter, rattraper le booster dans la tour.',
  ],
  [
    'cosmic-empires',
    'Cosmic Empires',
    'https://empire.fs0ciety.org',
    'jeu',
    'Stratégie en ligne',
    false,
    false,
    'Bâtir un empire, rechercher, combattre et s’allier en temps réel.',
  ],
  [
    'carillon',
    'Carillon',
    'https://carillon.fs0ciety.org',
    'jeu',
    'Casse-briques',
    true,
    false,
    'Un casse-briques dans le beffroi de Mons : chaque cloche brisée joue une note de l’air.',
  ],
  [
    'space-invador',
    'Space Invador',
    'https://space-invador.fs0ciety.org',
    'jeu',
    'Arcade',
    true,
    false,
    'Saint-Georges repousse le cortège du Lumeçon sous le beffroi de Mons.',
  ],
  [
    'taupe',
    'TAUPE!',
    'https://taupe.fs0ciety.org',
    'jeu',
    'Arcade 8-bit',
    false,
    false,
    'Tape-taupe rétro, missions du jour et classement mondial.',
  ],
  [
    'mot-du-doudou',
    'Le Mot du Doudou',
    'https://doudou.fs0ciety.org',
    'jeu',
    'Mot du jour',
    true,
    false,
    'Le Wordle montois : mots du Doudou, du patois et de la vie montoise.',
  ],
  [
    'quiz-du-doudou',
    'Le Quiz du Doudou',
    'https://quiz.fs0ciety.org',
    'jeu',
    'Quiz en direct',
    true,
    false,
    'Sur grand écran, de 2 à 50 joueurs répondent depuis leur téléphone.',
  ],
  [
    'arcade-cardor',
    'L’Arcade CARDOR',
    'https://arcade.cardormedia.com',
    'outil',
    'Plateforme de jeu',
    false,
    false,
    'Un profil de joueur sans compte, des succès et un classement commun à tous les jeux.',
  ],
  [
    'portico',
    'Portico',
    'https://portico.dessenius.be',
    'outil',
    'Client SSH · Rust',
    false,
    false,
    'Sessions SSH local-first, pensées pour le clavier, en TUI et en GUI.',
  ],
  [
    'startx',
    'StartX',
    'https://startpage.fs0ciety.org',
    'outil',
    'Startpage',
    false,
    false,
    'Favoris, flux RSS, météo et recherche. Svelte 5 et Go.',
  ],
  [
    'atlas',
    'Atlas',
    'https://atlas.fs0ciety.org',
    'outil',
    'Worldbuilding',
    false,
    false,
    'Continents générés depuis une graine, rendu de gravure, fiches de lieux liées comme un wiki.',
  ],
  [
    'meridian',
    'Meridian',
    'https://meridian.cardormedia.com',
    'outil',
    'Atlas d’expédition',
    false,
    false,
    'Un atlas d’expédition : planter son camp, tracer sa route.',
  ],
  [
    'liseuse-cardor',
    'La liseuse CARDOR',
    'https://lire.cardormedia.com',
    'outil',
    'Édition numérique',
    false,
    false,
    'Une liseuse qui prend l’apparence de chaque livre : couleurs, typographie, matières.',
  ],
  [
    'cardor-apps',
    'CARDOR Apps',
    'https://apps.cardormedia.com',
    'outil',
    'Lanceur',
    false,
    false,
    'Tous les jeux et outils des studios CARDOR Media, à ouvrir en un clic.',
  ],
  [
    'occ-deliveries',
    'OCC Deliveries',
    'https://eat.fs0ciety.org',
    'outil',
    'Appli d’équipe',
    false,
    false,
    'Commandes de repas groupées : on vote pour le resto, chacun compose son panier, un seul paie.',
  ],
  [
    'vitrine-express',
    'Vitrine Express',
    'https://vitrine.fs0ciety.org',
    'outil',
    'Offre web',
    true,
    false,
    'Des sites vitrines rapides et toujours à jour pour les commerces de Mons.',
  ],
  [
    'sites-evenements',
    'Sites d’événements',
    'https://evenements.fs0ciety.org',
    'outil',
    'Offre web',
    false,
    false,
    'Des sites privés clés en main pour les mariages, anniversaires et naissances.',
  ],
  [
    'carte-de-mons',
    'Mons, la carte illustrée',
    'https://carte.fs0ciety.org',
    'creation',
    'Carte interactive',
    true,
    false,
    'Une gravure de Mons à explorer, avec une fiche pour chaque lieu de l’univers CARDOR.',
  ],
  [
    'carillon-collectif',
    'Le Carillon collectif',
    'https://sound.cardormedia.com/carillon',
    'creation',
    'Musique en ligne',
    true,
    false,
    'Faire sonner les cloches du beffroi de Mons avec tous ceux qui jouent en ce moment.',
  ],
];

const ORIGINAL = ['clearance', 'chronoflore', 'arbre', 'aether', 'portico', 'le-reseau'];

const find = (app, slug) => {
  try {
    return app.findFirstRecordByData('projects', 'slug', slug);
  } catch (_) {
    return null;
  }
};

migrate(
  (app) => {
    const projects = app.findCollectionByNameOrId('projects');
    projects.fields.add(new SelectField({ name: 'type', maxSelect: 1, values: TYPES }));
    projects.fields.add(new TextField({ name: 'kind', max: 80 }));
    projects.fields.add(new BoolField({ name: 'mons' }));
    app.save(projects);

    CATALOGUE.forEach(([slug, title, url, type, kind, mons, featured, summary], i) => {
      const r = find(app, slug) ?? new Record(projects);
      r.set('slug', slug);
      r.set('title', title);
      r.set('url', url);
      r.set('type', type);
      r.set('kind', kind);
      r.set('mons', mons);
      r.set('featured', featured);
      r.set('order', i + 1);
      if (!r.getString('summary').trim()) r.set('summary', summary);
      app.save(r);
    });
  },
  (app) => {
    for (const [slug] of CATALOGUE) {
      if (ORIGINAL.includes(slug)) continue;
      const r = find(app, slug);
      if (r) app.delete(r);
    }
    ORIGINAL.forEach((slug, i) => {
      const r = find(app, slug);
      if (!r) return;
      r.set('order', i + 1);
      r.set('featured', false);
      app.save(r);
    });
    const projects = app.findCollectionByNameOrId('projects');
    for (const name of ['type', 'kind', 'mons']) projects.fields.removeByName(name);
    app.save(projects);
  },
);
