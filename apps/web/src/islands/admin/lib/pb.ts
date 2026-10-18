import type { Media, Post } from '@nd/pb-types';
import PocketBase, { ClientResponseError } from 'pocketbase';
import { createContext, useContext } from 'react';
import type { TypedPocketBase } from '../../../lib/pb';

export type { TypedPocketBase };

export function createPb(url: string): TypedPocketBase {
  const pb = new PocketBase(url) as TypedPocketBase;
  // TanStack Query gère la déduplication : pas d'annulation automatique du SDK.
  pb.autoCancellation(false);
  return pb;
}

export const PbContext = createContext<TypedPocketBase | null>(null);

export function usePb(): TypedPocketBase {
  const pb = useContext(PbContext);
  if (!pb) throw new Error('PbContext manquant');
  return pb;
}

export function fileUrl(
  pb: TypedPocketBase,
  record: Pick<Post | Media, 'id' | 'collectionId' | 'collectionName'>,
  filename: string,
  thumb?: string,
): string {
  if (!filename) return '';
  return pb.files.getURL(record as unknown as { [key: string]: unknown }, filename, thumb ? { thumb } : {});
}

/** Message d'erreur lisible (erreurs de champs PocketBase incluses). */
export function errorMessage(e: unknown): string {
  if (e instanceof ClientResponseError) {
    const data = (e.response?.data ?? {}) as Record<string, { message?: string }>;
    const fields = Object.entries(data)
      .map(([k, v]) => `${k} : ${v?.message ?? 'invalide'}`)
      .join(' · ');
    if (e.status === 0) return 'Serveur injoignable.';
    return fields || e.response?.message || e.message;
  }
  return e instanceof Error ? e.message : String(e);
}
