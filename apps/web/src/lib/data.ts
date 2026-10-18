// Couche de données publique (SSR). Toute lecture PocketBase passe ici :
// - les erreurs réseau ne cassent jamais la page : valeur de repli + log + `locals.degraded = true` ;
// - les entrées utilisateur passent exclusivement par `pb.filter()` (liaison de paramètres).
import type { MediaRef } from '@nd/markdown';
import type { Category, Media, Post, Project, Site, Tag } from '@nd/pb-types';
import { ClientResponseError } from 'pocketbase';
import { fileUrl, isNotFound, PUBLISHED_FILTER, serverPb } from './pb';

export type Lookup<T> = { state: 'ok'; value: T } | { state: 'missing' } | { state: 'down' };

export interface ListResult<T> {
  page: number;
  perPage: number;
  totalItems: number;
  totalPages: number;
  items: T[];
}

/** Entrée de l'index chronologique des billets publiés (sert aux identifiants LOG et au précédent/suivant). */
export interface LogEntry {
  id: string;
  slug: string;
  title: string;
  published_at: string;
  /** Rang 1-based dans l'ordre de publication (published_at puis created, croissant). */
  no: number;
}

export const PER_PAGE = 12;

const LIST_FIELDS = [
  'id',
  'collectionId',
  'collectionName',
  'slug',
  'title',
  'excerpt',
  'cover',
  'published_at',
  'reading_time',
  'category',
  'expand.category.name',
  'expand.category.slug',
].join(',');

function message(err: unknown): string {
  if (err instanceof ClientResponseError) {
    const orig = err.originalError as { cause?: { code?: string }; message?: string } | undefined;
    const detail = err.isAbort ? 'délai dépassé' : (orig?.cause?.code ?? orig?.message ?? err.message);
    return `HTTP ${err.status} — ${detail}`;
  }
  if (err instanceof Error) return err.message;
  return String(err);
}

export function createData(locals: App.Locals) {
  const pb = serverPb();

  function fail(label: string, err: unknown): void {
    locals.degraded = true;
    console.error(`[pb] ${label} indisponible : ${message(err)}`);
  }

  async function safe<T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      fail(label, err);
      return fallback;
    }
  }

  async function lookup<T>(label: string, fn: () => Promise<T>): Promise<Lookup<T>> {
    try {
      return { state: 'ok', value: await fn() };
    } catch (err) {
      if (isNotFound(err)) return { state: 'missing' };
      fail(label, err);
      return { state: 'down' };
    }
  }

  const bySlug = (slug: string) => pb.filter('slug = {:slug}', { slug });

  return {
    site: () =>
      safe<Site | null>(
        'site',
        () =>
          pb
            .collection('site')
            .getList(1, 1)
            .then((r) => r.items[0] ?? null),
        null,
      ),

    projects: () =>
      safe<Project[]>('projects', () => pb.collection('projects').getFullList({ sort: 'order,created' }), []),

    project: (slug: string) =>
      lookup<Project>('project', () => pb.collection('projects').getFirstListItem(bySlug(slug))),

    categories: () =>
      safe<Category[]>(
        'categories',
        () => pb.collection('categories').getFullList({ sort: 'order,name' }),
        [],
      ),

    tags: () => safe<Tag[]>('tags', () => pb.collection('tags').getFullList({ sort: 'name' }), []),

    category: (slug: string) =>
      lookup<Category>('category', () => pb.collection('categories').getFirstListItem(bySlug(slug))),

    tag: (slug: string) => lookup<Tag>('tag', () => pb.collection('tags').getFirstListItem(bySlug(slug))),

    /** Index chronologique de tous les billets publiés (champs légers). */
    logIndex: async (): Promise<LogEntry[]> => {
      const rows = await safe(
        'posts (index)',
        () =>
          pb.collection('posts').getFullList({
            filter: PUBLISHED_FILTER,
            sort: 'published_at,created',
            fields: 'id,slug,title,published_at',
          }),
        [] as Post[],
      );
      return rows.map((p, i) => ({
        id: p.id,
        slug: p.slug,
        title: p.title,
        published_at: p.published_at,
        no: i + 1,
      }));
    },

    /**
     * Billets publiés, du plus récent au plus ancien.
     * `where` : filtre PocketBase supplémentaire déjà construit avec `pb.filter()`.
     */
    posts: (opts: { page?: number; perPage?: number; where?: (f: typeof pb.filter) => string } = {}) => {
      const page = Math.max(1, opts.page ?? 1);
      const perPage = opts.perPage ?? PER_PAGE;
      const extra = opts.where?.(pb.filter.bind(pb));
      const filter = extra ? `(${PUBLISHED_FILTER}) && (${extra})` : PUBLISHED_FILTER;
      return safe<ListResult<Post>>(
        'posts',
        () =>
          pb.collection('posts').getList(page, perPage, {
            filter,
            sort: '-published_at,-created',
            expand: 'category',
            fields: LIST_FIELDS,
          }),
        { page, perPage, totalItems: 0, totalPages: 0, items: [] },
      );
    },

    post: (slug: string) =>
      lookup<Post>('post', () =>
        pb
          .collection('posts')
          .getFirstListItem(`(${PUBLISHED_FILTER}) && (${bySlug(slug)})`, { expand: 'category,tags' }),
      ),

    /** Charge en une requête les médias référencés par `media:<id>`. */
    media: async (ids: string[]): Promise<Map<string, MediaRef>> => {
      const map = new Map<string, MediaRef>();
      if (ids.length === 0) return map;
      const params: Record<string, string> = {};
      const clauses = ids.map((id, i) => {
        params[`id${i}`] = id;
        return `id = {:id${i}}`;
      });
      const rows = await safe<Media[]>(
        'media',
        () => pb.collection('media').getFullList({ filter: pb.filter(clauses.join(' || '), params) }),
        [],
      );
      for (const m of rows) map.set(m.id, toMediaRef(m));
      return map;
    },
  };
}

export type Data = ReturnType<typeof createData>;

export function toMediaRef(m: Media): MediaRef {
  const c = m.collectionName || 'media';
  return {
    id: m.id,
    url: fileUrl(c, m.id, m.file),
    thumbs: {
      480: fileUrl(c, m.id, m.file, '480x0'),
      960: fileUrl(c, m.id, m.file, '960x0'),
      1920: fileUrl(c, m.id, m.file, '1920x0'),
    },
    alt: m.alt,
    caption: m.caption,
    width: m.width,
    height: m.height,
  };
}

/** Numéro LOG d'un billet d'après l'index chronologique (undefined si inconnu). */
export function logNo(index: LogEntry[], id: string): number | undefined {
  return index.find((e) => e.id === id)?.no;
}

/** Lit `?page=` (entier ≥ 1). */
export function pageParam(url: URL): number {
  const n = Number.parseInt(url.searchParams.get('page') ?? '1', 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 9999) : 1;
}
