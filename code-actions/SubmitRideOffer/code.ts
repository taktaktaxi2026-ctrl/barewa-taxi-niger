import { BlocksClient } from '../shared/blocks/blocks-client.ts';
import { num } from '../shared/barewa-fare.ts';
import { getActiveFareGrid } from '../shared/barewa-lookup.ts';
import { isClosedRide } from '../shared/barewa-rides.ts';

interface OfferInput {
  rideId: number;
  side: 'Passager' | 'Chauffeur';
  amount: number;
  driverId?: number;
  reason?: string;
}

/** Une offre ne peut pas dépasser trois fois le prix calculé par la grille. */
const MAX_MULTIPLE_OF_CALCULATED = 3;

const refuse = (message: string): Record<string, unknown> => ({
  success: false,
  message,
});

const formatFcfa = (amount: number): string => `${Math.round(amount)} FCFA`;

export const invoke = async (
  input: OfferInput,
  context: Record<string, unknown>,
): Promise<Record<string, unknown>> => {
  const client = new BlocksClient(context as never);

  const rideId = num(input.rideId);
  const side = input.side;
  if (side !== 'Passager' && side !== 'Chauffeur') {
    return refuse('Le camp émetteur doit être Passager ou Chauffeur.');
  }

  const amount = Math.round(num(input.amount));
  if (!Number.isFinite(amount) || amount <= 0) {
    return refuse('Le prix proposé doit être un montant positif en FCFA.');
  }

  const { items: rides } = await client.queryTable('Rides', {
    from: { table: 'Rides' },
    where: { column: 'id', value: rideId },
    limit: 1,
  });
  const ride = rides[0];
  if (!ride) return refuse('Course introuvable.');
  if (isClosedRide(ride)) {
    return refuse(
      'Cette course est clôturée : la négociation du prix n’est plus possible.',
    );
  }

  const grids = await getActiveFareGrid(
    client,
    num(ride.cityId),
    num(ride.vehicleTypeId),
  );
  const grid = grids[0];
  const minimumFare = grid ? num(grid.minimumFare) : 0;
  if (minimumFare > 0 && amount < minimumFare) {
    return refuse(
      `Le prix plancher de cette course est de ${formatFcfa(minimumFare)}. Proposez au moins ce montant.`,
    );
  }

  const calculatedFare = num(ride.estimatedFare);
  if (
    calculatedFare > 0 &&
    amount > calculatedFare * MAX_MULTIPLE_OF_CALCULATED
  ) {
    return refuse(
      `Prix hors limite : le maximum négociable est de ${formatFcfa(
        calculatedFare * MAX_MULTIPLE_OF_CALCULATED,
      )} (triple du prix calculé, ${formatFcfa(calculatedFare)}).`,
    );
  }

  const { items: existingOffers } = await client.queryTable('RideOffers', {
    from: { table: 'RideOffers' },
    where: { column: 'rideId', value: rideId },
    orderBy: [{ column: 'id', direction: 'asc' }],
  });

  const nowIso = new Date().toISOString();
  const otherSide = side === 'Passager' ? 'Chauffeur' : 'Passager';

  // Les offres encore en attente du même camp sont dépassées par celle-ci.
  const supersededIds = existingOffers
    .filter((offer) => offer.status === 'Proposée' && offer.side === side)
    .map((offer) => num(offer.id));
  for (const offerId of supersededIds) {
    await client.updateItem('RideOffers', String(offerId), {
      status: 'Dépassée',
      respondedAt: nowIso,
    });
  }

  // Le montant de référence affiché est la dernière offre en attente du camp opposé.
  const lastOtherSideOffer = [...existingOffers]
    .reverse()
    .find((offer) => offer.status === 'Proposée' && offer.side === otherSide);
  const previousAmount = lastOtherSideOffer
    ? num(lastOtherSideOffer.amount)
    : calculatedFare;

  const driverId =
    input.driverId !== undefined && input.driverId !== null
      ? num(input.driverId)
      : num(ride.driverId);

  const { item: offer } = await client.createItem('RideOffers', {
    rideId,
    driverId: driverId > 0 ? driverId : null,
    side,
    amount,
    previousAmount,
    status: 'Proposée',
    reason: (input.reason ?? '').trim() || null,
  });

  await client.updateItem('Rides', String(rideId), {
    negotiationStatus: 'Négociation en cours',
  });

  const roundNumber = existingOffers.length + 1;
  const deltaAmount = amount - previousAmount;

  return {
    success: true,
    message:
      deltaAmount === 0
        ? `Offre de ${formatFcfa(amount)} transmise (tour ${roundNumber}).`
        : `Offre de ${formatFcfa(amount)} transmise (tour ${roundNumber}), soit ${
            deltaAmount > 0 ? '+' : '−'
          }${Math.abs(deltaAmount)} FCFA par rapport à ${formatFcfa(previousAmount)}.`,
    offerId: num(offer.id),
    amount,
    previousAmount,
    deltaAmount,
    calculatedFare,
    roundNumber,
  };
};
