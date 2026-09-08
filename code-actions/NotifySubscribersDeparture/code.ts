import { BlocksClient } from '../shared/blocks/blocks-client.ts';
import { num } from '../shared/barewa-fare.ts';
import { buildWhatsappUrl, sendSms } from '../shared/barewa-sms.ts';
import { activeDaysInclude } from '../shared/barewa-time.ts';

interface NotifyInput {
  driverId: number;
  dayOfWeek?: string;
  departureTime?: string;
  customMessage?: string;
}

interface SubscriberResult {
  subscriberId: number;
  contactName: string;
  phoneNumber: string;
  smsDelivered: boolean;
  failureReason: string;
  whatsappUrl: string;
  messageText: string;
}

const TIME_PATTERN = /^\d{1,2}:\d{2}$/;

const refuse = (message: string): Record<string, unknown> => ({
  success: false,
  message,
  notifiedCount: 0,
  failedCount: 0,
  subscribers: [],
});

const text = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

export const invoke = async (
  input: NotifyInput,
  context: Record<string, unknown>,
): Promise<Record<string, unknown>> => {
  const client = new BlocksClient(context as never);

  const driverId = num(input.driverId);
  if (driverId <= 0) {
    return refuse('Chauffeur non identifié.');
  }

  const departureTime = text(input.departureTime);
  if (departureTime && !TIME_PATTERN.test(departureTime)) {
    return refuse("L'heure de départ doit être au format HH:MM.");
  }

  const { items: drivers } = await client.queryTable('DriverProfile', {
    from: { table: 'DriverProfile' },
    where: { column: 'id', value: driverId },
    limit: 1,
  });
  const driver = drivers[0];
  if (!driver) return refuse('Profil chauffeur introuvable.');
  const driverName = text(driver.fullName) || 'Votre chauffeur BAREWA';

  const { items: allSubscribers } = await client.queryTable('Subscribers', {
    from: { table: 'Subscribers' },
    where: {
      and: [
        { column: 'driverId', value: driverId },
        { column: 'isActive', value: true },
      ],
    },
    orderBy: [{ column: 'id', direction: 'asc' }],
  });

  const dayOfWeek = text(input.dayOfWeek);
  const subscribers = dayOfWeek
    ? allSubscribers.filter((subscriber) =>
        activeDaysInclude(subscriber.activeDays, dayOfWeek),
      )
    : allSubscribers;

  if (subscribers.length === 0) {
    return {
      success: true,
      message: dayOfWeek
        ? `Aucun abonné actif pour le ${dayOfWeek.toLowerCase()}.`
        : 'Aucun abonné actif à prévenir.',
      notifiedCount: 0,
      failedCount: 0,
      subscribers: [],
    };
  }

  const customMessage = text(input.customMessage);
  const nowIso = new Date().toISOString();
  const results: SubscriberResult[] = [];

  for (const subscriber of subscribers) {
    // `pickupTime` est une heure murale littérale : aucune conversion de fuseau.
    const time = departureTime || text(subscriber.pickupTime).slice(0, 5);
    const pickupLabel = text(subscriber.pickupLabel);
    const agreedFare = num(subscriber.agreedFare);
    const contactName = text(subscriber.contactName) || 'Abonné';

    const parts = [`BAREWA — ${driverName} prend la route`];
    if (time) parts.push(`Passage prévu à ${time}`);
    if (pickupLabel) parts.push(`Ramassage : ${pickupLabel}`);
    if (agreedFare > 0) parts.push(`Prix convenu : ${agreedFare} FCFA`);
    if (customMessage) parts.push(customMessage);
    const messageText = `${parts.join('. ')}.`;

    const callNumber = text(subscriber.phoneNumber);
    const whatsappNumber = text(subscriber.whatsappNumber) || callNumber;

    const smsResult = await sendSms(client, callNumber, messageText);
    if (smsResult.delivered) {
      await client.updateItem('Subscribers', String(num(subscriber.id)), {
        lastNotifiedAt: nowIso,
      });
    }

    results.push({
      subscriberId: num(subscriber.id),
      contactName,
      phoneNumber: callNumber,
      smsDelivered: smsResult.delivered,
      failureReason: smsResult.failureReason,
      whatsappUrl: buildWhatsappUrl(whatsappNumber, messageText),
      messageText,
    });
  }

  const notifiedCount = results.filter((result) => result.smsDelivered).length;
  const failedCount = results.length - notifiedCount;

  return {
    success: true,
    message:
      failedCount === 0
        ? `${notifiedCount} abonné(s) prévenu(s) par SMS.`
        : `${notifiedCount} abonné(s) prévenu(s), ${failedCount} SMS non parti(s) — utilisez le lien WhatsApp pour les joindre.`,
    notifiedCount,
    failedCount,
    subscribers: results,
  };
};
