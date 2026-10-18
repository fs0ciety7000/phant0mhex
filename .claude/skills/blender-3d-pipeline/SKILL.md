---
name: blender-3d-pipeline
description: Produire, exporter et optimiser les assets 3D (Blender → GLB → gltf-transform) et les posters statiques du hero ; intégrer dans l'îlot Three.js avec la passe de dithering.
---

# Pipeline 3D

## Sources

`assets/3d/*.blend` (Git LFS). Échelle : 1 unité = 1 m, origine au centre, Y vers le haut à l'export.

## Export (headless)

```bash
blender -b assets/3d/hero.blend -P assets/3d/export_glb.py -- --out apps/web/public/models/hero.glb
pnpm dlx @gltf-transform/cli optimize apps/web/public/models/hero.glb apps/web/public/models/hero.glb \
  --compress meshopt --texture-compress ktx2
blender -b assets/3d/hero.blend -P assets/3d/render_poster.py -- --out apps/web/public/posters/hero.png
```

Le poster est rendu en Cycles puis tramé (Bayer 8×8, 1-bit) pour être visuellement identique au rendu WebGL.

## Budgets

GLB ≤ 400 Ko, ≤ 50 k triangles, textures ≤ 1024² ; îlot JS ≤ 180 Ko gz.

## Intégration

- Îlot `apps/web/src/islands/hero3d` en `client:visible`, poster `<img>` affiché d'abord.
- `GLTFLoader` + `MeshoptDecoder` + `KTX2Loader`.
- Passe `DitherPass` (`postprocessing`) : uniformes `uLevels`, `uFg` (`#EAEAEA`), `uAccent` (`#FF2A2A`), `uBg` (`#0B0B0B`).
- Boucle de rendu suspendue hors écran et onglet caché ; DPR ≤ 1.5 ; `prefers-reduced-motion` → pas de chargement WebGL.
