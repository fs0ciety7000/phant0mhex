import type { Collections } from '@nd/pb-types';
import PocketBase, { type RecordService } from 'pocketbase';

export interface TypedPocketBase extends PocketBase {
  collection<K extends keyof Collections>(name: K): RecordService<Collections[K]>;
}

/** URL publique (navigateur, URLs de fichiers). */
export const PUBLIC_PB_URL =
  import.meta.env.PUBLIC_PB_URL ?? process.env.PUBLIC_PB_URL ?? 'http://localhost:8090';

/** Client serveur : réseau interne Docker si disponible. Une instance par requête (pas d'état partagé). */
export function serverPb(): TypedPocketBase {
  const url = process.env.PB_INTERNAL_URL ?? PUBLIC_PB_URL;
  const pb = new PocketBase(url) as TypedPocketBase;
  pb.autoCancellation(false);
  return pb;
}

export function fileUrl(collection: string, recordId: string, filename: string, thumb?: string): string {
  if (!filename) return '';
  const q = thumb ? `?thumb=${thumb}` : '';
  return `${PUBLIC_PB_URL}/api/files/${collection}/${recordId}/${filename}${q}`;
}

/** Filtre public des billets visibles (doublé côté règles PocketBase). */
export const PUBLISHED_FILTER = 'status = "published" && published_at <= @now';
