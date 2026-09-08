import { BlocksClient } from '../shared/blocks/blocks-client.ts';
import { computeFare, num, splitFare } from '../shared/barewa-fare.ts';
import { getActiveFareGrid } from '../shared/barewa-lookup.ts';

interface CompleteInput {
  rideId: number;
  actualDistanceKm?: number;
  actualDurationMin?: number;
  ratingByDriver?: number;
  cashCollected?: boolean;
}

const refuse = (message: string): Record<string, unknown> => ({
  success: false,
  message,
});

export const invoke = async (
  input: CompleteInput,
  context: Record<string, unknown>,
): Promise<Record<string, unknown>> => {
  const client = new BlocksClient(context as never);

  const rideId = num(input.rideId);
  const { items: rides } = await client.queryTable('Rides', {
    from: { table: 'Rides' },
    where: { column: 'id', value: rideId },
    limit: 1,
  });
  const ride = rides[0];
  if (!ride) return refuse('Course introuvable.');
  if (ride.status === 'Terminée') {
    return refuse('Cette course est déjà terminée.');
  }
  if (ride.status === 'Annulée') {
    return refuse('Cette course a été annulée, elle ne peut pas être clôturée.');
  }

  const completedAt = new Date().toISOString();
  const cityId = num(ride.cityId);
  const vehicleTypeId = num(ride.vehicleTypeId);
  const grids = await getActiveFareGrid(client, cityId, vehicleTypeId);
  const grid = grids[0] ?? {
    id: 0,
    minimumFare: 0,
    driverCommissionPercent: 0,
  };

  const hasActualDistance =
    input.actualDistanceKm !== undefined && input.actualDistanceKm !== null;
  const hasActualDuration =
    input.actualDurationMin !== undefined && input.actualDurationMin !== null;

  const distanceKm = hasActualDistance
    ? Math.max(0.3, Math.round(num(input.actualDistanceKm) * 10) / 10)
    : num(ride.distanceKm);
  const durationMin = hasActualDuration
    ? Math.max(3, Math.round(num(input.actualDurationMin)))
    : num(ride.durationMin);

  const discountAmount = num(ride.discountAmount);
  const surgeApplied = num(ride.surgeApplied);

  let finalFare: number;
  let platformCommission: number;
  let driverPayout: number;

  if ((hasActualDistance || hasActualDuration) && grids.length > 0) {
    const breakdown = computeFare(
      grid,
      distanceKm,
      durationMin,
      surgeApplied,
      discountAmount,
    );
    finalFare = breakdown.finalFare;
    platformCommission = breakdown.platformCommission;
    driverPayout = breakdown.driverPayout;
  } else {
    finalFare = num(ride.estimatedFare);
    const split = splitFare(grid, finalFare);
    platformCommission =
      grids.length > 0 ? split.platformCommission : num(ride.platformCommission);
    driverPayout =
      grids.length > 0 ? split.driverPayout : num(ride.driverPayout);
  }

  // Moyen de paiement : espèces ?
  let isCashProvider = false;
  const paymentProviderId = num(ride.paymentProviderId);
  if (paymentProviderId > 0) {
    const { items: providers } = await client.queryTable('PaymentProviders', {
      from: { table: 'PaymentProviders' },
      where: { column: 'id', value: paymentProviderId },
      limit: 1,
    });
    isCashProvider = providers[0]?.kind === 'Espèces';
  }

  const settledInCash = input.cashCollected === true || isCashProvider;
  const paymentStatus = settledInCash ? 'Payé' : 'En attente';
  const amountDueFromPassenger = settledInCash ? 0 : finalFare;

  const rideUpdate: Record<string, unknown> = {
    status: 'Terminée',
    finalFare,
    distanceKm,
    durationMin,
    platformCommission,
    driverPayout,
    completedAt,
    paymentStatus,
  };
  if (input.ratingByDriver !== undefined && input.ratingByDriver !== null) {
    rideUpdate.ratingByDriver = num(input.ratingByDriver);
  }
  await client.updateItem('Rides', String(rideId), rideUpdate);

  const driverId = num(ride.driverId);
  if (driverId > 0) {
    const { items: drivers } = await client.queryTable('DriverProfile', {
      from: { table: 'DriverProfile' },
      where: { column: 'id', value: driverId },
      limit: 1,
    });
    const driver = drivers[0];
    if (driver) {
      await client.updateItem('DriverProfile', String(driverId), {
        totalRides: num(driver.totalRides) + 1,
        totalEarnings: num(driver.totalEarnings) + driverPayout,
      });
    }
  }

  const passengerId = num(ride.passengerId);
  if (passengerId > 0) {
    const { items: passengers } = await client.queryTable('PassengerProfile', {
      from: { table: 'PassengerProfile' },
      where: { column: 'id', value: passengerId },
      limit: 1,
    });
    const passenger = passengers[0];
    if (passenger) {
      await client.updateItem('PassengerProfile', String(passengerId), {
        totalRides: num(passenger.totalRides) + 1,
        totalSpent: num(passenger.totalSpent) + finalFare,
      });
    }
  }

  if (settledInCash) {
    const { items: existing } = await client.queryTable('Payments', {
      from: { table: 'Payments' },
      where: { column: 'rideId', value: rideId },
    });
    const alreadyConfirmed = existing.some(
      (payment) => payment.status === 'Confirmé',
    );
    if (!alreadyConfirmed) {
      const order = `${existing.length + 1}`.padStart(2, '0');
      await client.createItem('Payments', {
        reference: `PAY-${(ride.reference as string) ?? rideId}-${order}`,
        rideId,
        paymentProviderId: paymentProviderId > 0 ? paymentProviderId : null,
        amount: finalFare,
        platformCommission,
        driverPayout,
        status: 'Confirmé',
        payoutStatus: 'Encaissé en espèces',
        initiatedAt: completedAt,
        confirmedAt: completedAt,
      });
    }
  }

  return {
    success: true,
    message: settledInCash
      ? `Course clôturée et encaissée en espèces : ${finalFare} FCFA.`
      : `Course clôturée. Reste à régler par le passager : ${finalFare} FCFA.`,
    rideId,
    finalFare,
    distanceKm,
    durationMin,
    platformCommission,
    driverPayout,
    paymentStatus,
    amountDueFromPassenger,
  };
};
