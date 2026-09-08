import { BlocksClient } from '../shared/blocks/blocks-client.ts';
import { findNearbyDrivers } from '../shared/barewa-drivers.ts';
import { num } from '../shared/barewa-fare.ts';
import { getCity } from '../shared/barewa-lookup.ts';

interface FindInput {
  cityId: number;
  latitude: number;
  longitude: number;
  vehicleTypeId?: number;
  radiusKm?: number;
  limit?: number;
}

export const invoke = async (
  input: FindInput,
  context: Record<string, unknown>,
): Promise<Record<string, unknown>> => {
  const client = new BlocksClient(context as never);

  const cityId = num(input.cityId);
  const radiusKm =
    input.radiusKm !== undefined && num(input.radiusKm) > 0
      ? num(input.radiusKm)
      : 6;
  const limit =
    input.limit !== undefined && num(input.limit) > 0 ? num(input.limit) : 12;

  const city = await getCity(client, cityId);

  const drivers = await findNearbyDrivers(client, {
    cityId,
    latitude: num(input.latitude),
    longitude: num(input.longitude),
    vehicleTypeId: input.vehicleTypeId,
    radiusKm,
    limit,
    cityName: (city?.name as string) ?? '',
  });

  return {
    count: drivers.length,
    searchRadiusKm: radiusKm,
    drivers,
  };
};
