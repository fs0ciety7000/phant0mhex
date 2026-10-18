import type { Category, Tag } from '@nd/pb-types';
import { useQuery } from '@tanstack/react-query';
import { usePb } from './pb';

export const qk = {
  posts: ['posts'] as const,
  post: (id: string) => ['post', id] as const,
  categories: ['categories'] as const,
  tags: ['tags'] as const,
  media: ['media'] as const,
  projects: ['projects'] as const,
  project: (id: string) => ['project', id] as const,
  site: ['site'] as const,
};

export function useCategories() {
  const pb = usePb();
  return useQuery<Category[]>({
    queryKey: qk.categories,
    queryFn: () => pb.collection('categories').getFullList({ sort: 'order,name' }),
  });
}

export function useTags() {
  const pb = usePb();
  return useQuery<Tag[]>({
    queryKey: qk.tags,
    queryFn: () => pb.collection('tags').getFullList({ sort: 'name' }),
  });
}

/** Renumérote `order` (1..n) après un déplacement ; ne PATCH que les lignes modifiées. */
export function reorder<T extends { id: string; order: number }>(
  list: T[],
  index: number,
  dir: -1 | 1,
): { id: string; order: number }[] {
  const j = index + dir;
  if (j < 0 || j >= list.length) return [];
  const next = [...list];
  const a = next[index] as T;
  next[index] = next[j] as T;
  next[j] = a;
  return next.map((x, i) => ({ id: x.id, order: i + 1, prev: x.order })).filter((x) => x.order !== x.prev);
}
