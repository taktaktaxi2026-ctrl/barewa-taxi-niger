import { BlocksClient, type Item } from '../shared/blocks/blocks-client.ts';
import { num } from '../shared/barewa-fare.ts';
import { isSimulationRide } from '../shared/barewa-rides.ts';
import {
  nigerDateTimeString,
  nigerDayString,
  nigerTimeString,
  normalizeLabel,
} from '../shared/barewa-time.ts';

import { buildCsv, csvToBase64, type CsvCell } from './csv.ts';

interface ExportInput {
  dataset: string;
  fromDate?: string;
  toDate?: string;
  cityId?: number;
}

const DATASETS = [
  'Courses',
  'Paiements',
  'Chauffeurs',
  'Abonnés',
  'Alertes SOS',
  'Grille tarifaire',
];

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const refuse = (message: string): Record<string, unknown> => ({
  success: false,
  message,
});

const text = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

/** Entier FCFA, cellule vide si la valeur n'est pas renseignée. */
const fcfa = (value: unknown): CsvCell =>
  value === null || value === undefined || value === ''
    ? ''
    : Math.round(num(value));

const nameById = (items: Item[], column = 'name'): Map<number, string> => {
  const map = new Map<number, string>();
  items.forEach((item) => map.set(num(item.id), text(item[column])));
  return map;
};

const slugify = (value: string): string =>
  normalizeLabel(value).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

interface Dataset {
  headers: string[];
  rows: CsvCell[][];
}

export const invoke = async (
  input: ExportInput,
  context: Record<string, unknown>,
): Promise<Record<string, unknown>> => {
  const client = new BlocksClient(context as never);

  const dataset = text(input.dataset);
  if (!DATASETS.includes(dataset)) {
    return refuse(
      `Jeu de données inconnu. Valeurs acceptées : ${DATASETS.join(', ')}.`,
    );
  }

  const fromDate = text(input.fromDate);
  const toDate = text(input.toDate);
  if (fromDate && !DAY_PATTERN.test(fromDate)) {
    return refuse('Date de début invalide : le format attendu est AAAA-MM-JJ.');
  }
  if (toDate && !DAY_PATTERN.test(toDate)) {
    return refuse('Date de fin invalide : le format attendu est AAAA-MM-JJ.');
  }
  if (fromDate && toDate && fromDate > toDate) {
    return refuse('La date de début est postérieure à la date de fin.');
  }

  const cityId = num(input.cityId);
  if (cityId > 0) {
    const { items } = await client.queryTable('Cities', {
      from: { table: 'Cities' },
      where: { column: 'id', value: cityId },
      limit: 1,
    });
    if (items.length === 0) return refuse('Ville introuvable.');
  }

  /** Filtre de période : dates comparées en heure du Niger (AAAA-MM-JJ littéral). */
  const inPeriod = (isoUtc: unknown): boolean => {
    if (!fromDate && !toDate) return true;
    const iso = typeof isoUtc === 'string' ? isoUtc : '';
    if (!iso) return false;
    const day = iso.length === 10 ? iso : nigerDayString(iso);
    if (fromDate && day < fromDate) return false;
    if (toDate && day > toDate) return false;
    return true;
  };

  const cities = (
    await client.queryTable('Cities', { from: { table: 'Cities' } })
  ).items;
  const cityNames = nameById(cities);

  let built: Dataset = { headers: [], rows: [] };

  if (dataset === 'Courses' || dataset === 'Paiements') {
    const { items: rawRides } = await client.queryTable('Rides', {
      from: { table: 'Rides' },
      orderBy: [{ column: 'id', direction: 'asc' }],
    });
    const realRides = rawRides.filter(
      (ride) =>
        !isSimulationRide(ride) &&
        (cityId <= 0 || num(ride.cityId) === cityId),
    );

    const vehicleNames = nameById(
      (await client.queryTable('VehicleTypes', { from: { table: 'VehicleTypes' } }))
        .items,
    );
    const passengerNames = nameById(
      (
        await client.queryTable('PassengerProfile', {
          from: { table: 'PassengerProfile' },
        })
      ).items,
      'fullName',
    );
    const driverNames = nameById(
      (await client.queryTable('DriverProfile', { from: { table: 'DriverProfile' } }))
        .items,
      'fullName',
    );

    if (dataset === 'Courses') {
      built = {
        headers: [
          'Référence',
          'Date',
          'Heure',
          'Statut',
          'Ville',
          'Passager',
          'Chauffeur',
          'Type de véhicule',
          'Départ',
          'Arrivée',
          'Distance (km)',
          'Durée (min)',
          'Prix estimé (FCFA)',
          'Prix final (FCFA)',
          'Remise (FCFA)',
          'Commission plateforme (FCFA)',
          'Net chauffeur (FCFA)',
          'Code promo',
          'Statut paiement',
          'Négociation',
          'Note passager',
          'Terminée le',
          'Annulée le',
          'Annulée par',
          "Motif d'annulation",
        ],
        rows: realRides
          .filter((ride) => inPeriod(ride.requestedAt ?? ride.createdAt))
          .map((ride) => {
            const stamp = (ride.requestedAt ?? ride.createdAt) as string;
            return [
              text(ride.reference),
              stamp ? nigerDayString(stamp) : '',
              stamp ? nigerTimeString(stamp) : '',
              text(ride.status),
              cityNames.get(num(ride.cityId)) ?? '',
              passengerNames.get(num(ride.passengerId)) ?? '',
              driverNames.get(num(ride.driverId)) ?? '',
              vehicleNames.get(num(ride.vehicleTypeId)) ?? '',
              text(ride.pickupLabel),
              text(ride.dropoffLabel),
              num(ride.distanceKm),
              Math.round(num(ride.durationMin)),
              fcfa(ride.estimatedFare),
              fcfa(ride.finalFare),
              fcfa(ride.discountAmount),
              fcfa(ride.platformCommission),
              fcfa(ride.driverPayout),
              text(ride.promoCode),
              text(ride.paymentStatus),
              text(ride.negotiationStatus),
              ride.ratingByPassenger === null ||
              ride.ratingByPassenger === undefined
                ? ''
                : num(ride.ratingByPassenger),
              nigerDateTimeString(ride.completedAt as string),
              nigerDateTimeString(ride.cancelledAt as string),
              text(ride.cancelledBy),
              text(ride.cancellationReason),
            ];
          }),
      };
    } else {
      const rideById = new Map<number, Item>();
      realRides.forEach((ride) => rideById.set(num(ride.id), ride));
      const providerNames = nameById(
        (
          await client.queryTable('PaymentProviders', {
            from: { table: 'PaymentProviders' },
          })
        ).items,
      );
      const { items: payments } = await client.queryTable('Payments', {
        from: { table: 'Payments' },
        orderBy: [{ column: 'id', direction: 'asc' }],
      });

      built = {
        headers: [
          'Référence',
          'Date initiation',
          'Date confirmation',
          'Course',
          'Ville',
          'Fournisseur',
          'Montant (FCFA)',
          'Commission plateforme (FCFA)',
          'Net chauffeur (FCFA)',
          'Statut',
          'Statut versement',
          'Téléphone payeur',
          'Référence transaction',
          "Motif d'échec",
        ],
        rows: payments
          .filter((payment) => rideById.has(num(payment.rideId)))
          .filter((payment) => inPeriod(payment.initiatedAt ?? payment.createdAt))
          .map((payment) => {
            const ride = rideById.get(num(payment.rideId)) as Item;
            return [
              text(payment.reference),
              nigerDateTimeString(
                (payment.initiatedAt ?? payment.createdAt) as string,
              ),
              nigerDateTimeString(payment.confirmedAt as string),
              text(ride.reference),
              cityNames.get(num(ride.cityId)) ?? '',
              providerNames.get(num(payment.paymentProviderId)) ?? '',
              fcfa(payment.amount),
              fcfa(payment.platformCommission),
              fcfa(payment.driverPayout),
              text(payment.status),
              text(payment.payoutStatus),
              text(payment.payerPhoneNumber),
              text(payment.transactionReference),
              text(payment.failureReason),
            ];
          }),
      };
    }
  } else if (dataset === 'Chauffeurs') {
    const { items: drivers } = await client.queryTable('DriverProfile', {
      from: { table: 'DriverProfile' },
      orderBy: [{ column: 'id', direction: 'asc' }],
    });
    const vehicleNames = nameById(
      (await client.queryTable('VehicleTypes', { from: { table: 'VehicleTypes' } }))
        .items,
    );
    built = {
      headers: [
        'Nom',
        'Téléphone',
        'WhatsApp',
        'Email',
        'Ville',
        'Type de véhicule',
        'Plaque',
        'Statut vérification',
        'Permis expire le',
        'Langues parlées',
        'Moyens de paiement acceptés',
        'En ligne',
        'Note',
        'Courses effectuées',
        'Gains cumulés (FCFA)',
        'Inscrit le',
        'Dernière position vue le',
      ],
      rows: drivers
        .filter((driver) => cityId <= 0 || num(driver.cityId) === cityId)
        .filter((driver) => inPeriod(driver.joinedOn ?? driver.createdAt))
        .map((driver) => [
          text(driver.fullName),
          text(driver.phoneNumber),
          text(driver.whatsappNumber),
          text(driver.email),
          cityNames.get(num(driver.cityId)) ?? '',
          vehicleNames.get(num(driver.vehicleTypeId)) ?? '',
          text(driver.plateNumber),
          text(driver.verificationStatus),
          text(driver.licenseExpiryDate).slice(0, 10),
          text(driver.spokenLanguages),
          text(driver.acceptedPaymentMethods),
          driver.isOnline === true,
          num(driver.rating),
          Math.round(num(driver.totalRides)),
          fcfa(driver.totalEarnings),
          text(driver.joinedOn).slice(0, 10),
          nigerDateTimeString(driver.lastSeenAt as string),
        ]),
    };
  } else if (dataset === 'Abonnés') {
    const { items: subscribers } = await client.queryTable('Subscribers', {
      from: { table: 'Subscribers' },
      orderBy: [{ column: 'id', direction: 'asc' }],
    });
    const driverNames = nameById(
      (await client.queryTable('DriverProfile', { from: { table: 'DriverProfile' } }))
        .items,
      'fullName',
    );
    built = {
      headers: [
        'Nom du contact',
        'Téléphone',
        'WhatsApp',
        'Chauffeur',
        'Ville',
        'Type de trajet',
        'Ramassage',
        'Destination',
        'Jours actifs',
        'Heure de passage',
        'Prix convenu (FCFA)',
        'Actif',
        'Dernière notification',
        'Notes',
      ],
      rows: subscribers
        .filter((subscriber) => cityId <= 0 || num(subscriber.cityId) === cityId)
        .filter((subscriber) => inPeriod(subscriber.createdAt))
        .map((subscriber) => [
          text(subscriber.contactName),
          text(subscriber.phoneNumber),
          text(subscriber.whatsappNumber),
          driverNames.get(num(subscriber.driverId)) ?? '',
          cityNames.get(num(subscriber.cityId)) ?? '',
          text(subscriber.tripKind),
          text(subscriber.pickupLabel),
          text(subscriber.dropoffLabel),
          text(subscriber.activeDays),
          text(subscriber.pickupTime).slice(0, 5),
          fcfa(subscriber.agreedFare),
          subscriber.isActive === true,
          nigerDateTimeString(subscriber.lastNotifiedAt as string),
          text(subscriber.notes),
        ]),
    };
  } else if (dataset === 'Alertes SOS') {
    const { items: alerts } = await client.queryTable('SosAlerts', {
      from: { table: 'SosAlerts' },
      orderBy: [{ column: 'id', direction: 'asc' }],
    });
    built = {
      headers: [
        'Référence',
        'Date',
        'Déclenchée par',
        'Profil',
        'Email',
        'Téléphone',
        'Nature',
        'Statut',
        'Ville',
        'Latitude',
        'Longitude',
        'Précision (m)',
        'Contacts prévenus',
        'Résolue par',
        'Résolue le',
        'Notes de résolution',
      ],
      rows: alerts
        .filter((alert) => cityId <= 0 || num(alert.cityId) === cityId)
        .filter((alert) => inPeriod(alert.createdAt))
        .map((alert) => [
          text(alert.reference),
          nigerDateTimeString(alert.createdAt as string),
          text(alert.triggeredByName),
          text(alert.triggeredByRole),
          text(alert.triggeredByEmail),
          text(alert.triggeredByPhone),
          text(alert.kind),
          text(alert.status),
          cityNames.get(num(alert.cityId)) ?? '',
          num(alert.latitude),
          num(alert.longitude),
          alert.accuracyMeters === null || alert.accuracyMeters === undefined
            ? ''
            : Math.round(num(alert.accuracyMeters)),
          text(alert.notifiedContacts),
          text(alert.resolvedBy),
          nigerDateTimeString(alert.resolvedAt as string),
          text(alert.resolutionNotes),
        ]),
    };
  } else {
    const { items: grids } = await client.queryTable('FareGrid', {
      from: { table: 'FareGrid' },
      orderBy: [{ column: 'id', direction: 'asc' }],
    });
    const vehicleNames = nameById(
      (await client.queryTable('VehicleTypes', { from: { table: 'VehicleTypes' } }))
        .items,
    );
    built = {
      headers: [
        'Libellé',
        'Ville',
        'Type de véhicule',
        'Prise en charge (FCFA)',
        'Prix au km (FCFA)',
        'Prix à la minute (FCFA)',
        'Prix plancher (FCFA)',
        "Frais d'annulation (FCFA)",
        'Majoration nuit (%)',
        'Majoration heure de pointe (%)',
        'Commission plateforme (%)',
        'Active',
      ],
      rows: grids
        .filter((grid) => cityId <= 0 || num(grid.cityId) === cityId)
        .map((grid) => [
          text(grid.label),
          cityNames.get(num(grid.cityId)) ?? '',
          vehicleNames.get(num(grid.vehicleTypeId)) ?? '',
          fcfa(grid.baseFare),
          fcfa(grid.pricePerKm),
          fcfa(grid.pricePerMinute),
          fcfa(grid.minimumFare),
          fcfa(grid.cancellationFee),
          num(grid.nightSurchargePercent),
          num(grid.peakSurchargePercent),
          num(grid.driverCommissionPercent),
          grid.isActive === true,
        ]),
    };
  }

  const rowCount = built.rows.length;
  const fileName = `barewa-${slugify(dataset)}-${nigerDayString().replace(
    /-/g,
    '',
  )}.csv`;

  if (rowCount === 0) {
    return {
      success: true,
      message: `Aucune ligne à exporter pour « ${dataset} » sur la période demandée : aucun fichier n'a été créé.`,
      rowCount: 0,
      fileName,
      dataset,
    };
  }

  const csv = buildCsv(built.headers, built.rows);
  const upload = (await client.invokeAction('UploadBase64File', {
    base64: csvToBase64(csv),
    fileName,
    mimeType: 'text/csv',
  })) as { protectedUrl?: string; fileName?: string };

  const fileUrl = text(upload?.protectedUrl);
  if (!fileUrl) {
    return refuse(
      "Le fichier CSV a été généré mais son dépôt dans le stockage a échoué. Réessayez dans un instant.",
    );
  }

  return {
    success: true,
    message: `${rowCount} ligne(s) exportée(s) dans ${fileName}.`,
    fileUrl,
    fileName,
    rowCount,
    dataset,
  };
};
