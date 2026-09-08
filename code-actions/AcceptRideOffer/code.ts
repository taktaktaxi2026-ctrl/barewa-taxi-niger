import { BlocksClient } from '../shared/blocks/blocks-client.ts';
import { num, splitFare } from '../shared/barewa-fare.ts';
import { getActiveFareGrid } from '../shared/barewa-lookup.ts';
import { isClosedRide } from '../shared/barewa-rides.ts';

interface AcceptInput {
  offerId: number;
  acceptedBy: 'Passager' | 'Chauffeur';
}

const refuse = (message: string): Record<string, unknown> => ({
  success: false,
  message,
});

export const invoke = async (
  input: AcceptInput,
  context: Record<string, unknown>,
): Promise<Record<string, unknown>> => {
  const client = new BlocksClient(context as never);

  const offerId = num(input.offerId);
  const acceptedBy = input.acceptedBy;
  if (acceptedBy !== 'Passager' && acceptedBy !== 'Chauffeur') {
    return refuse("Le camp qui accepte doit être Passager ou Chauffeur.");
  }

  const { items: offers } = await client.queryTable('RideOffers', {
    from: { table: 'RideOffers' },
    where: { column: 'id', value: offerId },
    limit: 1,
  });
  const offer = offers[0];
  if (!offer) return refuse('Offre introuvable.');
  if (offer.status !== 'Proposée') {
    return refuse(
      `Cette offre n’est plus en attente (statut actuel : ${
        (offer.status as string) ?? 'inconnu'
      }).`,
    );
  }
  if (offer.side === acceptedBy) {
    return refuse(
      `Un ${acceptedBy.toLowerCase()} ne peut pas accepter sa propre offre : l’accord doit venir de l’autre partie.`,
    );
  }

  const rideId = num(offer.rideId);
  const { items: rides } = await client.queryTable('Rides', {
    from: { table: 'Rides' },
    where: { column: 'id', value: rideId },
    limit: 1,
  });
  const ride = rides[0];
  if (!ride) return refuse('Course introuvable.');
  if (isClosedRide(ride)) {
    return refuse(
      'Cette course est clôturée : le prix ne peut plus être accepté.',
    );
  }

  const agreedFare = Math.round(num(offer.amount));
  const nowIso = new Date().toISOString();

  const grids = await getActiveFareGrid(
    client,
    num(ride.cityId),
    num(ride.vehicleTypeId),
  );
  const grid = grids[0] ?? { id: 0, driverCommissionPercent: 0 };
  const { platformCommission, driverPayout } = splitFare(grid, agreedFare);

  await client.updateItem('RideOffers', String(offerId), {
    status: 'Acceptée',
    respondedAt: nowIso,
  });

  // Les autres offres encore en attente sur cette course tombent.
  const { items: siblings } = await client.queryTable('RideOffers', {
    from: { table: 'RideOffers' },
    where: {
      and: [
        { column: 'rideId', value: rideId },
        { column: 'status', value: 'Proposée' },
      ],
    },
  });
  for (const sibling of siblings) {
    const siblingId = num(sibling.id);
    if (siblingId === offerId) continue;
    await client.updateItem('RideOffers', String(siblingId), {
      status: 'Refusée',
      respondedAt: nowIso,
    });
  }

  const rideUpdate: Record<string, unknown> = {
    estimatedFare: agreedFare,
    platformCommission,
    driverPayout,
    negotiationStatus: 'Prix accepté',
  };

  const offerDriverId = num(offer.driverId);
  let driverId = num(ride.driverId);
  let rideStatus = (ride.status as string) ?? '';

  if (acceptedBy === 'Chauffeur' && driverId <= 0 && offerDriverId > 0) {
    driverId = offerDriverId;
    rideStatus = 'Acceptée';
    rideUpdate.driverId = driverId;
    rideUpdate.status = rideStatus;
    rideUpdate.acceptedAt = nowIso;
  }

  await client.updateItem('Rides', String(rideId), rideUpdate);

  return {
    success: true,
    message: `Prix convenu à ${agreedFare} FCFA. Net chauffeur : ${driverPayout} FCFA.`,
    rideId,
    agreedFare,
    platformCommission,
    driverPayout,
    driverId,
    rideStatus,
  };
};
