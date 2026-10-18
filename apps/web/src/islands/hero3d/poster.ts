/**
 * Instant figé du hero, partagé par le poster statique (assets/3d/render-poster.mjs), les relevés HUD
 * affichés avant WebGL et le premier frame live (la boucle démarre à POSTER_TIME : pas de saut au fondu).
 */
export const POSTER_TIME = 1.6;

export const deg = (rad: number): string =>
  (((((rad * 180) / Math.PI) % 360) + 360) % 360).toFixed(1).padStart(5, '0');
export const rotY = (t: number, rx = 0): number => t * 0.16 + rx * 0.55;
export const sweepAt = (t: number): number => Math.sin(t * 0.7) * 1.4;
export const fmtSweep = (s: number): string => (s >= 0 ? '+' : '') + s.toFixed(2);

export const POSTER_READOUT = {
  rot: `${deg(rotY(POSTER_TIME))}° / ${deg(0)}°`,
  sweep: fmtSweep(sweepAt(POSTER_TIME)),
};

/**
 * Variantes du poster, rendues à DPR 1.5 (cellule de trame 3 px) :
 * bureau = cadre large (le recadrage `cover` ne coupe alors que les côtés, comme la caméra live à FOV vertical fixe),
 * mobile = portrait < 600 px CSS (caméra reculée comme en live).
 */
export const POSTER_DPR = 1.5;
export const POSTERS = {
  desktop: { file: 'hero', cssWidth: 1280, cssHeight: 520 },
  mobile: { file: 'hero-m', cssWidth: 480, cssHeight: 720 },
} as const;
