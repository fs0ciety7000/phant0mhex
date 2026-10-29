/// <reference path="../pb_data/types.d.ts" />
// Premier billet du journal : le remplacement du monolithe du hero par le Beffroi de Mons.
// Les champs normalement calculés par les hooks (slug, reading_time, revision, published_at)
// sont posés ici : les hooks ne tournent pas forcément pendant les migrations.
// Idempotent : ne fait rien si un billet porte déjà ce slug.

const SLUG = 'le-monolithe-devient-beffroi';
const F = '```';

const BODY = `Jusqu’ici, le hero de ce site montrait une dalle noire aux proportions 1:4:9, entourée d’un anneau de points et d’un petit cube en orbite. Une référence assumée, un bel objet, mais muet : il ne disait rien de ce que je fais ni d’où je le fais. Je l’ai remplacé par une silhouette du **Beffroi de Mons**, la tour baroque du XVIIe siècle qui domine la ville et que l’UNESCO a inscrite avec les beffrois de Belgique et de France.

Ce billet raconte comment, sans Blender et sans modèle importé : une géométrie procédurale de quelques dizaines de lignes, un shader d’éclairage plat et le même tramage 1-bit qu’avant.

## La contrainte : un rendu en deux passes

La scène ne s’affiche jamais telle quelle. Elle est d’abord rendue dans une texture où chaque canal a un rôle : **R** porte la luminance, **G** un masque d’accent. Une seconde passe plein écran transforme ensuite cette texture en image 1-bit par **tramage ordonné Bayer 8×8**, avec trois couleurs en tout : le fond, le phosphore et le rouge d’accent.

${F}glsl
float b2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
float b4(vec2 a) { return b2(0.5 * a) * 0.25 + b2(a); }
float b8(vec2 a) { return b4(0.5 * a) * 0.25 + b2(a); }
${F}

Conséquence directe : les dégradés subtils disparaissent, seules restent les grandes masses de lumière et les arêtes. Un modèle détaillé serait illisible. Il fallait une silhouette franche, facettée, qui se lise en quelques centaines de pixels allumés.

## Une tour en primitives

Le beffroi est assemblé à partir de primitives de Three.js, fusionnées en une seule géométrie :

- trois niveaux carrés en retrait, séparés par des corniches débordantes ;
- des pilastres à chaque angle et une baie en saillie au centre de chaque face ;
- quatre tourelles d’angle, chacune coiffée d’un petit bulbe et d’une aiguille ;
- un tambour octogonal, le bulbe principal, la lanterne, un second bulbe et la flèche.

Les bulbes sont des \`LatheGeometry\` : un profil (rayon, hauteur) que l’on fait tourner autour de l’axe vertical. Le profil est normalisé une fois pour toutes, puis mis à l’échelle pour chaque bulbe.

${F}ts
/** Profil de bulbe (rayon, hauteur) normalisé : base, panse, col, pointe. */
const BULB: [number, number][] = [
  [0.82, 0], [1, 0.16], [0.96, 0.36], [0.62, 0.62], [0.3, 0.84], [0.16, 1],
];

function bulb(radius: number, height: number, y: number, segments = 8) {
  const g = new LatheGeometry(
    BULB.map(([r, h]) => new Vector2(r * radius, h * height)),
    segments,
  );
  g.translate(0, y, 0);
  return g;
}
${F}

Huit segments seulement, et c’est volontaire. Un bulbe lisse à 32 segments produit des variations de luminance trop fines : la trame les transforme en bruit. À huit facettes, chaque pan reçoit un éclairage franc et la trame dessine des bandes nettes. La même logique vaut pour le tambour et les tourelles, octogonaux eux aussi.

Toutes les pièces sont fusionnées avec \`mergeGeometries\`, puis mises à l’échelle et posées sur la grille du sol. Un seul mesh, un seul draw call pour la tour.

## Des normales sans normales

L’ancien shader détectait les arêtes de la dalle en comparant la position du fragment à la demi-taille de la boîte : une astuce qui ne fonctionne que pour une boîte. Pour une géométrie quelconque, j’ai gardé l’éclairage plat calculé à partir des dérivées écran, qui donne la normale de la facette sans dépendre des normales du maillage :

${F}glsl
vec3 n = normalize(cross(dFdx(vW), dFdy(vW)));
vec3 V = normalize(uCam - vW);
if (dot(n, V) < 0.0) n = -n;
float dif = max(dot(n, normalize(vec3(-0.7, 0.8, 0.45))), 0.0);
float lum = 0.07 + 0.8 * dif;
${F}

S’y ajoutent des assises de pierre qui défilent lentement (une fine ligne claire tous les onze centièmes d’unité en hauteur) et la bande rouge du balayage vertical, écrite dans le canal G.

## Les arêtes au trait

Sans traitement, la tour se fond dans le fond dès qu’une face passe à l’ombre. Les arêtes sont donc tracées à part, avec un \`EdgesGeometry\` dont le seuil d’angle (24°) ne garde que les vraies cassures : corniches, angles, baies, facettes des bulbes.

${F}ts
const edgeGeo = new EdgesGeometry(towerGeo, 24);
const edgeMat = new LineBasicMaterial({ color: new Color(1, 0, 0) });
rig.add(new LineSegments(edgeGeo, edgeMat));
${F}

La couleur \`(1, 0, 0)\` n’est pas du rouge : dans la texture intermédiaire, elle signifie « luminance maximale, pas d’accent ». Après le tramage, ces lignes sortent en phosphore plein. Un \`polygonOffset\` sur le matériau de la tour évite que les faces ne mangent les lignes.

## Ce qui reste, ce qui part

L’anneau de points reste, recentré à hauteur de la chambre des cloches : il figure désormais le carillon. Le cube satellite part : il n’avait plus de sens autour d’une tour. La grille au sol, le balayage, les relevés du HUD (rotation, position du balayage, FPS) ne changent pas.

## Le poster, toujours généré par la vraie scène

Avant que WebGL ne démarre, et pour toute personne qui a activé la réduction des animations, le hero affiche une image statique. Elle n’est pas dessinée à part : un script construit la scène avec le Vite d’Astro, la rend dans Chromium headless à un instant figé, ramène chaque pixel à la palette de trois couleurs et écrit des PNG et WebP sans perte.

${F}bash
node assets/3d/render-poster.mjs
${F}

Le poster et la première image animée sont donc identiques au pixel près : pas de saut au moment du fondu. Les fichiers pèsent entre 2 et 3 Ko.

## Pourquoi un beffroi

Parce qu’un hero devrait dire quelque chose. Je travaille à Mons, sous la bannière de CARDOR Media, et une bonne partie de mes projets a un ancrage local assumé. Le beffroi est le repère de la ville. Rendu en 1-bit, sur une grille qui défile, il garde l’esprit « télémétrie » du site tout en ayant enfin un sujet.

La géométrie reste une approximation : les proportions sont justes à l’œil, pas au relevé. Si un jour un modèle Blender plus fidèle voit le jour, le pipeline est prêt à le charger à la place.`;

const EXCERPT =
  'Le hero du site montrait un monolithe abstrait. Il affiche désormais le Beffroi de Mons : géométrie procédurale, éclairage plat par dérivées écran et tramage Bayer 8×8.';

const TAGS = [
  { name: 'Three.js', slug: 'three-js' },
  { name: 'Shaders', slug: 'shaders' },
  { name: 'Mons', slug: 'mons' },
];

const WORDS_PER_MINUTE = 220; // miroir de pb_hooks/lib/nd.js
function readingTime(markdown) {
  const text = String(markdown || '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\]\([^)]*\)/g, ']')
    .replace(/<[^>]+>/g, ' ');
  const words = text.split(/\s+/).filter((w) => /[0-9A-Za-zÀ-ÖØ-öø-ÿ]/.test(w)).length;
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
}

const findBySlug = (app, collection, slug) => {
  try {
    return app.findFirstRecordByData(collection, 'slug', slug);
  } catch (_) {
    return null;
  }
};

migrate(
  (app) => {
    if (findBySlug(app, 'posts', SLUG)) return;

    const tagIds = TAGS.map((t) => {
      const existing = findBySlug(app, 'tags', t.slug);
      if (existing) return existing.id;
      const r = new Record(app.findCollectionByNameOrId('tags'));
      r.set('name', t.name);
      r.set('slug', t.slug);
      app.save(r);
      return r.id;
    });
    const category = findBySlug(app, 'categories', 'dev');

    const post = new Record(app.findCollectionByNameOrId('posts'));
    post.set('title', 'Le monolithe devient beffroi');
    post.set('slug', SLUG);
    post.set('excerpt', EXCERPT);
    post.set('body', BODY);
    if (category) post.set('category', category.id);
    post.set('tags', tagIds);
    post.set('status', 'published');
    post.set('published_at', new DateTime());
    post.set('reading_time', readingTime(BODY));
    post.set('revision', 1);
    post.set('seo_title', 'Le monolithe devient beffroi — un hero 3D tramé en 1-bit');
    post.set('seo_description', EXCERPT);
    post.set('featured', true);
    app.save(post);
  },
  (app) => {
    const post = findBySlug(app, 'posts', SLUG);
    if (post) app.delete(post);
    for (const t of TAGS) {
      const tag = findBySlug(app, 'tags', t.slug);
      if (!tag) continue;
      const used = app.findRecordsByFilter('posts', 'tags ~ {:id}', '', 1, 0, { id: tag.id });
      if (used.length === 0) app.delete(tag);
    }
  },
);
