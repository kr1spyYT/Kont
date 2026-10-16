import { CarItem, ClothingItem, ClothingSlot, PlayerState } from '../types/game';

export const STARTING_PLAYER: PlayerState = {
  balance: 25_000,
  respect: 0,
  xp: 0,
  inventory: [],
  licensePlates: [],
  equippedClothing: {},
  auctionListings: [],
  closedMarketListingIds: [],
  avatarEmoji: '🕶️',
  economyVersion: 4,
};

export const calculateEquippedStats = (player: PlayerState) => {
  const equippedClothing = Object.values(player.equippedClothing)
    .map((itemId) => player.inventory.find((item) => item.id === itemId && item.type === 'clothing'))
    .filter((item): item is ClothingItem => item !== undefined);
  const activeCar = player.inventory.find(
    (item): item is CarItem => item.id === player.activeCarId && item.type === 'car',
  );
  const hasFullSet = (['head', 'torso', 'legs', 'shoes', 'accessory'] as ClothingSlot[]).every(
    (slot) => equippedClothing.some((item) => item.slot === slot),
  );
  const respect = equippedClothing.reduce((total, item) => total + item.respect, 0) + (activeCar?.respect ?? 0);
  const setMultiplier = hasFullSet ? 1.2 : 1;

  return {
    activeCar,
    equippedClothing,
    hasFullSet,
    respect: Math.round(respect * setMultiplier),
  };
};

export const withEquippedStats = (player: PlayerState): PlayerState => {
  const stats = calculateEquippedStats(player);
  return {
    ...player,
    respect: stats.respect,
    economyVersion: 4,
  };
};
