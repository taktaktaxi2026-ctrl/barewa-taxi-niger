/**
 * Règles de calcul communes à BAREWA (Niger).
 * Monnaie : Franc CFA (XOF), entiers uniquement, jamais de décimales.
 * Toute chaîne visible par l'utilisateur est en français.
 */

export const CURRENCY = 'FCFA';

/** Facteur de sinuosité routière appliqué à la distance orthodromique. */
const ROAD_WINDING_FACTOR = 1.35;
/** Rayon terrestre en kilomètres. */
const EARTH_RADIUS_KM = 6371;
/** Vitesse moyenne de circulation (km/h). */
const SPEED_NIAMEY_KMH = 22;
const SPEED_OTHER_KMH = 28;
/** Forfait de prise en charge ajouté à la durée de trajet (minutes). */
const PICKUP_OVERHEAD_MIN = 2;
/** Le Niger est à UTC+1 toute l'année, sans changement d'heure. */
const NIGER_UTC_OFFSET_HOURS = 1;

export interface FareGridRow {
  id: number;
  cityId?: number;
  vehicleTypeId?: number;
  baseFare?: number;
  pricePerKm?: number;
  pricePerMinute?: number;
  minimumFare?: number;
  cancellationFee?: number;
  nightSurchargePercent?: number;
  peakSurchargePercent?: number;
  driverCommissionPercent?: number;
  isActive?: boolean;
}

export interface PromoCodeRow {
  id: number;
  code?: string;
  discountType?: string;
  discountValue?: number;
  maxDiscountAmount?: number;
  minimumFare?: number;
  cityId?: number;
  validFrom?: string;
  validUntil?: string;
  maxUses?: number;
  usedCount?: number;
  isActive?: boolean;
}

export interface SurgeInfo {
  isNight: boolean;
  isPeak: boolean;
  nightPercent: number;
  peakPercent: number;
  surgePercent: number;
}

export interface FareBreakdown {
  fareBeforeDiscount: number;
  surgePercent: number;
  discountAmount: number;
  finalFare: number;
  platformCommission: number;
  driverPayout: number;
}

const toNumber = (value: unknown, fallback = 0): number => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const num = toNumber;

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

/** Distance orthodromique brute en kilomètres (haversine, rayon 6371 km). */
export const haversineKm = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number => {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
};

/**
 * Distance réelle approchée par la route : haversine × 1,35,
 * arrondie à 0,1 km, avec un plancher de 0,3 km.
 */
export const roadDistanceKm = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number => {
  const raw = haversineKm(lat1, lon1, lat2, lon2) * ROAD_WINDING_FACTOR;
  const rounded = Math.round(raw * 10) / 10;
  return Math.max(0.3, rounded);
};

/** Vitesse moyenne de circulation de la ville, en km/h. */
export const citySpeedKmh = (cityName?: string): number =>
  (cityName ?? '').trim().toLowerCase().startsWith('niamey')
    ? SPEED_NIAMEY_KMH
    : SPEED_OTHER_KMH;

/** Durée de trajet estimée en minutes (forfait de prise en charge inclus, minimum 3 min). */
export const travelDurationMin = (
  distanceKm: number,
  cityName?: string,
): number => {
  const minutes =
    (distanceKm / citySpeedKmh(cityName)) * 60 + PICKUP_OVERHEAD_MIN;
  return Math.max(3, Math.round(minutes));
};

/** Délai d'approche du chauffeur en minutes (minimum 2 min). */
export const driverEtaMin = (distanceKm: number, cityName?: string): number => {
  const minutes = (distanceKm / citySpeedKmh(cityName)) * 60;
  return Math.max(2, Math.round(minutes));
};

/** Heure locale du Niger (UTC+1, sans changement d'heure) déduite d'une date ISO UTC. */
export const nigerLocalHour = (isoUtc?: string): number => {
  const date = isoUtc ? new Date(isoUtc) : new Date();
  const base = Number.isNaN(date.getTime()) ? new Date() : date;
  return (base.getUTCHours() + NIGER_UTC_OFFSET_HOURS + 24) % 24;
};

/** Majorations de nuit (>=22h ou <5h) et d'heure de pointe (7h-9h, 17h-19h). Elles se cumulent. */
export const computeSurge = (
  grid: FareGridRow,
  isoUtc?: string,
): SurgeInfo => {
  const hour = nigerLocalHour(isoUtc);
  const isNight = hour >= 22 || hour < 5;
  const isPeak = (hour >= 7 && hour < 9) || (hour >= 17 && hour < 19);
  const nightPercent = isNight ? toNumber(grid.nightSurchargePercent) : 0;
  const peakPercent = isPeak ? toNumber(grid.peakSurchargePercent) : 0;
  return {
    isNight,
    isPeak,
    nightPercent,
    peakPercent,
    surgePercent: nightPercent + peakPercent,
  };
};

/** Arrondi au multiple de 25 FCFA supérieur (pièces courantes au Niger). */
export const roundUpTo25 = (amount: number): number =>
  Math.ceil(Math.max(0, amount) / 25) * 25;

/**
 * Prix course majorations incluses, avant remise :
 * max(minimumFare, baseFare + km × pricePerKm + min × pricePerMinute) puis majoration,
 * arrondi au multiple de 25 supérieur et re-planché au minimumFare.
 */
export const fareBeforeDiscount = (
  grid: FareGridRow,
  distanceKm: number,
  durationMin: number,
  surgePercent: number,
): number => {
  const minimumFare = toNumber(grid.minimumFare);
  const metered =
    toNumber(grid.baseFare) +
    distanceKm * toNumber(grid.pricePerKm) +
    durationMin * toNumber(grid.pricePerMinute);
  const surged = Math.max(minimumFare, metered) * (1 + surgePercent / 100);
  return Math.max(minimumFare, roundUpTo25(surged));
};

/** Ventilation commission plateforme / net chauffeur. */
export const splitFare = (
  grid: FareGridRow,
  fare: number,
): { platformCommission: number; driverPayout: number } => {
  const platformCommission = Math.round(
    (fare * toNumber(grid.driverCommissionPercent)) / 100,
  );
  return { platformCommission, driverPayout: fare - platformCommission };
};

/**
 * Prix final : majorations, remise, arrondi au multiple de 25 supérieur,
 * re-plancher au minimumFare, puis ventilation.
 */
export const computeFare = (
  grid: FareGridRow,
  distanceKm: number,
  durationMin: number,
  surgePercent: number,
  discountAmount = 0,
): FareBreakdown => {
  const before = fareBeforeDiscount(grid, distanceKm, durationMin, surgePercent);
  const discount = Math.min(Math.max(0, Math.round(discountAmount)), before);
  const minimumFare = toNumber(grid.minimumFare);
  const finalFare = Math.max(minimumFare, roundUpTo25(before - discount));
  const { platformCommission, driverPayout } = splitFare(grid, finalFare);
  return {
    fareBeforeDiscount: before,
    surgePercent,
    discountAmount: discount,
    finalFare,
    platformCommission,
    driverPayout,
  };
};

/** Formate un instant UTC en date littérale AAAA-MM-JJ (heure locale du Niger). */
export const nigerDateString = (isoUtc?: string): string => {
  const date = isoUtc ? new Date(isoUtc) : new Date();
  const base = Number.isNaN(date.getTime()) ? new Date() : date;
  const shifted = new Date(
    base.getTime() + NIGER_UTC_OFFSET_HOURS * 60 * 60 * 1000,
  );
  const year = shifted.getUTCFullYear();
  const month = `${shifted.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${shifted.getUTCDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export interface PromoEvaluation {
  promo: PromoCodeRow | null;
  promoValid: boolean;
  promoMessage: string;
  discountAmount: number;
}

const formatFcfa = (amount: number): string =>
  `${Math.round(amount).toLocaleString('fr-FR').replace(/\u202f|\u00a0/g, ' ')} FCFA`;

/**
 * Valide un code promotionnel et calcule la remise applicable.
 * Un code invalide n'échoue jamais l'action : il renvoie simplement promoValid = false.
 * `today` est une date littérale AAAA-MM-JJ, comparée en littéral (aucune conversion de fuseau).
 */
export const evaluatePromo = (
  promo: PromoCodeRow | null | undefined,
  fareBefore: number,
  cityId: number,
  today: string,
  cityName?: string,
): PromoEvaluation => {
  const invalid = (message: string): PromoEvaluation => ({
    promo: null,
    promoValid: false,
    promoMessage: message,
    discountAmount: 0,
  });

  if (!promo) return invalid('Code promotionnel inconnu');
  if (promo.isActive === false) return invalid("Code promotionnel désactivé");

  const validFrom = (promo.validFrom ?? '').slice(0, 10);
  const validUntil = (promo.validUntil ?? '').slice(0, 10);
  if (validFrom && today < validFrom) {
    return invalid("Code pas encore valable");
  }
  if (validUntil && today > validUntil) {
    return invalid('Code expiré');
  }

  const maxUses = toNumber(promo.maxUses);
  if (maxUses > 0 && toNumber(promo.usedCount) >= maxUses) {
    return invalid("Code épuisé");
  }

  const promoCityId = toNumber(promo.cityId);
  if (promoCityId > 0 && promoCityId !== cityId) {
    return invalid(
      cityName
        ? `Code non valable à ${cityName}`
        : 'Code réservé à une autre ville',
    );
  }

  const minimumFare = toNumber(promo.minimumFare);
  if (minimumFare > 0 && fareBefore < minimumFare) {
    return invalid(
      `Course trop courte pour ce code (minimum ${formatFcfa(minimumFare)})`,
    );
  }

  let discount = 0;
  if ((promo.discountType ?? '').toLowerCase().includes('pourcent')) {
    discount = Math.round((fareBefore * toNumber(promo.discountValue)) / 100);
    const cap = toNumber(promo.maxDiscountAmount);
    if (cap > 0) discount = Math.min(discount, cap);
  } else {
    discount = Math.round(toNumber(promo.discountValue));
  }
  discount = Math.min(Math.max(0, discount), fareBefore);

  if (discount <= 0) {
    return invalid("Ce code n'accorde aucune remise sur cette course");
  }

  return {
    promo,
    promoValid: true,
    promoMessage: `${formatFcfa(discount)} offerts`,
    discountAmount: discount,
  };
};

/** Détecte le type de remise en pourcentage indépendamment du libellé exact. */
export const isPercentDiscount = (discountType?: string): boolean =>
  (discountType ?? '').toLowerCase().includes('pourcent');
