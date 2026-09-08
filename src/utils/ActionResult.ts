/**
 * Deux actions de l'app renvoient un fichier produit par un nœud de rendu
 * (reçu PDF, annonce audio) : leur sortie n'est pas typée à la génération.
 * Cette lecture défensive extrait l'URL sans jamais supposer un nom de champ
 * unique, et renvoie `null` plutôt qu'une chaîne vide quand il n'y en a pas.
 */

const URL_FIELDS = ['url', 'fileUrl', 'audioUrl', 'signedUrl', 'downloadUrl'];

export function fileUrlOf(result: unknown): string | null {
  if (!result || typeof result !== 'object') return null;
  const record = result as Record<string, unknown>;
  for (const field of URL_FIELDS) {
    const value = record[field];
    if (typeof value === 'string' && value.startsWith('http')) return value;
  }
  return null;
}

/** Numéro de reçu au format REC-<année>-<6 chiffres>. */
export function buildReceiptNumber(rideId: number): string {
  const year = new Date().toLocaleDateString('en-CA', {
    timeZone: 'Africa/Niamey',
  }).slice(0, 4);
  return `REC-${year}-${String(Math.abs(rideId) % 1000000).padStart(6, '0')}`;
}
