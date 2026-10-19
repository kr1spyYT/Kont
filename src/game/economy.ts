import type { InventoryItem, ItemType, LicensePlateRarity, SaleCategory } from '../types/game.js';

export const SALE_PRICE_MULTIPLIER = 0.65;
export const LEGIT_CHECK_PRICE = 2_500;
export const LEGIT_CHECK_SUCCESS_CHANCE = 0.65;
export const ORIGINAL_PRICE_MULTIPLIER = 1.25;
export const BAD_LEGIT_PRICE_MULTIPLIER = 0.4;
export const DETAILING_PRICE_MULTIPLIER = 1.1;
export const MILEAGE_SUCCESS_PRICE_MULTIPLIER = 1.2;
export const MILEAGE_FAILURE_PRICE_MULTIPLIER = 0.55;

export const getResaleValue = (
  item: Pick<InventoryItem, 'price'> | { price: number },
  multiplier = SALE_PRICE_MULTIPLIER,
): number => Math.floor(item.price * multiplier);

export const QUICK_SELL_BASE_PRICE_MULTIPLIER = 1;

const PREMIUM_RARITIES = new Set(['rare', 'epic', 'legendary', 'mythic']);

export const getDefaultSaleCategory = (type: ItemType, rarity: InventoryItem['rarity']): SaleCategory => {
  if (type === 'car' && PREMIUM_RARITIES.has(rarity)) return 'elite_cars';
  if (type === 'clothing' && PREMIUM_RARITIES.has(rarity)) return 'limited';
  return 'common';
};

export const getInventorySaleCategory = (item: Pick<InventoryItem, 'type' | 'rarity' | 'saleCategory'>): SaleCategory =>
  item.saleCategory ?? getDefaultSaleCategory(item.type, item.rarity);

export const getLicensePlateSaleCategory = (rarity: LicensePlateRarity): SaleCategory =>
  rarity === 'common' || rarity === 'uncommon' ? 'common' : 'rare_plates';

export const getQuickSellValue = (item: Pick<InventoryItem, 'basePrice'>): number =>
  Number.isSafeInteger(item.basePrice) && item.basePrice > 0
    ? Math.floor(item.basePrice * QUICK_SELL_BASE_PRICE_MULTIPLIER)
    : 0;

export const getQuickSellEligibleItems = (
  items: InventoryItem[],
  protectedIds: ReadonlySet<string> = new Set<string>(),
): InventoryItem[] => items.filter((item) =>
  getInventorySaleCategory(item) === 'common'
  && !protectedIds.has(item.id)
  && !(item.type === 'car' && Boolean(item.licensePlateId || item.licensePlate)),
);
