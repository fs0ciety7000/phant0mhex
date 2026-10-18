# Design system ND-01 — Tactical Telemetry

Archétype unique : **Tactical Telemetry / CRT** (substrat sombre). On ne mélange jamais avec le mode « Swiss Print » clair.
Règles complètes : skill `.claude/skills/industrial-brutalist-ui`. Ce fichier fixe les valeurs du projet.

## Tokens

| Token | Valeur | Usage |
|---|---|---|
| `--bg` | `#0B0B0B` | fond (jamais `#000`) |
| `--surface` | `#121212` | blocs de code, encarts |
| `--line` | `#2A2A2A` | bordures 1px, gaps de grille |
| `--muted` | `#8C8C8C` | métadonnées (6.1:1 sur `--bg`) |
| `--fg` | `#EAEAEA` | texte |
| `--accent` | `#FF2A2A` | **seul** accent : IDs, CTA, numéros de section, progression |
| `--ok` | `#4AF626` | **un seul** élément : le voyant « SYS ONLINE » |

Rayon : `0` partout. Pas de dégradé décoratif, pas d'ombre douce, pas de transparence « glass ». Autorisés : scanlines (`repeating-linear-gradient`), trame halftone, bandes d'alerte, bruit SVG.

## Typographie

| Rôle | Police | Réglages |
|---|---|---|
| Macro (titres) | Archivo Black | `clamp(2.6rem, 10.4vw, 12.5rem)` (token `--fs-macro` : « DESSENIUS » tient sur une ligne à 375 px), interlignage 0.86, approche −0.045em, CAPITALES |
| H2 | Archivo Black | 30px, 1, −0.02em, CAPITALES, préfixe rouge `01 /` |
| Micro (méta, nav) | JetBrains Mono | 11px, 1.3, +0.1em, CAPITALES |
| Corps (billets) | JetBrains Mono | 15px, 1.75, mesure ≤ 68ch ; bascule lecteur SANS (IBM Plex Sans, `.md-prose--sans`) mémorisée |
| Disruption | EB Garamond italique | rarissime, idéalement tramé en WebGL |

## Grammaire

- Sections numérotées `[00]…[04]`, cadres ASCII `[ … ]`, `< … >`, flèches `>>>`, `///`.
- Grilles : `display:grid; gap:1px; background:var(--line)` pour des filets parfaits.
- Marqueurs `® © ™ +` comme éléments graphiques ; chaînes de télémétrie (`REV 0.1`, `UNIT / ND-01`, `50.85N / 4.35E`).
- Pas de faux chiffres sur la personne : ce qui n'est pas fourni reste un placeholder `[…]`.

## Motion

- Intro : séquence de boot (lignes terminal) → titre en *slam-in* lettre par lettre (`steps()`).
- Survol nav/liens : *glyph scramble* 300 ms.
- Révélations au scroll (ScrollTrigger), lignes de grille qui se tracent.
- Transitions de page : wipe CRT (View Transitions).
- `prefers-reduced-motion` : tout désactiver.

## Maquettes

Canvas d'ébauche : https://claude.ai/artifact/VF9HycNHqwJHiM8K6YDb6e (Accueil, Billet, Admin, Système).
Prototype motion/3D : https://claude.ai/artifact/4fZYzauP2HUCLJWdTrw96V — source dans `prototypes/motion-lab/index.html`.
