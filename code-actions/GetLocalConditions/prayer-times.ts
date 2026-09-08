/**
 * Horaires de prière calculés localement par la méthode astronomique standard
 * (équation du temps, déclinaison solaire, angle horaire).
 * Convention Muslim World League — la référence en Afrique de l'Ouest :
 * Fajr et Isha à 18°, Asr à l'ombre simple (facteur 1).
 * Aucune API tierce : le calcul est déterministe et fonctionne hors réseau.
 * Fuseau du Niger : UTC+1 fixe, sans heure d'été.
 */

const NIGER_TZ_HOURS = 1;
const FAJR_ANGLE = 18;
const ISHA_ANGLE = 18;
/** Réfraction + rayon solaire au lever/coucher. */
const SUNRISE_ANGLE = 0.833;
/** Ombre simple. */
const ASR_SHADOW_FACTOR = 1;

const DEG = Math.PI / 180;
const sinD = (deg: number): number => Math.sin(deg * DEG);
const cosD = (deg: number): number => Math.cos(deg * DEG);
const tanD = (deg: number): number => Math.tan(deg * DEG);
const asinD = (value: number): number => Math.asin(value) / DEG;
const acosD = (value: number): number => Math.acos(value) / DEG;
const atan2D = (y: number, x: number): number => Math.atan2(y, x) / DEG;
const acotD = (value: number): number => Math.atan2(1, value) / DEG;

const fixRange = (value: number, range: number): number => {
  const shifted = value - range * Math.floor(value / range);
  return shifted < 0 ? shifted + range : shifted;
};
const fixAngle = (value: number): number => fixRange(value, 360);
const fixHour = (value: number): number => fixRange(value, 24);

/** Jour julien à 0 h UT pour une date civile. */
const julianDate = (year: number, month: number, day: number): number => {
  let y = year;
  let m = month;
  if (m <= 2) {
    y -= 1;
    m += 12;
  }
  const a = Math.floor(y / 100);
  const b = 2 - a + Math.floor(a / 4);
  return (
    Math.floor(365.25 * (y + 4716)) +
    Math.floor(30.6001 * (m + 1)) +
    day +
    b -
    1524.5
  );
};

interface SunPosition {
  declination: number;
  equationOfTime: number;
}

/** Déclinaison solaire (degrés) et équation du temps (heures). */
const sunPosition = (jd: number): SunPosition => {
  const d = jd - 2451545.0;
  const meanAnomaly = fixAngle(357.529 + 0.98560028 * d);
  const meanLongitude = fixAngle(280.459 + 0.98564736 * d);
  const eclipticLongitude = fixAngle(
    meanLongitude + 1.915 * sinD(meanAnomaly) + 0.02 * sinD(2 * meanAnomaly),
  );
  const obliquity = 23.439 - 0.00000036 * d;
  const rightAscension =
    fixHour(
      atan2D(cosD(obliquity) * sinD(eclipticLongitude), cosD(eclipticLongitude)) /
        15,
    );
  return {
    declination: asinD(sinD(obliquity) * sinD(eclipticLongitude)),
    equationOfTime: meanLongitude / 15 - rightAscension,
  };
};

export interface PrayerTimes {
  fajr: string;
  sunrise: string;
  dhuhr: string;
  asr: string;
  maghrib: string;
  isha: string;
  nextPrayerName: string;
  nextPrayerTime: string;
  minutesToNextPrayer: number;
}

const formatHours = (hours: number): string => {
  const total = Math.round(fixHour(hours) * 60);
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${`${h}`.padStart(2, '0')}:${`${m}`.padStart(2, '0')}`;
};

const minutesOf = (hhmm: string): number => {
  const [h, m] = hhmm.split(':');
  return Number(h) * 60 + Number(m);
};

/**
 * Horaires bruts en heures locales (fuseau appliqué), pour une date civile
 * AAAA-MM-JJ et des coordonnées données.
 */
const computeRawTimes = (
  dayString: string,
  latitude: number,
  longitude: number,
): Record<string, number> => {
  const [year, month, day] = dayString.split('-').map((part) => Number(part));
  const jDate = julianDate(year, month, day) - longitude / (15 * 24);

  const midDay = (dayFraction: number): number => {
    const { equationOfTime } = sunPosition(jDate + dayFraction);
    return fixHour(12 - equationOfTime);
  };

  /** Écart horaire, en heures, entre midi solaire et l'instant où le soleil est à `angle`. */
  const sunAngleTime = (angle: number, dayFraction: number): number => {
    const { declination } = sunPosition(jDate + dayFraction);
    const numerator =
      -sinD(angle) - sinD(declination) * sinD(latitude);
    const denominator = cosD(declination) * cosD(latitude);
    const ratio = numerator / denominator;
    if (!Number.isFinite(ratio) || ratio < -1 || ratio > 1) {
      // Nuit ou jour polaire : impossible aux latitudes du Niger, mais on reste défensif.
      return Number.NaN;
    }
    return acosD(ratio) / 15;
  };

  const asrAngle = (dayFraction: number): number => {
    const { declination } = sunPosition(jDate + dayFraction);
    return -acotD(ASR_SHADOW_FACTOR + tanD(Math.abs(latitude - declination)));
  };

  // Deux itérations suffisent largement à la convergence.
  let dhuhr = midDay(12 / 24);
  let fajr = dhuhr - sunAngleTime(FAJR_ANGLE, 5 / 24);
  let sunrise = dhuhr - sunAngleTime(SUNRISE_ANGLE, 6 / 24);
  let asr = dhuhr + sunAngleTime(asrAngle(13 / 24), 13 / 24);
  let maghrib = dhuhr + sunAngleTime(SUNRISE_ANGLE, 18 / 24);
  let isha = dhuhr + sunAngleTime(ISHA_ANGLE, 18 / 24);

  for (let pass = 0; pass < 2; pass += 1) {
    dhuhr = midDay(dhuhr / 24);
    fajr = dhuhr - sunAngleTime(FAJR_ANGLE, fajr / 24);
    sunrise = dhuhr - sunAngleTime(SUNRISE_ANGLE, sunrise / 24);
    asr = dhuhr + sunAngleTime(asrAngle(asr / 24), asr / 24);
    maghrib = dhuhr + sunAngleTime(SUNRISE_ANGLE, maghrib / 24);
    isha = dhuhr + sunAngleTime(ISHA_ANGLE, isha / 24);
  }

  const tzAdjust = NIGER_TZ_HOURS - longitude / 15;
  return {
    fajr: fajr + tzAdjust,
    sunrise: sunrise + tzAdjust,
    // Petite marge conventionnelle après le zénith.
    dhuhr: dhuhr + tzAdjust + 1 / 60,
    asr: asr + tzAdjust,
    maghrib: maghrib + tzAdjust,
    isha: isha + tzAdjust,
  };
};

const PRAYER_ORDER = [
  { key: 'fajr', label: 'Fajr' },
  { key: 'dhuhr', label: 'Dhuhr' },
  { key: 'asr', label: 'Asr' },
  { key: 'maghrib', label: 'Maghrib' },
  { key: 'isha', label: 'Isha' },
] as const;

/** Jour civil suivant une date littérale AAAA-MM-JJ (sans passer par les fuseaux). */
const nextDayString = (dayString: string): string => {
  const [year, month, day] = dayString.split('-').map((part) => Number(part));
  const shifted = new Date(Date.UTC(year, month - 1, day + 1));
  return `${shifted.getUTCFullYear()}-${`${shifted.getUTCMonth() + 1}`.padStart(
    2,
    '0',
  )}-${`${shifted.getUTCDate()}`.padStart(2, '0')}`;
};

/**
 * Horaires du jour demandé plus la prochaine prière relative à `nowHHMM`
 * (heure du Niger). Après l'Isha, la prochaine prière est le Fajr du lendemain.
 */
export const computePrayerTimes = (
  dayString: string,
  latitude: number,
  longitude: number,
  nowHHMM: string,
): PrayerTimes => {
  const raw = computeRawTimes(dayString, latitude, longitude);
  const formatted: Record<string, string> = {};
  Object.keys(raw).forEach((key) => {
    const value = raw[key];
    formatted[key] = Number.isFinite(value) ? formatHours(value) : '--:--';
  });

  const nowMinutes = minutesOf(nowHHMM);
  let nextPrayerName = '';
  let nextPrayerTime = '';
  let minutesToNextPrayer = 0;

  const upcoming = PRAYER_ORDER.find((prayer) => {
    const time = formatted[prayer.key];
    return time !== '--:--' && minutesOf(time) > nowMinutes;
  });

  if (upcoming) {
    nextPrayerName = upcoming.label;
    nextPrayerTime = formatted[upcoming.key];
    minutesToNextPrayer = minutesOf(nextPrayerTime) - nowMinutes;
  } else {
    // Après l'Isha : Fajr du lendemain.
    const tomorrow = computeRawTimes(
      nextDayString(dayString),
      latitude,
      longitude,
    );
    const fajrTomorrow = Number.isFinite(tomorrow.fajr)
      ? formatHours(tomorrow.fajr)
      : formatted.fajr;
    nextPrayerName = 'Fajr';
    nextPrayerTime = fajrTomorrow;
    minutesToNextPrayer =
      fajrTomorrow === '--:--'
        ? 0
        : 24 * 60 - nowMinutes + minutesOf(fajrTomorrow);
  }

  return {
    fajr: formatted.fajr,
    sunrise: formatted.sunrise,
    dhuhr: formatted.dhuhr,
    asr: formatted.asr,
    maghrib: formatted.maghrib,
    isha: formatted.isha,
    nextPrayerName,
    nextPrayerTime,
    minutesToNextPrayer,
  };
};
