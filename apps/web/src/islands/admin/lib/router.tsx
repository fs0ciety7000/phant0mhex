// Routeur minimal sur l'History API (pas de dépendance) : la SPA a ~10 routes plates.
import { type AnchorHTMLAttributes, type MouseEvent, useSyncExternalStore } from 'react';

export const BASE = '/admin';

const listeners = new Set<() => void>();

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  window.addEventListener('popstate', cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener('popstate', cb);
  };
}

export function navigate(to: string, opts: { replace?: boolean } = {}): void {
  const url = to.startsWith('/') ? to : `${BASE}/${to}`;
  if (url === location.pathname + location.search) return;
  history[opts.replace ? 'replaceState' : 'pushState'](null, '', url);
  for (const l of listeners) l();
  if (!opts.replace) window.scrollTo(0, 0);
}

const getPath = () => location.pathname;
const getSearch = () => location.search;

export function usePathname(): string {
  return useSyncExternalStore(subscribe, getPath, getPath);
}

export function useSearch(): URLSearchParams {
  const s = useSyncExternalStore(subscribe, getSearch, getSearch);
  return new URLSearchParams(s);
}

/** Met à jour la query string (filtres de liste) sans empiler d'historique. */
export function setSearch(patch: Record<string, string | number | null | undefined>): void {
  const p = new URLSearchParams(location.search);
  for (const [k, v] of Object.entries(patch)) {
    if (v === null || v === undefined || v === '') p.delete(k);
    else p.set(k, String(v));
  }
  const q = p.toString();
  navigate(`${location.pathname}${q ? `?${q}` : ''}`, { replace: true });
}

/** `match('/billets/:id', '/billets/abc')` → `{ id: 'abc' }`. Chemins relatifs à BASE. */
export function match(pattern: string, path: string): Record<string, string> | null {
  const a = pattern.split('/').filter(Boolean);
  const b = path.split('/').filter(Boolean);
  if (a.length !== b.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < a.length; i++) {
    const p = a[i] as string;
    const v = b[i] as string;
    if (p.startsWith(':')) params[p.slice(1)] = decodeURIComponent(v);
    else if (p !== v) return null;
  }
  return params;
}

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & { to: string };

export function Link({ to, onClick, ...rest }: LinkProps) {
  const href = to.startsWith('/') ? to : `${BASE}/${to}`;
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(href);
  };
  return <a href={href} onClick={handle} {...rest} />;
}
