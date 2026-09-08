/**
 * Formatage des montants, des dates et des liens de contact pour BAREWA.
 *
 * Le Niger est à UTC+1 toute l'année (pas d'heure d'été). Les colonnes
 * `datetime` arrivent en ISO UTC : on les convertit exactement une fois, ici,
 * à la frontière d'affichage, via le fuseau Africa/Niamey. Les colonnes `date`
 * sont des chaînes littérales et ne passent jamais par `new Date`.
 */

export const NIGER_TIME_ZONE = 'Africa/Niamey';
export const CURRENCY_LABEL = 'FCFA';

/** « 2 500 FCFA » — jamais de décimale, espace insécable comme séparateur. */
export function formatFcfa(amount: number | null | undefined): string {
  const value = Math.round(Number(amount) || 0);
  return `${value.toLocaleString('fr-FR').replace(/\u202f/g, '\u00a0')}\u00a0${CURRENCY_LABEL}`;
}

/** Montant nu, sans le suffixe FCFA (pour les champs de saisie et les axes). */
export function formatAmount(amount: number | null | undefined): string {
  return Math.round(Number(amount) || 0)
    .toLocaleString('fr-FR')
    .replace(/\u202f/g, '\u00a0');
}

/** « 14:35 » — heure du Niger. */
export function formatNigerTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('fr-FR', {
    timeZone: NIGER_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** « 7 sept. 2026, 14:35 » — heure du Niger. */
export function formatNigerDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('fr-FR', {
    timeZone: NIGER_TIME_ZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** « 7 sept. 2026 » — heure du Niger. */
export function formatNigerDay(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', {
    timeZone: NIGER_TIME_ZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Clé de regroupement AAAA-MM-JJ dans le fuseau du Niger. */
export function nigerDayKey(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-CA', { timeZone: NIGER_TIME_ZONE });
}

/** Date du jour au Niger, au format AAAA-MM-JJ (chaîne littérale). */
export function nigerToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: NIGER_TIME_ZONE });
}

/** Affiche une colonne `date` telle quelle, en JJ/MM/AAAA si elle est ISO. */
export function formatLiteralDate(value: string | null | undefined): string {
  if (!value) return '—';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

export function formatDistanceKm(km: number | null | undefined): string {
  const value = Number(km) || 0;
  return `${value.toFixed(1).replace('.', ',')} km`;
}

export function formatMinutes(min: number | null | undefined): string {
  const value = Math.round(Number(min) || 0);
  if (value < 60) return `${value} min`;
  const h = Math.floor(value / 60);
  const m = value % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** Numéro E.164 nigérien lisible : +227 90 11 22 33. */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '—';
  const digits = phone.replace(/\s/g, '');
  const ne = /^\+227(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(digits);
  return ne ? `+227 ${ne[1]} ${ne[2]} ${ne[3]} ${ne[4]}` : phone;
}

/** Lien d'appel GSM direct. */
export function telHref(phone: string | null | undefined): string {
  return `tel:${(phone || '').replace(/[^\d+*#]/g, '')}`;
}

/** Lien WhatsApp avec message pré-rempli. */
export function whatsappHref(
  phone: string | null | undefined,
  message: string,
): string {
  const digits = (phone || '').replace(/[^\d]/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

/** Une chaîne USSD est composable depuis un lien `tel:` sur Android. */
export function ussdHref(ussd: string): string {
  return `tel:${ussd.replace(/\s/g, '')}`;
}

export function initialsOf(name: string | null | undefined): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '??';
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

/**
 * Les identifiants de ligne (`row.id`) arrivent en chaîne, alors que les
 * colonnes de référence (`cityId`, `passengerId`, `driverId`…) et les entrées
 * d'action sont numériques. Cette conversion est le seul passage de l'une à
 * l'autre.
 */
export function numId(id: string | number | null | undefined): number {
  return Number(id);
}