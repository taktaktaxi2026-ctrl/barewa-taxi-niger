/**
 * Heure du Niger (UTC+1 toute l'année, sans heure d'été) et comparaisons de jours.
 * Les colonnes `date` et `time` sont des chaînes littérales : elles ne passent
 * jamais par `new Date()`.
 */

const NIGER_UTC_OFFSET_MS = 60 * 60 * 1000;

/** Jours de la semaine en français, indexés comme `Date.getUTCDay()`. */
export const FRENCH_DAYS = [
  'Dimanche',
  'Lundi',
  'Mardi',
  'Mercredi',
  'Jeudi',
  'Vendredi',
  'Samedi',
] as const;

/**
 * Date dont les champs UTC portent les valeurs de l'heure locale du Niger.
 * À ne lire qu'avec les accesseurs `getUTC*`.
 */
export const nigerShifted = (isoUtc?: string | null): Date => {
  const parsed = isoUtc ? new Date(isoUtc) : new Date();
  const base = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  return new Date(base.getTime() + NIGER_UTC_OFFSET_MS);
};

const pad2 = (value: number): string => `${value}`.padStart(2, '0');

/** Heure locale du Niger au format HH:MM. */
export const nigerTimeString = (isoUtc?: string | null): string => {
  const shifted = nigerShifted(isoUtc);
  return `${pad2(shifted.getUTCHours())}:${pad2(shifted.getUTCMinutes())}`;
};

/** Date locale du Niger au format AAAA-MM-JJ. */
export const nigerDayString = (isoUtc?: string | null): string => {
  const shifted = nigerShifted(isoUtc);
  return `${shifted.getUTCFullYear()}-${pad2(shifted.getUTCMonth() + 1)}-${pad2(
    shifted.getUTCDate(),
  )}`;
};

/** Horodatage lisible en heure du Niger : « AAAA-MM-JJ HH:MM ». */
export const nigerDateTimeString = (isoUtc?: string | null): string => {
  if (isoUtc === null || isoUtc === undefined || isoUtc === '') return '';
  const parsed = new Date(isoUtc);
  if (Number.isNaN(parsed.getTime())) return String(isoUtc);
  return `${nigerDayString(isoUtc)} ${nigerTimeString(isoUtc)}`;
};

/** Nom français du jour de la semaine, en heure du Niger. */
export const nigerDayName = (isoUtc?: string | null): string =>
  FRENCH_DAYS[nigerShifted(isoUtc).getUTCDay()];

/** Minuscules sans accents ni ponctuation d'espacement, pour comparer des libellés. */
export const normalizeLabel = (value: unknown): string =>
  (typeof value === 'string' ? value : '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

/**
 * Vrai si `dayOfWeek` figure dans une liste `activeDays` séparée par des virgules,
 * comparaison insensible à la casse et aux accents.
 */
export const activeDaysInclude = (
  activeDays: unknown,
  dayOfWeek: string,
): boolean => {
  const target = normalizeLabel(dayOfWeek);
  if (!target) return true;
  const parts = (typeof activeDays === 'string' ? activeDays : '')
    .split(/[,;/]/)
    .map((part) => normalizeLabel(part))
    .filter((part) => part.length > 0);
  if (parts.length === 0) return false;
  return parts.some((part) => part === target || part.startsWith(target));
};

/** Instant ISO UTC situé `days` jours avant maintenant. */
export const isoDaysAgo = (days: number): string =>
  new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

/** Instant ISO UTC situé `hours` heures avant maintenant. */
export const isoHoursAgo = (hours: number): string =>
  new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

/** Millisecondes depuis un horodatage ISO, ou null s'il est absent/illisible. */
export const msSince = (isoUtc: unknown): number | null => {
  if (typeof isoUtc !== 'string' || !isoUtc) return null;
  const parsed = new Date(isoUtc);
  if (Number.isNaN(parsed.getTime())) return null;
  return Date.now() - parsed.getTime();
};
