/**
 * Règles communes sur les courses : statuts clos et exclusion des simulations.
 * Les courses de simulation ne comptent jamais dans les statistiques ni dans les exports.
 */
import type { Item } from './blocks/blocks-client.ts';

/** Une course dans l'un de ces statuts ne peut plus être négociée ni modifiée. */
export const CLOSED_RIDE_STATUSES = [
  'Terminée',
  'Annulée',
  'Simulation terminée',
] as const;

/** Statuts d'une course encore en cours de vie. */
export const OPEN_RIDE_STATUSES = [
  'Recherche',
  'Acceptée',
  'Chauffeur en route',
  'Chauffeur arrivé',
  'En course',
] as const;

export const isClosedRide = (ride: Item): boolean =>
  (CLOSED_RIDE_STATUSES as readonly string[]).includes(
    (ride.status as string) ?? '',
  );

/** Vrai si la course est une simulation (à exclure des mesures et des exports). */
export const isSimulationRide = (ride: Item): boolean =>
  ride.isSimulation === true || ride.status === 'Simulation terminée';

/** Ne conserve que les vraies courses. */
export const withoutSimulations = (rides: Item[]): Item[] =>
  rides.filter((ride) => !isSimulationRide(ride));
