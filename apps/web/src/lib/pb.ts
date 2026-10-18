import type { Collections } from '@nd/pb-types';
import { MEDIA_THUMBS } from '@nd/pb-types';
import PocketBase, { ClientResponseError, type RecordService } from 'pocketbase';

export interface TypedPocketBase extends PocketBase {
  collection<K extends keyof Collections>(name: K): RecordService<Collections[K]>;
}

/** URL publique (navigateur, URLs de fichiers). */
export const PUBLIC_PB_URL =
  import.meta.env.PUBLIC_PB_URL ?? process.env.PUBLIC_PB_URL ?? 'http://localhost:8090';

/** Délai max d'une requête PocketBase côté serveur : le site doit répondre même si PB est injoignable. */
const PB_TIMEOUT_MS = 2500;

/** Client serveur : réseau interne Docker si disponible. Une instance par requête (pas d'état partagé). */
export function serverPb(): TypedPocketBase {
  const url = process.env.PB_INTERNAL_URL ?? PUBLIC_PB_URL;
  const pb = new PocketBase(url) as TypedPocketBase;
  pb.autoCancellation(false);
  pb.beforeSend = (reqUrl, options) => ({
    url: reqUrl,
    options: { ...options, signal: options.signal ?? AbortSignal.timeout(PB_TIMEOUT_MS) },
  });
  return pb;
}

export function fileUrl(collection: string, recordId: string, filename: string, thumb?: string): string {
  if (!filename) return '';
  const q = thumb ? `?thumb=${thumb}` : '';
  return `${PUBLIC_PB_URL}/api/files/${collection}/${recordId}/${filename}${q}`;
}

/** `srcset` à partir des miniatures PocketBase (480/960/1920 px de large). */
export function thumbSrcset(collection: string, recordId: string, filename: string): string {
  if (!filename) return '';
  return MEDIA_THUMBS.map((t) => `${fileUrl(collection, recordId, filename, t)} ${t.split('x')[0]}w`).join(
    ', ',
  );
}

/** Origine de PocketBase (pour la CSP). */
export function pbOrigin(): string {
  try {
    return new URL(PUBLIC_PB_URL).origin;
  } catch {
    return '';
  }
}

export function isNotFound(err: unknown): boolean {
  return err instanceof ClientResponseError && err.status === 404;
}

/** Filtre public des billets visibles (doublé côté règles PocketBase). */
export const PUBLISHED_FILTER = 'status = "published" && published_at != "" && published_at <= @now';
