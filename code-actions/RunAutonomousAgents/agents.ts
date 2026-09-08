/**
 * Les cinq agents du Cerveau BAREWA. Chaque agent ne produit que des constats
 * adossés à des chiffres mesurés : aucune valeur n'est inventée, et chaque
 * `body` cite les nombres dont le constat découle.
 */
import type { Item } from '../shared/blocks/blocks-client.ts';
import { nigerLocalHour, num, roadDistanceKm } from '../shared/barewa-fare.ts';
import { msSince, normalizeLabel } from '../shared/barewa-time.ts';

export type AgentName =
  | 'Observateur'
  | 'Analyste'
  | 'Optimiseur'
  | 'Correcteur'
  | 'Communicateur';

export const ALL_AGENTS: AgentName[] = [
  'Observateur',
  'Analyste',
  'Optimiseur',
  'Correcteur',
  'Communicateur',
];

export type Severity =
  | 'Information'
  | 'À surveiller'
  | 'Action recommandée'
  | 'Critique';

export interface InsightDraft {
  agentName: AgentName;
  severity: Severity;
  title: string;
  body: string;
  recommendation: string;
  cityId: number;
  cityName: string;
  metrics: Record<string, unknown>;
}

export interface CityDataset {
  cityId: number;
  cityName: string;
  cityLatitude: number;
  cityLongitude: number;
  lookbackDays: number;
  /** Courses réelles de la période analysée (simulations exclues). */
  rides: Item[];
  /** Courses réelles des 7 derniers jours. */
  rides7d: Item[];
  drivers: Item[];
  onlineDrivers: Item[];
  passengers: Item[];
  /** Paiements rattachés aux courses réelles de la ville. */
  payments: Item[];
  /** Courses réelles non closes, quelle que soit leur ancienneté. */
  openRides: Item[];
  /** Date littérale AAAA-MM-JJ en heure du Niger. */
  today: string;
  /** Identifiants des fournisseurs de paiement en espèces. */
  cashProviderIds: Set<number>;
}

/** Une position de chauffeur au-delà de cette distance du centre-ville est aberrante. */
const OUT_OF_ZONE_KM = 100;
/** Position considérée périmée au-delà de ce délai. */
const STALE_POSITION_MINUTES = 15;
/** Paiement Initié jamais confirmé au-delà de ce délai. */
const STUCK_PAYMENT_HOURS = 24;
/** Course non close au-delà de ce délai. */
const FROZEN_RIDE_HOURS = 12;
/** Charge de référence : courses qu'un chauffeur peut absorber sur 7 jours. */
const RIDES_PER_DRIVER_PER_WEEK = 8;

const percent = (part: number, total: number): number =>
  total > 0 ? Math.round((part / total) * 1000) / 10 : 0;

const rideHour = (ride: Item): number =>
  nigerLocalHour(
    (ride.requestedAt as string) ?? (ride.createdAt as string) ?? undefined,
  );

const hourLabel = (hour: number): string =>
  `${`${hour}`.padStart(2, '0')}h-${`${(hour + 1) % 24}`.padStart(2, '0')}h`;

const splitLanguages = (raw: unknown): string[] =>
  (typeof raw === 'string' ? raw : '')
    .split(/[,;/]/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

/** L'Observateur : santé de l'activité et fraîcheur des positions. */
export const runObservateur = (data: CityDataset): InsightDraft => {
  const total = data.rides.length;
  const completed = data.rides.filter((ride) => ride.status === 'Terminée')
    .length;
  const cancelled = data.rides.filter((ride) => ride.status === 'Annulée')
    .length;
  const cancellationRate = percent(cancelled, total);

  const onlineCount = data.onlineDrivers.length;
  const staleDrivers = data.onlineDrivers.filter((driver) => {
    const elapsed = msSince(driver.lastSeenAt);
    return elapsed === null || elapsed > STALE_POSITION_MINUTES * 60 * 1000;
  });
  const staleCount = staleDrivers.length;
  const stalePercent = percent(staleCount, onlineCount);

  let severity: Severity = 'Information';
  if (onlineCount > 0 && stalePercent > 50) severity = 'Critique';
  else if (total >= 5 && cancellationRate > 30) severity = 'Action recommandée';
  else if (staleCount > 0 || cancellationRate > 15) severity = 'À surveiller';

  const body =
    `Sur ${data.lookbackDays} jour(s) à ${data.cityName} : ${total} course(s) enregistrée(s), ` +
    `${completed} terminée(s), ${cancelled} annulée(s), soit un taux d'annulation de ${cancellationRate} %. ` +
    `${onlineCount} chauffeur(s) déclaré(s) en ligne, dont ${staleCount} sans position fraîche depuis plus de ` +
    `${STALE_POSITION_MINUTES} minutes (${stalePercent} % des chauffeurs en ligne).`;

  const recommendation =
    onlineCount > 0 && stalePercent > 50
      ? `Relancer l'application des ${staleCount} chauffeur(s) concerné(s) : leur position affichée aux passagers n'est plus fiable.`
      : cancellationRate > 15 && total >= 5
        ? `Analyser les ${cancelled} annulation(s) : au-delà de 15 % d'annulations, les passagers se détournent du service.`
        : "Aucune action requise : l'activité et les positions sont dans les normes.";

  return {
    agentName: 'Observateur',
    severity,
    title: `Activité et positions — ${data.cityName}`,
    body,
    recommendation,
    cityId: data.cityId,
    cityName: data.cityName,
    metrics: {
      dataAvailable: true,
      lookbackDays: data.lookbackDays,
      rides: total,
      completedRides: completed,
      cancelledRides: cancelled,
      cancellationRatePercent: cancellationRate,
      driversOnline: onlineCount,
      driversWithStalePosition: staleCount,
      stalePositionPercent: stalePercent,
      stalePositionThresholdMinutes: STALE_POSITION_MINUTES,
    },
  };
};

/** L'Analyste : demande par tranche horaire, en heure du Niger. */
export const runAnalyste = (data: CityDataset): InsightDraft => {
  const counts = new Array<number>(24).fill(0);
  data.rides.forEach((ride) => {
    const hour = rideHour(ride);
    if (hour >= 0 && hour < 24) counts[hour] += 1;
  });
  const series = counts.map((rides, hour) => ({ hour, rides }));
  const total = data.rides.length;
  const avgPerDay =
    data.lookbackDays > 0
      ? Math.round((total / data.lookbackDays) * 10) / 10
      : 0;

  let peakHour = 0;
  counts.forEach((value, hour) => {
    if (value > counts[peakHour]) peakHour = hour;
  });
  const peakRides = counts[peakHour];
  const peakShare = percent(peakRides, total);

  const severity: Severity =
    total === 0
      ? 'Information'
      : peakShare >= 25
        ? 'Action recommandée'
        : 'À surveiller';

  const body =
    `${total} course(s) réparties sur 24 tranches horaires à ${data.cityName} (heure du Niger, ${data.lookbackDays} jour(s) d'historique). ` +
    `Moyenne de ${avgPerDay} course(s) par jour. Tranche la plus chargée : ${hourLabel(peakHour)} avec ` +
    `${peakRides} course(s), soit ${peakShare} % de la demande.`;

  return {
    agentName: 'Analyste',
    severity,
    title: `Demande par tranche horaire — ${data.cityName}`,
    body,
    recommendation:
      total === 0
        ? 'Aucune recommandation possible : pas de course sur la période.'
        : `Couvrir en priorité la tranche ${hourLabel(peakHour)} : c'est là que se concentrent ${peakShare} % des demandes de ${data.cityName}.`,
    cityId: data.cityId,
    cityName: data.cityName,
    metrics: {
      dataAvailable: total > 0,
      lookbackDays: data.lookbackDays,
      rides: total,
      averageRidesPerDay: avgPerDay,
      peakHour,
      peakHourLabel: hourLabel(peakHour),
      peakHourRides: peakRides,
      peakHourSharePercent: peakShare,
      series,
    },
  };
};

/** L'Optimiseur : offre de chauffeurs face à la demande des 7 derniers jours. */
export const runOptimiseur = (data: CityDataset): InsightDraft => {
  const demand7 = data.rides7d.length;
  const availableDrivers = data.onlineDrivers.length;
  const demandPerDriver =
    availableDrivers > 0
      ? Math.round((demand7 / availableDrivers) * 10) / 10
      : 0;
  const neededDrivers = Math.ceil(demand7 / RIDES_PER_DRIVER_PER_WEEK);
  const gap = neededDrivers - availableDrivers;

  const underCovered = gap > 0;
  const overCovered = !underCovered && availableDrivers >= 3 && gap <= -3;

  const severity: Severity = underCovered
    ? gap >= 3
      ? 'Critique'
      : 'Action recommandée'
    : overCovered
      ? 'À surveiller'
      : 'Information';

  const coverage = underCovered
    ? 'sous-couverte'
    : overCovered
      ? 'sur-couverte'
      : 'équilibrée';

  const body =
    `${data.cityName} : ${demand7} course(s) demandée(s) sur les 7 derniers jours pour ${availableDrivers} chauffeur(s) ` +
    `en ligne, vérifiés et disponibles, soit ${demandPerDriver} course(s) par chauffeur. ` +
    `À raison de ${RIDES_PER_DRIVER_PER_WEEK} courses par chauffeur et par semaine, il en faudrait ${neededDrivers} : ` +
    `la ville est ${coverage} (écart de ${gap > 0 ? '+' : ''}${gap} chauffeur(s)).`;

  const recommendation = underCovered
    ? `Repositionner ${gap} chauffeur(s) vers ${data.cityName} ou en recruter autant : la demande dépasse la capacité en ligne.`
    : overCovered
      ? `Proposer à ${Math.abs(gap)} chauffeur(s) de ${data.cityName} de se repositionner vers une ville sous-couverte : l'offre y dépasse largement la demande.`
      : `Maintenir les ${availableDrivers} chauffeur(s) en ligne à ${data.cityName} : l'offre couvre la demande observée.`;

  return {
    agentName: 'Optimiseur',
    severity,
    title: `Couverture chauffeurs — ${data.cityName}`,
    body,
    recommendation,
    cityId: data.cityId,
    cityName: data.cityName,
    metrics: {
      dataAvailable: true,
      demandLast7Days: demand7,
      availableDrivers,
      demandPerDriver,
      neededDrivers,
      driverGap: gap,
      coverage,
      ridesPerDriverPerWeekReference: RIDES_PER_DRIVER_PER_WEEK,
    },
  };
};

/** Le Correcteur : anomalies factuelles, chacune comptée et nommée. */
export const runCorrecteur = (data: CityDataset): InsightDraft => {
  const outOfZone = data.drivers.filter((driver) => {
    const lat = driver.currentLatitude;
    const lon = driver.currentLongitude;
    if (lat === null || lat === undefined || lon === null || lon === undefined) {
      return false;
    }
    if (!Number.isFinite(data.cityLatitude) || !Number.isFinite(data.cityLongitude)) {
      return false;
    }
    return (
      roadDistanceKm(
        data.cityLatitude,
        data.cityLongitude,
        num(lat),
        num(lon),
      ) > OUT_OF_ZONE_KM
    );
  });

  const expiredLicences = data.drivers.filter((driver) => {
    if (driver.verificationStatus !== 'Vérifié') return false;
    const expiry = typeof driver.licenseExpiryDate === 'string'
      ? driver.licenseExpiryDate.slice(0, 10)
      : '';
    return expiry !== '' && expiry < data.today;
  });

  const stuckPayments = data.payments.filter((payment) => {
    if (payment.status !== 'Initié') return false;
    if (payment.confirmedAt) return false;
    const elapsed = msSince(payment.initiatedAt ?? payment.createdAt);
    return elapsed !== null && elapsed > STUCK_PAYMENT_HOURS * 60 * 60 * 1000;
  });

  const frozenRides = data.openRides.filter((ride) => {
    const elapsed = msSince(ride.requestedAt ?? ride.createdAt);
    return elapsed !== null && elapsed > FROZEN_RIDE_HOURS * 60 * 60 * 1000;
  });

  const totalAnomalies =
    outOfZone.length +
    expiredLicences.length +
    stuckPayments.length +
    frozenRides.length;

  const severity: Severity =
    totalAnomalies === 0
      ? 'Information'
      : totalAnomalies >= 5
        ? 'Critique'
        : 'Action recommandée';

  const named: string[] = [];
  if (outOfZone.length > 0) {
    named.push(
      `${outOfZone.length} chauffeur(s) positionné(s) à plus de ${OUT_OF_ZONE_KM} km du centre de ${data.cityName} (${outOfZone
        .map((driver) => (driver.fullName as string) ?? `#${num(driver.id)}`)
        .join(', ')})`,
    );
  }
  if (expiredLicences.length > 0) {
    named.push(
      `${expiredLicences.length} chauffeur(s) au statut Vérifié avec un permis expiré (${expiredLicences
        .map(
          (driver) =>
            `${(driver.fullName as string) ?? `#${num(driver.id)}`} — ${
              (driver.licenseExpiryDate as string) ?? ''
            }`,
        )
        .join(', ')})`,
    );
  }
  if (stuckPayments.length > 0) {
    named.push(
      `${stuckPayments.length} paiement(s) au statut Initié depuis plus de ${STUCK_PAYMENT_HOURS} h sans confirmation (${stuckPayments
        .map((payment) => (payment.reference as string) ?? `#${num(payment.id)}`)
        .join(', ')})`,
    );
  }
  if (frozenRides.length > 0) {
    named.push(
      `${frozenRides.length} course(s) non close(s) depuis plus de ${FROZEN_RIDE_HOURS} h (${frozenRides
        .map((ride) => (ride.reference as string) ?? `#${num(ride.id)}`)
        .join(', ')})`,
    );
  }

  const body =
    totalAnomalies === 0
      ? `Aucune anomalie détectée à ${data.cityName} : positions dans la zone, permis à jour, paiements confirmés, aucune course figée.`
      : `${totalAnomalies} anomalie(s) détectée(s) à ${data.cityName} : ${named.join(' ; ')}.`;

  return {
    agentName: 'Correcteur',
    severity,
    title: `Anomalies détectées — ${data.cityName}`,
    body,
    recommendation:
      totalAnomalies === 0
        ? 'Aucune correction à apporter.'
        : "Traiter les anomalies listées : rectifier les positions, suspendre les permis expirés, relancer ou annuler les paiements bloqués et clôturer les courses figées.",
    cityId: data.cityId,
    cityName: data.cityName,
    metrics: {
      dataAvailable: true,
      driversOutOfZone: outOfZone.length,
      outOfZoneThresholdKm: OUT_OF_ZONE_KM,
      verifiedDriversWithExpiredLicense: expiredLicences.length,
      stuckPayments: stuckPayments.length,
      stuckPaymentThresholdHours: STUCK_PAYMENT_HOURS,
      frozenRides: frozenRides.length,
      frozenRideThresholdHours: FROZEN_RIDE_HOURS,
      totalAnomalies,
    },
  };
};

/** Le Communicateur : couverture des langues et des moyens de paiement. */
export const runCommunicateur = (data: CityDataset): InsightDraft => {
  const passengerLanguages: Record<string, number> = {};
  data.passengers.forEach((passenger) => {
    const language = (passenger.preferredLanguage as string) ?? '';
    if (!language) return;
    passengerLanguages[language] = (passengerLanguages[language] ?? 0) + 1;
  });

  const driverLanguages: Record<string, number> = {};
  data.drivers.forEach((driver) => {
    splitLanguages(driver.spokenLanguages).forEach((language) => {
      driverLanguages[language] = (driverLanguages[language] ?? 0) + 1;
    });
  });

  const normalizedDriverLanguages = new Map<string, number>();
  Object.keys(driverLanguages).forEach((language) => {
    const key = normalizeLabel(language);
    normalizedDriverLanguages.set(
      key,
      (normalizedDriverLanguages.get(key) ?? 0) + driverLanguages[language],
    );
  });

  const uncoveredLanguages: string[] = [];
  const fragileLanguages: string[] = [];
  Object.keys(passengerLanguages).forEach((language) => {
    const speakers = normalizedDriverLanguages.get(normalizeLabel(language)) ?? 0;
    if (speakers === 0) uncoveredLanguages.push(language);
    else if (speakers === 1) fragileLanguages.push(language);
  });

  const confirmedPayments = data.payments.filter(
    (payment) => payment.status === 'Confirmé',
  );
  const cashPayments = confirmedPayments.filter((payment) =>
    data.cashProviderIds.has(num(payment.paymentProviderId)),
  );
  const mobileMoneyPayments = confirmedPayments.length - cashPayments.length;
  const mobileMoneySharePercent = percent(
    mobileMoneyPayments,
    confirmedPayments.length,
  );
  const cashSharePercent = percent(cashPayments.length, confirmedPayments.length);

  const severity: Severity =
    uncoveredLanguages.length > 0
      ? 'Action recommandée'
      : fragileLanguages.length > 0
        ? 'À surveiller'
        : 'Information';

  const languageSentence =
    uncoveredLanguages.length > 0
      ? `Langue(s) demandée(s) par des passagers et parlée(s) par aucun chauffeur de ${data.cityName} : ${uncoveredLanguages.join(', ')}.`
      : fragileLanguages.length > 0
        ? `Langue(s) couverte(s) par un seul chauffeur de ${data.cityName} : ${fragileLanguages.join(', ')}.`
        : `Toutes les langues demandées à ${data.cityName} sont parlées par au moins deux chauffeurs.`;

  const body =
    `${data.passengers.length} passager(s) et ${data.drivers.length} chauffeur(s) recensés à ${data.cityName}. ` +
    `Langues des passagers : ${
      Object.keys(passengerLanguages).length > 0
        ? Object.keys(passengerLanguages)
            .map((language) => `${language} ${passengerLanguages[language]}`)
            .join(', ')
        : 'non renseignées'
    }. Langues des chauffeurs : ${
      Object.keys(driverLanguages).length > 0
        ? Object.keys(driverLanguages)
            .map((language) => `${language} ${driverLanguages[language]}`)
            .join(', ')
        : 'non renseignées'
    }. ${languageSentence} Paiements confirmés : ${confirmedPayments.length}, dont ` +
    `${mobileMoneyPayments} en mobile money (${mobileMoneySharePercent} %) et ${cashPayments.length} en espèces (${cashSharePercent} %).`;

  const recommendation =
    uncoveredLanguages.length > 0
      ? `Recruter ou former des chauffeurs parlant ${uncoveredLanguages.join(', ')} à ${data.cityName}.`
      : fragileLanguages.length > 0
        ? `Renforcer la couverture de ${fragileLanguages.join(', ')} à ${data.cityName} : un seul chauffeur la parle, son absence coupe la communication.`
        : cashSharePercent > 70 && confirmedPayments.length > 0
          ? `Promouvoir le mobile money à ${data.cityName} : ${cashSharePercent} % des paiements confirmés se font encore en espèces.`
          : 'Couverture des langues et des paiements satisfaisante.';

  return {
    agentName: 'Communicateur',
    severity,
    title: `Langues et paiements — ${data.cityName}`,
    body,
    recommendation,
    cityId: data.cityId,
    cityName: data.cityName,
    metrics: {
      dataAvailable: true,
      passengers: data.passengers.length,
      drivers: data.drivers.length,
      passengerLanguages,
      driverLanguages,
      uncoveredLanguages,
      singleDriverLanguages: fragileLanguages,
      confirmedPayments: confirmedPayments.length,
      mobileMoneyPayments,
      cashPayments: cashPayments.length,
      mobileMoneySharePercent,
      cashSharePercent,
    },
  };
};

/** Constat explicite quand une ville n'a aucune donnée exploitable. */
export const noDataInsight = (
  agentName: AgentName,
  data: CityDataset,
): InsightDraft => ({
  agentName,
  severity: 'Information',
  title: `Aucune donnée exploitable — ${data.cityName}`,
  body:
    `${data.cityName} n'a produit aucune donnée exploitable sur ${data.lookbackDays} jour(s) : ` +
    `0 course, ${data.drivers.length} chauffeur(s) et ${data.passengers.length} passager(s) enregistrés. ` +
    `Aucun constat ne peut être établi sans données.`,
  recommendation:
    'Vérifier que la ville est bien ouverte au service et que des chauffeurs y sont inscrits avant d’attendre des mesures.',
  cityId: data.cityId,
  cityName: data.cityName,
  metrics: {
    dataAvailable: false,
    lookbackDays: data.lookbackDays,
    rides: 0,
    drivers: data.drivers.length,
    passengers: data.passengers.length,
  },
});

export const runAgent = (
  agentName: AgentName,
  data: CityDataset,
): InsightDraft => {
  switch (agentName) {
    case 'Observateur':
      return runObservateur(data);
    case 'Analyste':
      return runAnalyste(data);
    case 'Optimiseur':
      return runOptimiseur(data);
    case 'Correcteur':
      return runCorrecteur(data);
    default:
      return runCommunicateur(data);
  }
};
