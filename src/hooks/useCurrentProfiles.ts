/**
 * Rassemble l'utilisateur connecté, son rôle et ses profils métier.
 *
 * PassengerProfile et DriverProfile sont des tables d'extension de compte :
 * elles se retrouvent par l'email de l'utilisateur. Un utilisateur sans profil
 * n'est pas une impasse — les écrans concernés proposent la création du profil,
 * et le profil est créé paresseusement au premier enregistrement.
 */

import {
  useEntityGetAll,
  useUser,
} from '@blocksdiy/blocks-client-sdk/reactSdk';
import type { EntityType } from '@blocksdiy/blocks-client-sdk';
import { DriverProfileEntity, PassengerProfileEntity } from '@/product-types';

export type AppRole = 'Passager' | 'Chauffeur' | 'Admin';

export type PassengerProfile = EntityType<typeof PassengerProfileEntity>;
export type DriverProfile = EntityType<typeof DriverProfileEntity>;

export function useCurrentProfiles() {
  const user = useUser();
  const email = user.email;

  const passengerQuery = useEntityGetAll(
    PassengerProfileEntity,
    { email },
    { enabled: Boolean(email) },
  );
  const driverQuery = useEntityGetAll(
    DriverProfileEntity,
    { email },
    { enabled: Boolean(email) },
  );

  const passenger = passengerQuery.data?.[0];
  const driver = driverQuery.data?.[0];

  const declaredRole = user.role;
  const role: AppRole =
    declaredRole === 'Admin' ||
    declaredRole === 'Chauffeur' ||
    declaredRole === 'Passager'
      ? declaredRole
      : driver
        ? 'Chauffeur'
        : 'Passager';

  return {
    user,
    role,
    isAdmin: role === 'Admin',
    passenger,
    driver,
    isLoading: passengerQuery.isLoading || driverQuery.isLoading,
    error: passengerQuery.error ?? driverQuery.error ?? null,
  };
}