import { BlocksClient } from '../shared/blocks/blocks-client.ts';
import { num, splitFare } from '../shared/barewa-fare.ts';
import { getActiveFareGrid } from '../shared/barewa-lookup.ts';

interface InitiateInput {
  rideId: number;
  paymentProviderId: number;
  payerPhoneNumber: string;
  amount?: number;
}

const refuse = (message: string): Record<string, unknown> => ({
  success: false,
  message,
});

export const invoke = async (
  input: InitiateInput,
  context: Record<string, unknown>,
): Promise<Record<string, unknown>> => {
  const client = new BlocksClient(context as never);

  const rideId = num(input.rideId);
  const providerId = num(input.paymentProviderId);

  const { items: rides } = await client.queryTable('Rides', {
    from: { table: 'Rides' },
    where: { column: 'id', value: rideId },
    limit: 1,
  });
  const ride = rides[0];
  if (!ride) return refuse('Course introuvable.');

  const { items: providers } = await client.queryTable('PaymentProviders', {
    from: { table: 'PaymentProviders' },
    where: { column: 'id', value: providerId },
    limit: 1,
  });
  const provider = providers[0];
  if (!provider) return refuse('Opérateur de paiement introuvable.');
  if (provider.isActive === false) {
    return refuse(
      `${(provider.name as string) ?? 'Cet opérateur'} n’est pas disponible pour le moment.`,
    );
  }
  if (provider.kind === 'Espèces') {
    return refuse(
      'Ce mode de règlement se fait en espèces directement auprès du chauffeur.',
    );
  }

  const { items: existingPayments } = await client.queryTable('Payments', {
    from: { table: 'Payments' },
    where: { column: 'rideId', value: rideId },
  });
  if (existingPayments.some((payment) => payment.status === 'Confirmé')) {
    return refuse('Cette course est déjà réglée.');
  }

  const amount =
    input.amount !== undefined && input.amount !== null
      ? Math.round(num(input.amount))
      : Math.round(num(ride.finalFare) || num(ride.estimatedFare));
  if (amount <= 0) {
    return refuse('Montant à régler invalide.');
  }

  const grids = await getActiveFareGrid(
    client,
    num(ride.cityId),
    num(ride.vehicleTypeId),
  );
  const grid = grids[0];
  const split = grid
    ? splitFare(grid, amount)
    : {
        platformCommission: num(ride.platformCommission),
        driverPayout: amount - num(ride.platformCommission),
      };

  const merchantNumber = (provider.merchantNumber as string) ?? '';
  const ussdCode = (provider.ussdCode as string) ?? '';
  const template = (provider.ussdTemplate as string) ?? '';
  const ussdString = (template || ussdCode)
    .split('{merchant}')
    .join(merchantNumber)
    .split('{amount}')
    .join(String(amount));

  const order = `${existingPayments.length + 1}`.padStart(2, '0');
  const initiatedAt = new Date().toISOString();

  const { item: payment } = await client.createItem('Payments', {
    reference: `PAY-${(ride.reference as string) ?? rideId}-${order}`,
    rideId,
    paymentProviderId: providerId,
    amount,
    platformCommission: split.platformCommission,
    driverPayout: split.driverPayout,
    status: 'Initié',
    payoutStatus: 'À verser',
    payerPhoneNumber: input.payerPhoneNumber,
    ussdString,
    initiatedAt,
  });

  await client.updateItem('Rides', String(rideId), {
    paymentStatus: 'En cours',
    paymentProviderId: providerId,
  });

  return {
    success: true,
    message: `Composez ${ussdString} sur votre téléphone pour régler ${amount} FCFA avec ${(provider.name as string) ?? 'votre opérateur'}.`,
    paymentId: num(payment.id),
    reference: (payment.reference as string) ?? '',
    amount,
    providerName: (provider.name as string) ?? '',
    ussdCode,
    ussdString,
    merchantNumber,
    instructions: (provider.instructions as string) ?? '',
    requiresReference: provider.requiresReference === true,
  };
};
