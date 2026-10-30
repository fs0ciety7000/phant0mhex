// Projets côté public : image de carte et filtres du catalogue.
import type { Project, ProjectType } from '@nd/pb-types';
import { fileUrl } from './pb';

/** Captures livrées avec le site (apps/web/public/projets/<slug>.webp, 960×600). */
const SHOTS = new Set([
  'aether',
  'arbre',
  'arcade-cardor',
  'cardor-apps',
  'carillon',
  'carillon-collectif',
  'carte-de-mons',
  'chambre-noire',
  'chronoflore',
  'clearance',
  'cosmic-empires',
  'echo-trace',
  'fuel-x',
  'kernel-panic',
  'le-reseau',
  'liseuse-cardor',
  'lumecon',
  'meridian',
  'meurtre-au-beffroi',
  'mot-du-doudou',
  'occ-deliveries',
  'portico',
  'poste-aiguillage',
  'privatix',
  'quiz-du-doudou',
  'sites-evenements',
  'space-invador',
  'startx',
  'taupe',
  'vitrine-express',
]);

/** Image de carte : la couverture envoyée dans l'admin d'abord, sinon la capture livrée. */
export function projectImage(p: Project, thumb = '960x0'): string {
  if (p.cover) return fileUrl(p.collectionName, p.id, p.cover, thumb);
  return SHOTS.has(p.slug) ? `/projets/${p.slug}.webp` : '';
}

export function projectHost(p: Project): string {
  try {
    return p.url ? new URL(p.url).host : '';
  } catch {
    return '';
  }
}

export const FILTERS: { id: string; label: string; test: (p: Project) => boolean }[] = [
  { id: 'tous', label: 'Tous', test: () => true },
  { id: 'jeu', label: 'Jeux', test: (p) => p.type === 'jeu' },
  { id: 'outil', label: 'Outils et applis', test: (p) => p.type === 'outil' },
  { id: 'creation', label: 'Création', test: (p) => p.type === 'creation' },
  { id: 'mons', label: 'Ancrés à Mons', test: (p) => p.mons },
];

export const TYPE_LABEL: Record<ProjectType, string> = { jeu: 'Jeu', outil: 'Outil', creation: 'Création' };
