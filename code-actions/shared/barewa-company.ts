/**
 * Lecture des paramètres de la société (table à ligne unique CompanySettings).
 * La table peut être vide : on retombe alors sur des valeurs neutres, sans jamais planter.
 */
import type { BlocksClient, Item } from './blocks/blocks-client.ts';

/** Police Secours au Niger. */
export const DEFAULT_EMERGENCY_NUMBER = '17';

/** Première (et unique) ligne de CompanySettings, ou null si la table est vide. */
export const getCompanySettings = async (
  client: BlocksClient,
): Promise<Item | null> => {
  try {
    const { items } = await client.queryTable('CompanySettings', {
      from: { table: 'CompanySettings' },
      orderBy: [{ column: 'id', direction: 'asc' }],
      limit: 1,
    });
    return items[0] ?? null;
  } catch {
    return null;
  }
};

const text = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

/** Numéro des secours à composer (défaut 17). */
export const emergencyNumberOf = (settings: Item | null): string =>
  text(settings?.emergencyNumber) || DEFAULT_EMERGENCY_NUMBER;

/** Numéro du superviseur à alerter, chaîne vide s'il n'est pas renseigné. */
export const supervisorPhoneOf = (settings: Item | null): string =>
  text(settings?.supervisorAlertPhone);

/** Nom commercial utilisé dans les messages, défaut « BAREWA ». */
export const brandNameOf = (settings: Item | null): string =>
  text(settings?.brandName) || text(settings?.legalName) || 'BAREWA';
