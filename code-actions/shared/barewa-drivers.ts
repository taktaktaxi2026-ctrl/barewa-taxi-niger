/**
 * Recherche des chauffeurs disponibles — partagée par FindNearbyDrivers,
 * EstimateRideFare et RequestRide.
 */
import type { BlocksClient, Item } from './blocks/blocks-client.ts';

import { driverEtaMin, num, roadDistanceKm } from './barewa-fare.ts';

export const VERIFIED_STATUS = 'Vérifié';

export interface NearbyDriver {
  driverId: number;
  fullName: string;
  phoneNumber: string;
  whatsappNumber: string;
  profilePhotoUrl: string;
  rating: number;
  totalRides: number;
  spokenLanguages: string;
  acceptedPaymentMethods: string;
  plateNumber: string;
  vehicleColor: string;
  vehiclePhotoUrl: string;
  vehicleTypeId: number;
  vehicleTypeName: string;
  modelKey: string;
  seats: number;
  hasAirConditioning: boolean;
  vehicle3DConfig: Record<string, unknown>;
  currentLatitude: number;
  currentLongitude: number;
  distanceKm: number;
  etaMin: number;
}

export interface FindDriversParams {
  cityId: number;
  latitude: number;
  longitude: number;
  vehicleTypeId?: number;
  radiusKm: number;
  limit: number;
  cityName?: string;
}

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

/** Chauffeurs en ligne, vérifiés, positionnés, dans le rayon, triés par ETA croissant. */
export const findNearbyDrivers = async (
  client: BlocksClient,
  params: FindDriversParams,
): Promise<NearbyDriver[]> => {
  const conditions: Array<Record<string, unknown>> = [
    { column: 'cityId', value: params.cityId },
    { column: 'isOnline', value: true },
    { column: 'verificationStatus', value: VERIFIED_STATUS },
  ];
  if (params.vehicleTypeId !== undefined && params.vehicleTypeId !== null) {
    conditions.push({ column: 'vehicleTypeId', value: params.vehicleTypeId });
  }

  const { items: drivers } = await client.queryTable('DriverProfile', {
    from: { table: 'DriverProfile' },
    where: { and: conditions as never },
  });

  const { items: vehicleTypes } = await client.queryTable('VehicleTypes', {
    from: { table: 'VehicleTypes' },
  });
  const typeById = new Map<number, Item>();
  vehicleTypes.forEach((type) => typeById.set(num(type.id), type));

  const results: NearbyDriver[] = [];
  drivers.forEach((driver) => {
    const lat = driver.currentLatitude;
    const lon = driver.currentLongitude;
    if (lat === null || lat === undefined || lon === null || lon === undefined) {
      return;
    }
    const distanceKm = roadDistanceKm(
      params.latitude,
      params.longitude,
      num(lat),
      num(lon),
    );
    if (distanceKm > params.radiusKm) return;

    const type = typeById.get(num(driver.vehicleTypeId));
    results.push({
      driverId: num(driver.id),
      fullName: (driver.fullName as string) ?? '',
      phoneNumber: (driver.phoneNumber as string) ?? '',
      whatsappNumber: (driver.whatsappNumber as string) ?? '',
      profilePhotoUrl: (driver.profilePhotoUrl as string) ?? '',
      rating: num(driver.rating),
      totalRides: num(driver.totalRides),
      spokenLanguages: (driver.spokenLanguages as string) ?? '',
      acceptedPaymentMethods: (driver.acceptedPaymentMethods as string) ?? '',
      plateNumber: (driver.plateNumber as string) ?? '',
      vehicleColor: (driver.vehicleColor as string) ?? '',
      vehiclePhotoUrl: (driver.vehiclePhotoUrl as string) ?? '',
      vehicleTypeId: num(driver.vehicleTypeId),
      vehicleTypeName: (type?.name as string) ?? '',
      modelKey: (type?.modelKey as string) ?? '',
      seats: num(type?.seats),
      hasAirConditioning: type?.hasAirConditioning === true,
      vehicle3DConfig: asRecord(driver.vehicle3DConfig),
      currentLatitude: num(lat),
      currentLongitude: num(lon),
      distanceKm,
      etaMin: driverEtaMin(distanceKm, params.cityName),
    });
  });

  results.sort((a, b) => a.etaMin - b.etaMin || a.distanceKm - b.distanceKm);
  return results.slice(0, params.limit);
};
