import { num } from '../shared/barewa-fare.ts';
import { nigerDayString, nigerTimeString } from '../shared/barewa-time.ts';

import { computePrayerTimes } from './prayer-times.ts';
import { fetchWeather } from './weather.ts';

interface ConditionsInput {
  latitude: number;
  longitude: number;
  cityName?: string;
  date?: string;
}

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const refuse = (message: string): Record<string, unknown> => ({
  success: false,
  message,
});

export const invoke = async (
  input: ConditionsInput,
  _context: Record<string, unknown>,
): Promise<Record<string, unknown>> => {
  const latitude = num(input.latitude, Number.NaN);
  const longitude = num(input.longitude, Number.NaN);

  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    return refuse('Latitude invalide.');
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return refuse('Longitude invalide.');
  }

  const requestedDate = (input.date ?? '').trim();
  if (requestedDate && !DAY_PATTERN.test(requestedDate)) {
    return refuse('Date invalide : le format attendu est AAAA-MM-JJ.');
  }

  const nowIso = new Date().toISOString();
  const today = nigerDayString(nowIso);
  const dayString = requestedDate || today;
  const localTime = nigerTimeString(nowIso);

  // Pour un autre jour que celui-ci, la « prochaine prière » se calcule depuis minuit.
  const referenceTime = dayString === today ? localTime : '00:00';
  const prayerTimes = computePrayerTimes(
    dayString,
    latitude,
    longitude,
    referenceTime,
  );

  const weather = await fetchWeather(latitude, longitude, dayString);

  const base: Record<string, unknown> = {
    success: true,
    cityName: (input.cityName ?? '').trim(),
    date: dayString,
    localTime,
    prayerTimes,
  };

  if (!weather) {
    return {
      ...base,
      message:
        "La météo est momentanément indisponible ; les horaires de prière restent affichés.",
    };
  }

  return {
    ...base,
    weather,
    message: `${weather.condition}, ${weather.temperatureC} °C (ressenti ${weather.feelsLikeC} °C).`,
  };
};
