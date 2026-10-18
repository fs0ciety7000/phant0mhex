import type { MediaRef } from '@nd/markdown';
import { type Media, MEDIA_THUMBS } from '@nd/pb-types';
import { fileUrl, type TypedPocketBase } from './pb';

export const MAX_UPLOAD = 15 * 1024 * 1024;

/** Cache partagé des médias connus (liste, uploads, résolutions par id) pour l'aperçu. */
const cache = new Map<string, Media>();
const notFound = new Set<string>();
const subs = new Set<() => void>();
let version = 0;

export function rememberMedia(...items: Media[]): void {
  if (!items.length) return;
  for (const m of items) {
    cache.set(m.id, m);
    notFound.delete(m.id);
  }
  version++;
  for (const s of subs) s();
}
export function forgetMedia(id: string): void {
  cache.delete(id);
  version++;
  for (const s of subs) s();
}
export function getCachedMedia(id: string): Media | undefined {
  return cache.get(id);
}
export function mediaVersion(): number {
  return version;
}
export function subscribeMedia(cb: () => void): () => void {
  subs.add(cb);
  return () => {
    subs.delete(cb);
  };
}

export function toMediaRef(pb: TypedPocketBase, m: Media): MediaRef {
  const thumbs: Record<number, string> = {};
  for (const t of MEDIA_THUMBS) thumbs[Number.parseInt(t, 10)] = fileUrl(pb, m, m.file, t);
  return {
    id: m.id,
    url: fileUrl(pb, m, m.file),
    thumbs,
    alt: m.alt,
    caption: m.caption,
    width: m.width,
    height: m.height,
  };
}

/** Charge dans le cache les ids encore inconnus. */
export async function loadMissingMedia(pb: TypedPocketBase, ids: string[]): Promise<void> {
  const missing = ids.filter((id) => !cache.has(id) && !notFound.has(id) && /^[a-z0-9]{15}$/.test(id));
  if (!missing.length) return;
  const filter = missing.map((id) => pb.filter('id = {:id}', { id })).join(' || ');
  const items = await pb.collection('media').getFullList({ filter });
  const found = new Set(items.map((m) => m.id));
  for (const id of missing) if (!found.has(id)) notFound.add(id);
  rememberMedia(...items);
}

export function mediaSnippet(m: Pick<Media, 'id' | 'alt'>): string {
  return `![${cleanAlt(m.alt)}](media:${m.id})`;
}

export function cleanAlt(s: string): string {
  return s.replace(/[[\]\n\r]/g, ' ').trim();
}

export function altFromFilename(name: string): string {
  return name
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function validateImage(file: File): string | null {
  if (!file.type.startsWith('image/')) return `« ${file.name} » n'est pas une image.`;
  if (file.size > MAX_UPLOAD) return `« ${file.name} » dépasse 15 Mo.`;
  return null;
}

export async function imageSize(file: File): Promise<{ width: number; height: number }> {
  try {
    const bmp = await createImageBitmap(file);
    const r = { width: bmp.width, height: bmp.height };
    bmp.close();
    return r;
  } catch {
    // SVG et formats non décodables par createImageBitmap : repli sur <img>.
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
        URL.revokeObjectURL(url);
      };
      img.onerror = () => {
        resolve({ width: 0, height: 0 });
        URL.revokeObjectURL(url);
      };
      img.src = url;
    });
  }
}

export interface UploadMeta {
  alt: string;
  caption: string;
  width: number;
  height: number;
  post?: string;
}

/** Upload via XHR (le SDK s'appuie sur fetch, sans progression d'envoi). */
export function uploadMedia(
  pb: TypedPocketBase,
  file: File,
  meta: UploadMeta,
  onProgress?: (pct: number) => void,
): Promise<Media> {
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('alt', meta.alt);
    fd.append('caption', meta.caption);
    fd.append('width', String(meta.width));
    fd.append('height', String(meta.height));
    if (meta.post) fd.append('post', meta.post);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', pb.buildURL('/api/collections/media/records'));
    if (pb.authStore.token) xhr.setRequestHeader('Authorization', pb.authStore.token);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(Math.min(99, Math.round((e.loaded / e.total) * 100)));
    };
    xhr.onload = () => {
      let body: { message?: string; data?: Record<string, { message?: string }> } & Partial<Media> = {};
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        /* réponse non JSON */
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        const rec = body as Media;
        rememberMedia(rec);
        resolve(rec);
      } else {
        const fields = Object.entries(body.data ?? {})
          .map(([k, v]) => `${k} : ${v?.message ?? 'invalide'}`)
          .join(' · ');
        reject(new Error(fields || body.message || `Échec de l'envoi (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error('Serveur injoignable.'));
    xhr.send(fd);
  });
}
