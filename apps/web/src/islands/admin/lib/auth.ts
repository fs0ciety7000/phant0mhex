import type { Editor } from '@nd/pb-types';
import { useCallback, useSyncExternalStore } from 'react';
import type { TypedPocketBase } from './pb';

export function currentEditor(pb: TypedPocketBase): Editor | null {
  const r = pb.authStore.record;
  if (!pb.authStore.isValid || !r || r.collectionName !== 'editors') return null;
  return r as unknown as Editor;
}

/** Éditeur connecté, réactif aux changements de l'authStore du SDK (localStorage). */
export function useEditor(pb: TypedPocketBase): Editor | null {
  const subscribe = useCallback((cb: () => void) => pb.authStore.onChange(cb), [pb]);
  const snap = useCallback(() => {
    const e = currentEditor(pb);
    return e ? `${e.id}|${pb.authStore.token}` : '';
  }, [pb]);
  const key = useSyncExternalStore(subscribe, snap, snap);
  return key ? currentEditor(pb) : null;
}
