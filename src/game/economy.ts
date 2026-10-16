import type { InventoryItem } from '../types/game';

export const SALE_PRICE_MULTIPLIER = 0.65;
export const LEGIT_CHECK_PRICE = 2_500;
export const LEGIT_CHECK_SUCCESS_CHANCE = 0.65;
export const ORIGINAL_PRICE_MULTIPLIER = 1.25;
export const BAD_LEGIT_PRICE_MULTIPLIER = 0.4;
export const DETAILING_PRICE_MULTIPLIER = 1.1;
export const MILEAGE_SUCCESS_PRICE_MULTIPLIER = 1.2;
export const MILEAGE_FAILURE_PRICE_MULTIPLIER = 0.55;

export const getResaleValue = (item: Pick<InventoryItem, 'price'> | { price: number }): number =>
  Math.floor(item.price * SALE_PRICE_MULTIPLIER);
