import { map } from 'nanostores';

/**
 * État partagé du hero (remplace `window.__hero` du prototype).
 * - `scroll` : progression 0→1 du bloc hero (haut du hero au haut de l'écran → bas du hero au haut de l'écran).
 * - `mx`, `my` : position du pointeur normalisée en -1…1 (centre = 0).
 * Écrit par l'îlot motion, lu à chaque frame par l'îlot hero3d via `heroState.get()`.
 */
export interface HeroState {
  scroll: number;
  mx: number;
  my: number;
}

export const heroState = map<HeroState>({ scroll: 0, mx: 0, my: 0 });
