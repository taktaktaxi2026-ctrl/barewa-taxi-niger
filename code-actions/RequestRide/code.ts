import { BlocksClient } from '../shared/blocks/blocks-client.ts';
import { findNearbyDrivers } from '../shared/barewa-drivers.ts';
import {
  computeFare,
  computeSurge,
  evaluatePromo,
  fareBeforeDiscount,
  nigerDateString,
  num,
  roadDistanceKm,
  travelDurationMin,
} from '../shared/barewa-fare.ts';
import {
  findPromoCode,
  getActiveFareGrid,
  getCity,
} from '../shared/barewa-lookup.ts';

interface RequestInput {
  passengerId: number;
  cityId: number;
  vehicleTypeId: number;
  pickupLabel: string;
  pickupLatitude: number;
  pickupLongitude: number;
  pickupLandmarkId?: number;
  dropoffLabel: string;
  dropoffLatitude: number;
  dropoffLongitude: number;
  dropoffLandmarkId?: number;
  paymentProviderId: number;
  promoCode?: string;
  passengerNote?: string;
  passengerCount?: number;
  isScheduled?: boolean;
  scheduledFor?: string;
}

const ACTIVE_STATUSES = [
  'Recherche',
  'Acceptée',
  'Chauffeur en route',
  'Chauffeur arrivé',
  'En course',
];

const REFERENCE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

const randomReference = (): string => {
  let suffix = '';
  for (let index = 0; index < 5; index += 1) {
    suffix +=
      REFERENCE_ALPHABET[Math.floor(Math.random() * REFERENCE_ALPHABET.length)];
  }
  return `BRW-${suffix}`;
};

const generateUniqueReference = async (
  client: BlocksClient,
): Promise<string> => {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const reference = randomReference();
    const { items } = await client.queryTable('Rides', {
      from: { table: 'Rides' },
      where: { column: 'reference', value: reference },
      limit: 1,
    });
    if (items.length === 0) return reference;
  }
  return `BRW-${Date.now().toString(36).toUpperCase().slice(-5)}`;
};

const refuse = (message: string): Record<string, unknown> => ({
  success: false,
  message,
});

export const invoke = async (
  input: RequestInput,
  context: Record<string, unknown>,
): Promise<Record<string, unknown>> => {
  const client = new BlocksClient(context as never);

  const cityId = num(input.cityId);
  const passengerId = num(input.passengerId);
  const vehicleTypeId = num(input.vehicleTypeId);
  const requestedAt = new Date().toISOString();

  const city = await getCity(client, cityId);
  if (!city) {
    return refuse("Cette ville n'est pas desservie par BAREWA.");
  }
  if (city.isActive === false) {
    return refuse(
      `Le service est momentanément fermé à ${(city.name as string) ?? 'cette ville'}.`,
    );
  }
  const cityName = (city.name as string) ?? '';

  const { items: passengers } = await client.queryTable('PassengerProfile', {
    from: { table: 'PassengerProfile' },
    where: { column: 'id', value: passengerId },
    limit: 1,
  });
  const passenger = passengers[0];
  if (!passenger) {
    return refuse('Profil passager introuvable.');
  }

  const { items: activeRides } = await client.queryTable('Rides', {
    from: { table: 'Rides' },
    where: {
      and: [
        { column: 'passengerId', value: passengerId },
        { column: 'status', operator: 'in', value: ACTIVE_STATUSES },
      ],
    },
    limit: 1,
  });
  if (activeRides.length > 0) {
    return refuse(
      'Vous avez déjà une course en cours. Terminez-la ou annulez-la avant d’en commander une autre.',
    );
  }

  const grids = await getActiveFareGrid(client, cityId, vehicleTypeId);
  const grid = grids[0];
  if (!grid) {
    return refuse(
      `Ce type de véhicule n’est pas tarifé à ${cityName || 'cette ville'}.`,
    );
  }

  const distanceKm = roadDistanceKm(
    num(input.pickupLatitude),
    num(input.pickupLongitude),
    num(input.dropoffLatitude),
    num(input.dropoffLongitude),
  );
  const durationMin = travelDurationMin(distanceKm, cityName);
  const surge = computeSurge(grid, requestedAt);
  const before = fareBeforeDiscount(
    grid,
    distanceKm,
    durationMin,
    surge.surgePercent,
  );

  const rawPromo = (input.promoCode ?? '').trim();
  let discountAmount = 0;
  let appliedPromo: { id: number; code: string; usedCount: number } | null =
    null;
  if (rawPromo) {
    const promoRow = await findPromoCode(client, rawPromo);
    const evaluation = evaluatePromo(
      promoRow,
      before,
      cityId,
      nigerDateString(requestedAt),
      cityName,
    );
    if (evaluation.promoValid && evaluation.promo) {
      discountAmount = evaluation.discountAmount;
      appliedPromo = {
        id: num(evaluation.promo.id),
        code: (evaluation.promo.code as string) ?? rawPromo.toUpperCase(),
        usedCount: num(evaluation.promo.usedCount),
      };
    }
  }

  const breakdown = computeFare(
    grid,
    distanceKm,
    durationMin,
    surge.surgePercent,
    discountAmount,
  );

  const reference = await generateUniqueReference(client);

  const { item: ride } = await client.createItem('Rides', {
    reference,
    passengerId,
    cityId,
    vehicleTypeId,
    status: 'Recherche',
    pickupLabel: input.pickupLabel,
    pickupLatitude: num(input.pickupLatitude),
    pickupLongitude: num(input.pickupLongitude),
    pickupLandmarkId: input.pickupLandmarkId ?? null,
    dropoffLabel: input.dropoffLabel,
    dropoffLatitude: num(input.dropoffLatitude),
    dropoffLongitude: num(input.dropoffLongitude),
    dropoffLandmarkId: input.dropoffLandmarkId ?? null,
    distanceKm,
    durationMin,
    estimatedFare: breakdown.finalFare,
    surgeApplied: surge.surgePercent,
    promoCode: appliedPromo ? appliedPromo.code : null,
    discountAmount: breakdown.discountAmount,
    platformCommission: breakdown.platformCommission,
    driverPayout: breakdown.driverPayout,
    paymentProviderId: num(input.paymentProviderId),
    paymentStatus: 'En attente',
    requestedAt,
    passengerNote: input.passengerNote ?? null,
    passengerCount:
      input.passengerCount !== undefined && num(input.passengerCount) > 0
        ? num(input.passengerCount)
        : 1,
    isScheduled: input.isScheduled === true,
    scheduledFor: input.scheduledFor ?? null,
  });

  if (appliedPromo) {
    await client.updateItem('PromoCodes', String(appliedPromo.id), {
      usedCount: appliedPromo.usedCount + 1,
    });
  }

  const drivers = await findNearbyDrivers(client, {
    cityId,
    latitude: num(input.pickupLatitude),
    longitude: num(input.pickupLongitude),
    vehicleTypeId,
    radiusKm: 6,
    limit: 8,
    cityName,
  });

  return {
    success: true,
    message:
      drivers.length > 0
        ? `Course ${reference} enregistrée. ${drivers.length} chauffeur(s) sollicité(s).`
        : `Course ${reference} enregistrée. Aucun chauffeur en ligne pour l’instant, la recherche continue.`,
    rideId: num(ride.id),
    reference,
    estimatedFare: breakdown.finalFare,
    discountAmount: breakdown.discountAmount,
    distanceKm,
    durationMin,
    surgeApplied: surge.surgePercent,
    candidateDrivers: drivers.map((driver) => ({
      driverId: driver.driverId,
      fullName: driver.fullName,
      phoneNumber: driver.phoneNumber,
      distanceKm: driver.distanceKm,
      etaMin: driver.etaMin,
    })),
  };
};
