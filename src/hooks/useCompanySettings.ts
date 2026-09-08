/**
 * Paramètres de la société : identité légale, numéros officiels, version de
 * l'app. La table CompanySettings ne porte qu'une ligne — ce hook la sert
 * directement, avec des replis sûrs pour les seules valeurs vitales.
 */

import { useEntityGetAll } from '@blocksdiy/blocks-client-sdk/reactSdk';
import type { EntityType } from '@blocksdiy/blocks-client-sdk';
import { CompanySettingsEntity } from '@/product-types';

export type CompanySettings = EntityType<typeof CompanySettingsEntity>;

/** Police Secours au Niger — valeur de repli si la ligne n'est pas remplie. */
export const DEFAULT_EMERGENCY_NUMBER = '17';

export function useCompanySettings() {
  const query = useEntityGetAll(CompanySettingsEntity);
  const settings = query.data?.[0];

  return {
    settings,
    emergencyNumber: settings?.emergencyNumber || DEFAULT_EMERGENCY_NUMBER,
    supportWhatsappNumber: settings?.supportWhatsappNumber || '',
    brandName: settings?.brandName || 'BAREWA',
    isLoading: query.isLoading,
    error: query.error ?? null,
  };
}
