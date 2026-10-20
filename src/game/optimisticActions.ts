import type { Container, PlayerState } from '../types/game';
import type { GameAction } from '../types/server';
import { getQuickSellEligibleItems, getQuickSellValue } from './economy';

const isEquipped = (player: PlayerState, itemId: string): boolean =>
  player.activeCarId === itemId || Object.values(player.equippedClothing).includes(itemId);

/** Apply only predictable, reversible UI projections. Server responses remain authoritative. */
export function applyOptimisticAction(
  player: PlayerState,
  action: GameAction,
  containers: readonly Container[],
): PlayerState | undefined {
  if (action.type === 'quick-sell-item') {
    const item = player.inventory.find((entry) => entry.id === action.itemId);
    if (!item || isEquipped(player, item.id)) return undefined;
    if (item.type === 'car' && (item.licensePlateId || item.licensePlate)) return undefined;
    const proceeds = getQuickSellValue(item);
    if (proceeds <= 0) return undefined;
    return {
      ...player,
      balance: player.balance + proceeds,
      inventory: player.inventory.filter((entry) => entry.id !== item.id),
    };
  }

  if (action.type === 'quick-sell-junk') {
    const protectedIds = new Set(player.inventory.filter((item) => isEquipped(player, item.id)).map((item) => item.id));
    const eligible = getQuickSellEligibleItems(player.inventory, protectedIds);
    if (!eligible.length) return undefined;
    const soldIds = new Set(eligible.map((item) => item.id));
    const proceeds = eligible.reduce((total, item) => total + getQuickSellValue(item), 0);
    if (proceeds <= 0) return undefined;
    return {
      ...player,
      balance: player.balance + proceeds,
      inventory: player.inventory.filter((item) => !soldIds.has(item.id)),
    };
  }

  if (action.type === 'open-container') {
    if (action.useKey) {
      if (player.containerKeys < 1) return undefined;
      return { ...player, containerKeys: player.containerKeys - 1 };
    }
    if (action.free) return undefined;
    const container = containers.find((entry) => entry.id === action.containerId);
    if (!container || !Number.isSafeInteger(container.price) || container.price < 0 || player.balance < container.price) return undefined;
    return { ...player, balance: player.balance - container.price };
  }

  if (action.type === 'open-season-case') {
    const tokens = player.seasonCaseTokens[action.containerId] ?? 0;
    if (tokens < 1) return undefined;
    const seasonCaseTokens = { ...player.seasonCaseTokens };
    if (tokens === 1) delete seasonCaseTokens[action.containerId];
    else seasonCaseTokens[action.containerId] = tokens - 1;
    return { ...player, seasonCaseTokens };
  }

  return undefined;
}

/** Group actions that compete for the same balance/inventory snapshot. */
export function getOptimisticResourceKey(action: GameAction): string | undefined {
  switch (action.type) {
    case 'quick-sell-item':
    case 'quick-sell-junk':
    case 'open-container':
    case 'open-season-case':
      return 'inventory-and-balance';
    default:
      return undefined;
  }
}
