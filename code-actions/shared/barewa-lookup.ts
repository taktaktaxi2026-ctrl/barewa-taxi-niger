/**
 * Lectures de référentiel partagées (ville, grille tarifaire, code promotionnel).
 */
import type { BlocksClient, Item } from './blocks/blocks-client.ts';

import { num, type FareGridRow, type PromoCodeRow } from './barewa-fare.ts';

export const getCity = async (
  client: BlocksClient,
  cityId: number,
): Promise<Item | null> => {
  const { items } = await client.queryTable('Cities', {
    from: { table: 'Cities' },
    where: { column: 'id', value: cityId },
    limit: 1,
  });
  return items[0] ?? null;
};

export const getActiveFareGrid = async (
  client: BlocksClient,
  cityId: number,
  vehicleTypeId?: number,
): Promise<FareGridRow[]> => {
  const conditions: Array<Record<string, unknown>> = [
    { column: 'cityId', value: cityId },
    { column: 'isActive', value: true },
  ];
  if (vehicleTypeId !== undefined && vehicleTypeId !== null) {
    conditions.push({ column: 'vehicleTypeId', value: vehicleTypeId });
  }
  const { items } = await client.queryTable('FareGrid', {
    from: { table: 'FareGrid' },
    where: { and: conditions as never },
  });
  return items.map((item) => ({ ...item, id: num(item.id) }) as FareGridRow);
};

/** Retrouve un code promotionnel, comparaison insensible à la casse et aux espaces. */
export const findPromoCode = async (
  client: BlocksClient,
  rawCode: string,
): Promise<PromoCodeRow | null> => {
  const normalized = rawCode.trim().toUpperCase();
  if (!normalized) return null;
  const { items } = await client.queryTable('PromoCodes', {
    from: { table: 'PromoCodes' },
  });
  const match = items.find(
    (item) => ((item.code as string) ?? '').trim().toUpperCase() === normalized,
  );
  return match ? ({ ...match, id: num(match.id) } as PromoCodeRow) : null;
};

export const getVehicleTypes = async (
  client: BlocksClient,
): Promise<Item[]> => {
  const { items } = await client.queryTable('VehicleTypes', {
    from: { table: 'VehicleTypes' },
  });
  return items;
};
