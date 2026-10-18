export const TZ = 'Europe/Brussels';

export function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
}

const partsFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

/** Décalage (ms) de Europe/Brussels par rapport à UTC à l'instant donné. */
function tzOffset(ms: number): number {
  const p: Record<string, string> = {};
  for (const x of partsFmt.formatToParts(new Date(ms))) p[x.type] = x.value;
  const asUtc = Date.UTC(
    +(p.year ?? 0),
    +(p.month ?? 1) - 1,
    +(p.day ?? 1),
    +(p.hour ?? 0),
    +(p.minute ?? 0),
    +(p.second ?? 0),
  );
  return asUtc - (ms - (ms % 1000));
}

export function parsePbDate(s: string | undefined | null): Date | null {
  if (!s) return null;
  const d = new Date(s.includes('T') ? s : s.replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Date PocketBase (UTC) → valeur `datetime-local` à l'heure de Bruxelles. */
export function pbToLocalInput(s: string): string {
  const d = parsePbDate(s);
  if (!d) return '';
  return new Date(d.getTime() + tzOffset(d.getTime())).toISOString().slice(0, 16);
}

/** Valeur `datetime-local` (heure de Bruxelles) → date PocketBase UTC. */
export function localInputToPb(v: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(v);
  if (!m) return '';
  const guess = Date.UTC(
    +(m[1] as string),
    +(m[2] as string) - 1,
    +(m[3] as string),
    +(m[4] as string),
    +(m[5] as string),
  );
  let utc = guess - tzOffset(guess);
  const off2 = tzOffset(utc);
  if (guess - off2 !== utc) utc = guess - off2;
  return toPbDate(new Date(utc));
}

export function toPbDate(d: Date): string {
  return d.toISOString().replace('T', ' ');
}

const displayFmt = new Intl.DateTimeFormat('fr-BE', {
  timeZone: TZ,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatDate(s: string | undefined | null): string {
  const d = parsePbDate(s);
  return d ? displayFmt.format(d).replace(',', '') : '—';
}

export function countWords(md: string): number {
  return md.trim().split(/\s+/).filter(Boolean).length;
}

export function pad(n: number, w = 2): string {
  return String(n).padStart(w, '0');
}

/** Lecture/écriture localStorage tolérante (navigation privée, quota). */
export const store = {
  get<T>(key: string): T | null {
    try {
      const v = localStorage.getItem(key);
      return v ? (JSON.parse(v) as T) : null;
    } catch {
      return null;
    }
  },
  set(key: string, value: unknown): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* quota ou stockage bloqué : le PATCH serveur reste la source de vérité */
    }
  },
  del(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      /* idem */
    }
  },
};
