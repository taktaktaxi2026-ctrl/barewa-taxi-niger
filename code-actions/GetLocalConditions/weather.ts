/**
 * Météo via Open-Meteo (service public gratuit, sans clé).
 * Toute panne du service est absorbée : la fonction renvoie null, jamais d'exception.
 */

const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';
const REQUEST_TIMEOUT_MS = 8000;

/** Au-delà, l'harmattan lève la poussière et la visibilité chute. */
const DUST_GUST_THRESHOLD_KMH = 40;
/** Au-delà, un véhicule climatisé devient nécessaire. */
const HEAT_FEELS_LIKE_THRESHOLD_C = 40;

export interface WeatherReport {
  temperatureC: number;
  feelsLikeC: number;
  maxTemperatureC: number;
  minTemperatureC: number;
  humidityPercent: number;
  windSpeedKmh: number;
  windGustKmh: number;
  windDirection: string;
  uvIndex: number;
  precipitationMm: number;
  condition: string;
  dustAdvisory: string;
  rideAdvisory: string;
}

const CARDINALS = [
  'N',
  'NNE',
  'NE',
  'ENE',
  'E',
  'ESE',
  'SE',
  'SSE',
  'S',
  'SSO',
  'SO',
  'OSO',
  'O',
  'ONO',
  'NO',
  'NNO',
] as const;

/** Direction du vent en points cardinaux français (O pour Ouest). */
export const cardinalDirection = (degrees: number): string => {
  if (!Number.isFinite(degrees)) return '';
  const index = Math.round((((degrees % 360) + 360) % 360) / 22.5) % 16;
  return CARDINALS[index];
};

/** Traduction des codes météo WMO en condition française. */
export const wmoCondition = (code: number): string => {
  const table: Record<number, string> = {
    0: 'Ciel dégagé',
    1: 'Globalement dégagé',
    2: 'Partiellement nuageux',
    3: 'Couvert',
    45: 'Brouillard',
    48: 'Brouillard givrant',
    51: 'Bruine faible',
    53: 'Bruine modérée',
    55: 'Bruine dense',
    56: 'Bruine verglaçante faible',
    57: 'Bruine verglaçante dense',
    61: 'Pluie faible',
    63: 'Pluie modérée',
    65: 'Pluie forte',
    66: 'Pluie verglaçante faible',
    67: 'Pluie verglaçante forte',
    71: 'Neige faible',
    73: 'Neige modérée',
    75: 'Neige forte',
    77: 'Grains de neige',
    80: 'Averses faibles',
    81: 'Averses modérées',
    82: 'Averses violentes',
    85: 'Averses de neige faibles',
    86: 'Averses de neige fortes',
    95: 'Orage',
    96: 'Orage avec grêle',
    99: 'Orage violent avec grêle',
  };
  return table[code] ?? 'Conditions indéterminées';
};

const numberOf = (value: unknown): number => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 10) / 10 : 0;
};

const isRainy = (code: number, precipitationMm: number): boolean =>
  precipitationMm > 0 ||
  (code >= 51 && code <= 67) ||
  (code >= 80 && code <= 82) ||
  code >= 95;

/** Conseils de mobilité déduits des mesures, en français. */
export const buildAdvisories = (
  report: Omit<WeatherReport, 'dustAdvisory' | 'rideAdvisory'>,
  weatherCode: number,
): { dustAdvisory: string; rideAdvisory: string; condition: string } => {
  const dusty = report.windGustKmh > DUST_GUST_THRESHOLD_KMH;
  const hot = report.feelsLikeC > HEAT_FEELS_LIKE_THRESHOLD_C;
  const rainy = isRainy(weatherCode, report.precipitationMm);

  const condition = dusty && weatherCode <= 3
    ? 'Poussière en suspension'
    : report.condition;

  const dustAdvisory = dusty
    ? `Rafales à ${report.windGustKmh} km/h : l'harmattan lève la poussière, gardez les vitres fermées et un foulard à portée de main.`
    : '';

  const advisories: string[] = [];
  if (dusty) {
    advisories.push(
      'Visibilité réduite par la poussière : roulez feux allumés et prévoyez du retard.',
    );
  }
  if (hot) {
    advisories.push(
      `Chaleur ressentie de ${report.feelsLikeC} °C : privilégiez un véhicule climatisé et emportez de l'eau.`,
    );
  }
  if (rainy) {
    advisories.push(
      'Pluie annoncée : la circulation ralentit et certaines rues non bitumées deviennent difficiles.',
    );
  }
  if (advisories.length === 0) {
    advisories.push('Conditions normales de circulation.');
  }

  return { dustAdvisory, rideAdvisory: advisories.join(' '), condition };
};

/** Interroge Open-Meteo ; renvoie null si le service est indisponible. */
export const fetchWeather = async (
  latitude: number,
  longitude: number,
  dayString: string,
): Promise<WeatherReport | null> => {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current:
      'temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_gusts_10m,wind_direction_10m,uv_index,weather_code',
    daily:
      'temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code,uv_index_max',
    timezone: 'Africa/Niamey',
    wind_speed_unit: 'kmh',
    temperature_unit: 'celsius',
    precipitation_unit: 'mm',
    start_date: dayString,
    end_date: dayString,
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${OPEN_METEO_URL}?${params.toString()}`, {
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as {
      current?: Record<string, unknown>;
      daily?: Record<string, unknown[]>;
    };
    const current = payload.current ?? {};
    const daily = payload.daily ?? {};
    const firstDaily = (key: string): unknown => {
      const series = daily[key];
      return Array.isArray(series) ? series[0] : undefined;
    };

    const weatherCode = Math.round(
      numberOf(current.weather_code ?? firstDaily('weather_code')),
    );
    const base = {
      temperatureC: numberOf(current.temperature_2m),
      feelsLikeC: numberOf(current.apparent_temperature),
      maxTemperatureC: numberOf(firstDaily('temperature_2m_max')),
      minTemperatureC: numberOf(firstDaily('temperature_2m_min')),
      humidityPercent: numberOf(current.relative_humidity_2m),
      windSpeedKmh: numberOf(current.wind_speed_10m),
      windGustKmh: numberOf(current.wind_gusts_10m),
      windDirection: cardinalDirection(numberOf(current.wind_direction_10m)),
      uvIndex: numberOf(current.uv_index ?? firstDaily('uv_index_max')),
      precipitationMm: numberOf(firstDaily('precipitation_sum')),
      condition: wmoCondition(weatherCode),
    };
    const { dustAdvisory, rideAdvisory, condition } = buildAdvisories(
      base,
      weatherCode,
    );
    return { ...base, condition, dustAdvisory, rideAdvisory };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
};
