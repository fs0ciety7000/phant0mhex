// Types des collections PocketBase. À tenir synchronisés avec apps/pb/pb_migrations
// (voir docs/ARCHITECTURE.md §4).

export interface BaseRecord {
  id: string;
  collectionId: string;
  collectionName: string;
  created: string;
  updated: string;
}

export type PostStatus = 'draft' | 'scheduled' | 'published';

export interface Editor extends BaseRecord {
  email: string;
  emailVisibility: boolean;
  verified: boolean;
  name: string;
  avatar: string;
}

export interface Category extends BaseRecord {
  name: string;
  slug: string;
  description: string;
  order: number;
}

export interface Tag extends BaseRecord {
  name: string;
  slug: string;
}

// Visibilité publique : status = "published" && published_at <= maintenant.
// Hooks serveur : slug (si vide), reading_time, revision (+1 à chaque sauvegarde, valeur client ignorée),
// published_at = maintenant si publié sans date ; « scheduled » exige une date future et passe en
// « published » via le cron (5 min) à échéance.
export interface Post extends BaseRecord {
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  cover: string;
  category: string;
  tags: string[];
  status: PostStatus;
  published_at: string;
  reading_time: number;
  seo_title: string;
  seo_description: string;
  featured: boolean;
  revision: number;
  expand?: { category?: Category; tags?: Tag[] };
}

// width/height : calculés par le hook à l'upload (PNG, JPEG, GIF, WebP, AVIF).
export interface Media extends BaseRecord {
  file: string;
  alt: string;
  caption: string;
  width: number;
  height: number;
  post: string;
}

export interface Project extends BaseRecord {
  title: string;
  slug: string;
  role: string;
  year: string;
  url: string;
  summary: string;
  body: string;
  cover: string;
  order: number;
  featured: boolean;
}

export interface Social {
  label: string;
  url: string;
}

// Ligne unique : ni création ni suppression via l'API, seulement la mise à jour.
export interface Site extends BaseRecord {
  bio: string;
  email: string;
  socials: Social[];
  availability: string;
  base: string;
}

export interface Collections {
  editors: Editor;
  categories: Category;
  tags: Tag;
  posts: Post;
  media: Media;
  projects: Project;
  site: Site;
}

export const MEDIA_THUMBS = ['480x0', '960x0', '1920x0'] as const;
