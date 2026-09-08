import { BlocksClient, type Item } from '../shared/blocks/blocks-client.ts';
import { num } from '../shared/barewa-fare.ts';
import {
  isSimulationRide,
  OPEN_RIDE_STATUSES,
} from '../shared/barewa-rides.ts';
import { isoDaysAgo, nigerDayString } from '../shared/barewa-time.ts';

import {
  ALL_AGENTS,
  noDataInsight,
  runAgent,
  type AgentName,
  type CityDataset,
  type InsightDraft,
} from './agents.ts';

interface RunInput {
  cityId?: number;
  lookbackDays?: number;
  agents?: string[];
}

const DEFAULT_LOOKBACK_DAYS = 30;

const refuse = (message: string): Record<string, unknown> => ({
  success: false,
  message,
  insights: [],
});

const asIso = (value: unknown): string =>
  typeof value === 'string' ? value : '';

export const invoke = async (
  input: RunInput,
  context: Record<string, unknown>,
): Promise<Record<string, unknown>> => {
  const client = new BlocksClient(context as never);

  const lookbackDays =
    input.lookbackDays === undefined || input.lookbackDays === null
      ? DEFAULT_LOOKBACK_DAYS
      : Math.round(num(input.lookbackDays));
  if (!Number.isFinite(lookbackDays) || lookbackDays < 1 || lookbackDays > 365) {
    return refuse(
      "La profondeur d'historique doit être comprise entre 1 et 365 jours.",
    );
  }

  const requestedAgents = Array.isArray(input.agents) ? input.agents : [];
  const unknownAgent = requestedAgents.find(
    (agent) => !(ALL_AGENTS as string[]).includes(agent),
  );
  if (unknownAgent) {
    return refuse(
      `Agent inconnu : « ${unknownAgent} ». Agents disponibles : ${ALL_AGENTS.join(', ')}.`,
    );
  }
  const agents: AgentName[] =
    requestedAgents.length > 0
      ? (requestedAgents as AgentName[])
      : [...ALL_AGENTS];

  // Villes analysées.
  const requestedCityId = num(input.cityId);
  const { items: allCities } = await client.queryTable('Cities', {
    from: { table: 'Cities' },
    orderBy: [{ column: 'name', direction: 'asc' }],
  });
  let cities: Item[];
  if (requestedCityId > 0) {
    const city = allCities.find((item) => num(item.id) === requestedCityId);
    if (!city) return refuse('Ville introuvable.');
    cities = [city];
  } else {
    cities = allCities.filter((city) => city.isActive !== false);
    if (cities.length === 0) {
      return refuse('Aucune ville active à analyser.');
    }
  }

  const ranAt = new Date().toISOString();
  const today = nigerDayString(ranAt);
  const sinceIso = isoDaysAgo(lookbackDays);
  const since7dIso = isoDaysAgo(7);

  // Référentiel des moyens de paiement en espèces.
  const { items: providers } = await client.queryTable('PaymentProviders', {
    from: { table: 'PaymentProviders' },
  });
  const cashProviderIds = new Set<number>(
    providers
      .filter((provider) => provider.kind === 'Espèces')
      .map((provider) => num(provider.id)),
  );

  const drafts: InsightDraft[] = [];

  for (const city of cities) {
    const cityId = num(city.id);
    const cityName = (city.name as string) ?? `Ville #${cityId}`;

    const { items: rawRides } = await client.queryTable('Rides', {
      from: { table: 'Rides' },
      where: { column: 'cityId', value: cityId },
    });
    // Les simulations ne comptent jamais.
    const realRides = rawRides.filter((ride) => !isSimulationRide(ride));

    const rides = realRides.filter(
      (ride) => asIso(ride.requestedAt ?? ride.createdAt) >= sinceIso,
    );
    const rides7d = realRides.filter(
      (ride) => asIso(ride.requestedAt ?? ride.createdAt) >= since7dIso,
    );
    const openRides = realRides.filter((ride) =>
      (OPEN_RIDE_STATUSES as readonly string[]).includes(
        (ride.status as string) ?? '',
      ),
    );

    const { items: drivers } = await client.queryTable('DriverProfile', {
      from: { table: 'DriverProfile' },
      where: { column: 'cityId', value: cityId },
    });
    const onlineDrivers = drivers.filter(
      (driver) =>
        driver.isOnline === true && driver.verificationStatus === 'Vérifié',
    );

    const { items: passengers } = await client.queryTable('PassengerProfile', {
      from: { table: 'PassengerProfile' },
      where: { column: 'cityId', value: cityId },
    });

    // Paiements rattachés aux courses réelles de la ville.
    const realRideIds = new Set<number>(realRides.map((ride) => num(ride.id)));
    let payments: Item[] = [];
    if (realRideIds.size > 0) {
      const { items: allPayments } = await client.queryTable('Payments', {
        from: { table: 'Payments' },
        where: {
          column: 'rideId',
          operator: 'in',
          value: [...realRideIds],
        },
      });
      payments = allPayments;
    }

    const dataset: CityDataset = {
      cityId,
      cityName,
      cityLatitude: num(city.latitude, Number.NaN),
      cityLongitude: num(city.longitude, Number.NaN),
      lookbackDays,
      rides,
      rides7d,
      drivers,
      onlineDrivers,
      passengers,
      payments,
      openRides,
      today,
      cashProviderIds,
    };

    const hasData =
      rides.length > 0 ||
      drivers.length > 0 ||
      passengers.length > 0 ||
      payments.length > 0;

    agents.forEach((agentName) => {
      drafts.push(
        hasData ? runAgent(agentName, dataset) : noDataInsight(agentName, dataset),
      );
    });
  }

  const insights: Array<Record<string, unknown>> = [];
  for (const draft of drafts) {
    const { item } = await client.createItem('AgentInsights', {
      title: draft.title,
      agentName: draft.agentName,
      severity: draft.severity,
      body: draft.body,
      recommendation: draft.recommendation,
      cityId: draft.cityId > 0 ? draft.cityId : null,
      metrics: draft.metrics,
      status: 'Nouveau',
      generatedAt: ranAt,
    });
    insights.push({
      insightId: num(item.id),
      agentName: draft.agentName,
      severity: draft.severity,
      title: draft.title,
      body: draft.body,
      recommendation: draft.recommendation,
      cityId: draft.cityId,
      cityName: draft.cityName,
      metrics: draft.metrics,
    });
  }

  const criticalCount = insights.filter(
    (insight) => insight.severity === 'Critique',
  ).length;

  return {
    success: true,
    message: `${insights.length} constat(s) produit(s) par ${agents.length} agent(s) sur ${cities.length} ville(s), ${lookbackDays} jour(s) d'historique${
      criticalCount > 0 ? ` — dont ${criticalCount} critique(s)` : ''
    }.`,
    ranAt,
    createdCount: insights.length,
    insights,
  };
};
