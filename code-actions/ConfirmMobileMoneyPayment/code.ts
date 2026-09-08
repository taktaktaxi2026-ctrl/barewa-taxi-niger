import { BlocksClient } from '../shared/blocks/blocks-client.ts';
import { num } from '../shared/barewa-fare.ts';

interface ConfirmInput {
  paymentId: number;
  transactionReference: string;
}

const refuse = (message: string): Record<string, unknown> => ({
  success: false,
  message,
});

export const invoke = async (
  input: ConfirmInput,
  context: Record<string, unknown>,
): Promise<Record<string, unknown>> => {
  const client = new BlocksClient(context as never);

  const paymentId = num(input.paymentId);
  const reference = (input.transactionReference ?? '').trim();

  const { items: payments } = await client.queryTable('Payments', {
    from: { table: 'Payments' },
    where: { column: 'id', value: paymentId },
    limit: 1,
  });
  const payment = payments[0];
  if (!payment) return refuse('Règlement introuvable.');
  if (payment.status === 'Confirmé') {
    return refuse('Ce règlement est déjà confirmé.');
  }
  if (payment.status === 'Remboursé') {
    return refuse('Ce règlement a été remboursé, il ne peut plus être confirmé.');
  }
  if (!reference) {
    return refuse('Saisissez la référence de transaction reçue par SMS.');
  }
  if (reference.length < 4) {
    return refuse(
      'Référence de transaction trop courte : elle doit comporter au moins 4 caractères.',
    );
  }

  const normalized = reference.replace(/\s+/g, '').toUpperCase();
  const { items: allPayments } = await client.queryTable('Payments', {
    from: { table: 'Payments' },
    select: [{ column: 'id' }, { column: 'transactionReference' }],
  });
  const duplicate = allPayments.find(
    (other) =>
      num(other.id) !== paymentId &&
      ((other.transactionReference as string) ?? '')
        .replace(/\s+/g, '')
        .toUpperCase() === normalized,
  );
  if (duplicate) {
    return refuse(
      'Cette référence de transaction a déjà été utilisée pour un autre règlement.',
    );
  }

  const rideId = num(payment.rideId);
  const { items: rides } = await client.queryTable('Rides', {
    from: { table: 'Rides' },
    where: { column: 'id', value: rideId },
    limit: 1,
  });
  if (!rides[0]) {
    return refuse('La course rattachée à ce règlement est introuvable.');
  }

  const confirmedAt = new Date().toISOString();
  await client.updateItem('Payments', String(paymentId), {
    status: 'Confirmé',
    transactionReference: normalized,
    confirmedAt,
    payoutStatus: 'À verser',
  });

  await client.updateItem('Rides', String(rideId), {
    paymentStatus: 'Payé',
  });
  const ridePaymentStatus = 'Payé';

  return {
    success: true,
    message: `Paiement de ${num(payment.amount)} FCFA confirmé. Merci d’avoir voyagé avec BAREWA.`,
    paymentId,
    status: 'Confirmé',
    amount: num(payment.amount),
    ridePaymentStatus,
    driverPayout: num(payment.driverPayout),
  };
};
