"""Export du hero en GLB (Blender, mode batch).

    blender -b assets/3d/hero.blend -P assets/3d/export_glb.py -- --out apps/web/public/models/hero.glb

SQUELETTE NON TESTÉ : aucun Blender n'était disponible pour le valider. À vérifier à la première utilisation
(noms d'options de glTF exporter selon la version de Blender).
Ensuite : gltf-transform optimize --compress meshopt (voir assets/3d/README.md).
"""

import argparse
import sys

import bpy  # type: ignore[import-not-found]


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description="Export GLB du hero")
    parser.add_argument("--out", required=True, help="chemin du .glb de sortie")
    parser.add_argument("--collection", default="EXPORT", help="collection à exporter (défaut : EXPORT)")
    return parser.parse_args(argv)


def main() -> None:
    args = parse_args()

    # Ne sélectionner que les objets de la collection d'export.
    bpy.ops.object.select_all(action="DESELECT")
    coll = bpy.data.collections.get(args.collection)
    if coll is None:
        raise SystemExit(f"collection introuvable : {args.collection}")
    for obj in coll.all_objects:
        obj.select_set(True)

    # Appliquer les transformations pour que l'origine / l'échelle (1 u = 1 m) soient propres.
    bpy.context.view_layer.objects.active = next(iter(coll.all_objects), None)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)

    bpy.ops.export_scene.gltf(
        filepath=args.out,
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_apply=True,  # applique les modificateurs
        export_normals=True,
        export_texcoords=True,
        export_materials="NONE",  # le matériau est remplacé côté web par le ShaderMaterial de la passe 1
        export_cameras=False,
        export_lights=False,
        export_animations=False,
    )
    print(f"[export_glb] écrit {args.out}")


if __name__ == "__main__":
    main()
