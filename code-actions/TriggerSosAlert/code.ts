import { BlocksClient, type Item } from '../shared/blocks/blocks-client.ts';
import {
  emergencyNumberOf,
  getCompanySettings,
  supervisorPhoneOf,
} from '../shared/barewa-company.ts';
import { num } from '../shared/barewa-fare.ts';
import { buildMapsUrl, sendSms } from '../shared/barewa-sms.ts';
import { nigerShifted } from '../shared/barewa-time.ts';

interface SosInput {
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
  triggeredByEmail?: string;
  triggeredByRole?: 'Passager' | 'Chauffeur' | 'Admin';
  rideId?: number;
  cityId?: number;
  kind?: string;
}

interface NotifiedContact {
  name: string;
  phoneNumber: string;
  role: string;
  delivered: boolean;
}

const KINDS = [
  'Danger immédiat',
  'Accident',
  'Panne',
  'Agression',
  'Malaise',
  'Autre',
];

const refuse = (message: string): Record<string, unknown> => ({
  success: false,
  message,
});

const text = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

/** Référence SOS-<année>-<compteur à 4 chiffres>, unicité vérifiée en base. */
const generateReference = async (client: BlocksClient): Promise<string> => {
  const year = nigerShifted().getUTCFullYear();
  const { items } = await client.queryTable('SosAlerts', {
    from: { table: 'SosAlerts' },
  });
  const prefix = `SOS-${year}-`;
  const used = new Set(
    items.map((item) => text(item.reference)).filter((ref) => ref.length > 0),
  );
  let counter = items.filter((item) => text(item.reference).startsWith(prefix))
    .length;
  for (let attempt = 0; attempt < 10000; attempt += 1) {
    counter += 1;
    const candidate = `${prefix}${`${counter}`.padStart(4, '0')}`;
    if (!used.has(candidate)) return candidate;
  }
  return `${prefix}${Date.now().toString().slice(-4)}`;
};

const findByEmail = async (
  client: BlocksClient,
  table: 'PassengerProfile' | 'DriverProfile',
  email: string,
): Promise<Item | null> => {
  if (!email) return null;
  const { items } = await client.queryTable(table, {
    from: { table },
  });
  const normalized = email.toLowerCase();
  return (
    items.find((item) => text(item.email).toLowerCase() === normalized) ?? null
  );
};

export const invoke = async (
  input: SosInput,
  context: Record<string, unknown>,
): Promise<Record<string, unknown>> => {
  const client = new BlocksClient(context as never);

  const latitude = num(input.latitude, Number.NaN);
  const longitude = num(input.longitude, Number.NaN);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    return refuse('Position invalide : latitude illisible.');
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return refuse('Position invalide : longitude illisible.');
  }

  const kind = KINDS.includes(text(input.kind))
    ? text(input.kind)
    : 'Danger immédiat';
  const email = text(input.triggeredByEmail);
  const nowIso = new Date().toISOString();

  const passengerByEmail = await findByEmail(client, 'PassengerProfile', email);
  const driverByEmail = passengerByEmail
    ? null
    : await findByEmail(client, 'DriverProfile', email);

  let role = text(input.triggeredByRole);
  if (role !== 'Passager' && role !== 'Chauffeur' && role !== 'Admin') {
    role = driverByEmail ? 'Chauffeur' : 'Passager';
  }

  const selfProfile = passengerByEmail ?? driverByEmail;
  const triggeredByName = text(selfProfile?.fullName) || email || 'Utilisateur';
  const triggeredByPhone = text(selfProfile?.phoneNumber);

  // Course en cours : sert à prévenir l'autre partie.
  let ride: Item | null = null;
  const rideId = num(input.rideId);
  if (rideId > 0) {
    const { items } = await client.queryTable('Rides', {
      from: { table: 'Rides' },
      where: { column: 'id', value: rideId },
      limit: 1,
    });
    ride = items[0] ?? null;
  }

  let cityId = num(input.cityId);
  if (cityId <= 0) {
    cityId = num(ride?.cityId ?? selfProfile?.cityId);
  }
  let cityName = '';
  if (cityId > 0) {
    const { items } = await client.queryTable('Cities', {
      from: { table: 'Cities' },
      where: { column: 'id', value: cityId },
      limit: 1,
    });
    cityName = text(items[0]?.name);
  }

  const settings = await getCompanySettings(client);
  const emergencyNumber = emergencyNumberOf(settings);
  const supervisorPhone = supervisorPhoneOf(settings);
  const mapsUrl = buildMapsUrl(latitude, longitude);
  const reference = await generateReference(client);

  const { item: alert } = await client.createItem('SosAlerts', {
    reference,
    triggeredByEmail: email || null,
    triggeredByRole: role,
    triggeredByName,
    triggeredByPhone: triggeredByPhone || null,
    rideId: rideId > 0 ? rideId : null,
    cityId: cityId > 0 ? cityId : null,
    latitude,
    longitude,
    accuracyMeters:
      input.accuracyMeters !== undefined && input.accuracyMeters !== null
        ? num(input.accuracyMeters)
        : null,
    kind,
    status: 'Ouverte',
  });

  // Destinataires du SMS d'alerte.
  const recipients: Array<{ name: string; phoneNumber: string; role: string }> =
    [];
  const pushRecipient = (
    name: string,
    phoneNumber: string,
    contactRole: string,
  ): void => {
    const phone = text(phoneNumber);
    if (!phone) return;
    if (recipients.some((entry) => entry.phoneNumber === phone)) return;
    recipients.push({
      name: text(name) || contactRole,
      phoneNumber: phone,
      role: contactRole,
    });
  };

  // Contact d'urgence du passager (celui du profil déclencheur, sinon celui de la course).
  let passengerProfile = passengerByEmail;
  if (!passengerProfile && ride && num(ride.passengerId) > 0) {
    const { items } = await client.queryTable('PassengerProfile', {
      from: { table: 'PassengerProfile' },
      where: { column: 'id', value: num(ride.passengerId) },
      limit: 1,
    });
    passengerProfile = items[0] ?? null;
  }
  if (passengerProfile) {
    pushRecipient(
      text(passengerProfile.emergencyContactName) || "Contact d'urgence",
      text(passengerProfile.emergencyContactPhone),
      "Contact d'urgence",
    );
  }

  // L'autre partie de la course.
  if (ride) {
    if (role === 'Chauffeur' && passengerProfile) {
      pushRecipient(
        text(passengerProfile.fullName),
        text(passengerProfile.phoneNumber),
        'Passager de la course',
      );
    }
    const rideDriverId = num(ride.driverId);
    if (role !== 'Chauffeur' && rideDriverId > 0) {
      const { items } = await client.queryTable('DriverProfile', {
        from: { table: 'DriverProfile' },
        where: { column: 'id', value: rideDriverId },
        limit: 1,
      });
      const driver = items[0];
      if (driver) {
        pushRecipient(
          text(driver.fullName),
          text(driver.phoneNumber),
          'Chauffeur de la course',
        );
      }
    }
  }

  if (supervisorPhone) {
    pushRecipient('Superviseur BAREWA', supervisorPhone, 'Superviseur');
  }

  const placeLabel = cityName || 'position inconnue';
  const smsBody = `ALERTE BAREWA — ${triggeredByName} a déclenché une alerte à ${placeLabel}. Nature : ${kind}. Position : ${mapsUrl}. Réf ${reference}.`;

  const notifiedContacts: NotifiedContact[] = [];
  for (const recipient of recipients) {
    const result = await sendSms(client, recipient.phoneNumber, smsBody);
    notifiedContacts.push({
      name: recipient.name,
      phoneNumber: recipient.phoneNumber,
      role: recipient.role,
      delivered: result.delivered,
    });
  }

  const alertId = num(alert.id);
  if (notifiedContacts.length > 0) {
    await client.updateItem('SosAlerts', String(alertId), {
      notifiedContacts: notifiedContacts
        .map(
          (contact) =>
            `${contact.role} ${contact.name} (${contact.phoneNumber}) : ${
              contact.delivered ? 'SMS envoyé' : 'SMS non envoyé'
            }`,
        )
        .join(' | '),
    });
  }

  const deliveredCount = notifiedContacts.filter(
    (contact) => contact.delivered,
  ).length;

  const whatsappShareText = `ALERTE BAREWA — ${triggeredByName} a besoin d'aide (${kind}) à ${placeLabel}. Position : ${mapsUrl}. Réf ${reference}. Secours : ${emergencyNumber}.`;

  return {
    success: true,
    message:
      deliveredCount > 0
        ? `Alerte ${reference} enregistrée. ${deliveredCount} contact(s) prévenu(s) par SMS. Appelez le ${emergencyNumber} si vous êtes en danger immédiat.`
        : `Alerte ${reference} enregistrée. Aucun contact n'a pu être prévenu par SMS : appelez le ${emergencyNumber}.`,
    alertId,
    reference,
    emergencyNumber,
    mapsUrl,
    whatsappShareText,
    notifiedContacts,
  };
};
