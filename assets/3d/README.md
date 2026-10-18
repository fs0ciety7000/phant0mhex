# assets/3d — hero 3D

## État actuel : monolithe procédural

Le monolithe du hero est **procédural** (pas de Blender dans l'environnement actuel) :
`apps/web/src/islands/hero3d/HeroMonolith.ts` construit une `BoxGeometry` 1.12 × 2.52 × 0.28 (dalle 1:4:9),
un anneau de 180 points (PRNG à graine fixe, identique entre poster et live), un cube satellite, une grille
au sol, plus deux `ShaderMaterial` (`shaders.ts`) :

1. scène → render target, **R = luminance**, **G = masque accent** (arêtes blanches par détection en espace objet,
   bande de balayage rouge) ;
2. passe plein écran : tramage ordonné **Bayer 8×8 1-bit**, `#EAEAEA` / `#FF2A2A` sur `#0B0B0B`,
   cellule de `2 × DPR` pixels. `ColorManagement` désactivé, sortie linéaire : les hex sortent exacts.

La passe de post est faite à la main (≈ 30 lignes de GLSL) plutôt qu'avec `postprocessing` : plus léger, et
on contrôle exactement les canaux du render target.

## Posters statiques

```bash
node assets/3d/render-poster.mjs
```

Construit `assets/3d/poster/` avec le Vite d'Astro, exécute **le même module** `HeroMonolith.ts` en Chromium
headless (SwiftShader), figé à `POSTER_TIME` (la boucle live démarre à ce même instant, donc pas de saut au
fondu), puis encode avec le sharp d'Astro (PNG palette 2 bits + WebP sans perte). Aucune dépendance ajoutée,
aucun accès réseau. Variables : `CHROMIUM` (défaut `/opt/pw-browsers/chromium`), `OUT_DIR`.

| Fichier | Taille | Usage |
|---|---|---|
| `apps/web/public/posters/hero.{png,webp}` | 1920×780 | bureau (cadre large : `object-fit: cover` ne recadre que les côtés, comme la caméra live à FOV vertical fixe) |
| `apps/web/public/posters/hero-m.{png,webp}` | 720×1080 | viewport < 600 px (caméra reculée à z = 8.2 comme en live) |

À relancer après toute modification de la scène, des shaders ou de `poster.ts`.

## Brancher plus tard un GLB Blender

1. Modéliser dans `assets/3d/hero.blend` (Git LFS) : 1 unité = 1 m, origine au centre, Y vers le haut.
   Garder la dalle 1.12 × 2.52 × 0.28 si l'on veut conserver la détection d'arêtes en espace objet
   (`uHalf`) ; sinon remplacer par un attribut d'arêtes (vertex color ou UV2) ou une passe de contours.
2. Exporter : `blender -b assets/3d/hero.blend -P assets/3d/export_glb.py -- --out apps/web/public/models/hero.glb`
   (**script squelette non testé** : aucun Blender n'était disponible pour le valider).
3. Optimiser : `pnpm dlx @gltf-transform/cli optimize apps/web/public/models/hero.glb apps/web/public/models/hero.glb --compress meshopt`
   (budget : ≤ 400 Ko, ≤ 50 k triangles, textures ≤ 1024²).
4. Dans `HeroMonolith.ts`, remplacer la `BoxGeometry` par le chargement (toujours dans le chunk dynamique) :

   ```ts
   import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
   import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

   const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
   const gltf = await loader.loadAsync('/models/hero.glb');
   gltf.scene.traverse((o) => { if ((o as Mesh).isMesh) (o as Mesh).material = monoMat; });
   rig.add(gltf.scene);
   ```

   Le matériau doit rester celui de la passe 1 (R = luminance, G = accent) pour que la trame fonctionne.
   Rendre le poster une fois le GLB chargé (attendre la promesse avant `onFirstFrame`), puis relancer
   `render-poster.mjs`. Vérifier le budget du chunk 3D (≤ 180 Ko gz ; GLTFLoader + Meshopt ≈ +25 Ko gz).
