// Formatages partagés (FR, fuseau Europe/Brussels).

export const TZ = 'Europe/Brussels';
export const PH = '[…]';

export function pad(n: number, width = 3): string {
  return String(n).padStart(width, '0');
}

/**
 * Identifiant LOG d'un billet : `LOG-` + rang de publication sur 3 chiffres.
 * Le rang est la position du billet dans l'ordre chronologique des billets publiés
 * (published_at croissant, puis created) — voir `logIndex()` dans `data.ts`.
 */
export function logId(no: number | undefined): string {
  return no ? `LOG-${pad(no)}` : `LOG-${PH}`;
}

export function projectId(i: number): string {
  return `P-${pad(i + 1)}`;
}

function valid(iso: string | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso.replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? null : d;
}

const LONG = new Intl.DateTimeFormat('fr-BE', { dateStyle: 'long', timeZone: TZ });
const SHORT = new Intl.DateTimeFormat('fr-BE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: TZ,
});

/** « 18 octobre 2026 » */
export function dateLong(iso: string | undefined): string {
  const d = valid(iso);
  return d ? LONG.format(d) : PH;
}

/** « 18.10.2026 » */
export function dateShort(iso: string | undefined): string {
  const d = valid(iso);
  return d ? SHORT.format(d).replace(/\//g, '.') : PH;
}

export function isoDate(iso: string | undefined): string {
  return valid(iso)?.toISOString() ?? '';
}

export function rfc822(iso: string | undefined): string {
  return (valid(iso) ?? new Date(0)).toUTCString();
}

const HMS = new Intl.DateTimeFormat('fr-BE', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
  timeZone: TZ,
});
const ZONE = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, timeZoneName: 'short' });

/** Horloge de la barre de télémétrie, rendue côté serveur. */
export function clock(now = new Date()): { iso: string; hms: string; zone: string } {
  const zone = ZONE.formatToParts(now).find((p) => p.type === 'timeZoneName')?.value ?? 'CET';
  return { iso: now.toISOString(), hms: HMS.format(now), zone };
}

/** SHA court du build (Coolify fournit `SOURCE_COMMIT`). */
export function buildSha(): string {
  const sha = process.env.SOURCE_COMMIT?.trim();
  return sha ? sha.slice(0, 7).toUpperCase() : 'DEV';
}

export function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Valeur ou placeholder. */
export function ph(v: string | undefined | null, fallback = PH): string {
  const t = v?.trim();
  return t ? t : fallback;
}
