import { BlocksClient } from '../shared/blocks/blocks-client.ts';
import { findNearbyDrivers } from '../shared/barewa-drivers.ts';
import {
  CURRENCY,
  computeFare,
  computeSurge,
  evaluatePromo,
  fareBeforeDiscount,
  nigerDateString,
  num,
  roadDistanceKm,
  travelDurationMin,
  type FareGridRow,
} from '../shared/barewa-fare.ts';
import {
  findPromoCode,
  getActiveFareGrid,
  getCity,
  getVehicleTypes,
} from '../shared/barewa-lookup.ts';

interface EstimateInput {
  cityId: number;
  pickupLatitude: number;
  pickupLongitude: number;
  dropoffLatitude: number;
  dropoffLongitude: number;
  vehicleTypeId?: number;
  promoCode?: string;
  requestedAt?: string;
}

interface FareOption {
  vehicleTypeId: number;
  vehicleTypeName: string;
  vehicleLocalName: string;
  modelKey: string;
  seats: number;
  hasAirConditioning: boolean;
  fareId: number;
  baseFare: number;
  fareBeforeDiscount: number;
  surgePercent: number;
  discountAmount: number;
  finalFare: number;
  platformCommission: number;
  driverPayout: number;
  currency: string;
  onlineDriverCount: number;
  etaMin: number;
  isAvailable: boolean;
}

export const invoke = async (
  input: EstimateInput,
  context: Record<string, unknown>,
): Promise<Record<string, unknown>> => {
  const client = new BlocksClient(context as never);

  const cityId = num(input.cityId);
  const requestedAt = input.requestedAt || new Date().toISOString();

  const city = await getCity(client, cityId);
  const cityName = (city?.name as string) ?? '';

  const distanceKm = roadDistanceKm(
    num(input.pickupLatitude),
    num(input.pickupLongitude),
    num(input.dropoffLatitude),
    num(input.dropoffLongitude),
  );
  const durationMin = travelDurationMin(distanceKm, cityName);

  const [grids, vehicleTypes] = await Promise.all([
    getActiveFareGrid(client, cityId, input.vehicleTypeId),
    getVehicleTypes(client),
  ]);

  if (grids.length === 0) {
    return {
      distanceKm,
      durationMin,
      cityName,
      isNight: false,
      isPeak: false,
      promoValid: false,
      promoMessage: '',
      options: [],
    };
  }

  const typeById = new Map<number, Record<string, unknown>>();
  vehicleTypes.forEach((type) => typeById.set(num(type.id), type));

  const surge = computeSurge(grids[0] as FareGridRow, requestedAt);

  const rawPromo = (input.promoCode ?? '').trim();
  const promoRow = rawPromo ? await findPromoCode(client, rawPromo) : null;
  const today = nigerDateString(requestedAt);

  // La validité du code est évaluée sur l'option la moins chère de la ville,
  // pour que le passager sache si le code s'applique avant de choisir un véhicule.
  let promoValid = false;
  let promoMessage = '';

  const options: FareOption[] = [];

  for (const grid of grids) {
    const gridSurge = computeSurge(grid, requestedAt);
    const before = fareBeforeDiscount(
      grid,
      distanceKm,
      durationMin,
      gridSurge.surgePercent,
    );

    let discountAmount = 0;
    if (rawPromo) {
      const evaluation = evaluatePromo(
        promoRow,
        before,
        cityId,
        today,
        cityName,
      );
      discountAmount = evaluation.discountAmount;
      // Le message retenu est celui d'une option valable si elle existe,
      // sinon le premier motif de refus rencontré.
      if (evaluation.promoValid) {
        if (!promoValid) promoMessage = evaluation.promoMessage;
        promoValid = true;
      } else if (!promoValid && !promoMessage) {
        promoMessage = evaluation.promoMessage;
      }
    }

    const breakdown = computeFare(
      grid,
      distanceKm,
      durationMin,
      gridSurge.surgePercent,
      discountAmount,
    );

    const vehicleTypeId = num(grid.vehicleTypeId);
    const type = typeById.get(vehicleTypeId);

    const drivers = await findNearbyDrivers(client, {
      cityId,
      latitude: num(input.pickupLatitude),
      longitude: num(input.pickupLongitude),
      vehicleTypeId,
      radiusKm: 6,
      limit: 50,
      cityName,
    });

    options.push({
      vehicleTypeId,
      vehicleTypeName: (type?.name as string) ?? '',
      vehicleLocalName: (type?.localName as string) ?? '',
      modelKey: (type?.modelKey as string) ?? '',
      seats: num(type?.seats),
      hasAirConditioning: type?.hasAirConditioning === true,
      fareId: num(grid.id),
      baseFare: num(grid.baseFare),
      fareBeforeDiscount: breakdown.fareBeforeDiscount,
      surgePercent: gridSurge.surgePercent,
      discountAmount: breakdown.discountAmount,
      finalFare: breakdown.finalFare,
      platformCommission: breakdown.platformCommission,
      driverPayout: breakdown.driverPayout,
      currency: CURRENCY,
      onlineDriverCount: drivers.length,
      etaMin: drivers.length > 0 ? drivers[0].etaMin : 0,
      isAvailable: drivers.length > 0,
    });
  }

  options.sort((a, b) => {
    const orderA = num(typeById.get(a.vehicleTypeId)?.sortOrder, 9999);
    const orderB = num(typeById.get(b.vehicleTypeId)?.sortOrder, 9999);
    return orderA - orderB || a.finalFare - b.finalFare;
  });

  return {
    distanceKm,
    durationMin,
    cityName,
    isNight: surge.isNight,
    isPeak: surge.isPeak,
    promoValid,
    promoMessage,
    options,
  };
};
