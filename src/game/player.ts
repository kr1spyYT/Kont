import { CarItem, ClothingItem, ClothingSlot, PlayerState } from '../types/game.js';
import { getEquippedLicensePlateFrameIds, getLicensePlateSynergyPercent } from './licensePlates.js';

const getCarPlate = (player: PlayerState, car: CarItem): string | undefined => {
  const plate = (car.licensePlateId
    ? player.licensePlates.find((entry) => entry.id === car.licensePlateId)?.plate
    : undefined) ?? car.licensePlate;
  return plate && plate !== '—' && plate !== 'Без номера' ? plate : undefined;
};

export const STARTING_PLAYER: PlayerState = {
  balance: 25_000,
  respect: 0,
  xp: 0,
  inventory: [],
  licensePlates: [],
  favoriteLicensePlateIds: [],
  licensePlateFrames: [],
  seasonCaseTokens: {},
  containerKeys: 0,
  dailyMissions: { day: '', progress: {}, claimed: [] },
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
  const frameIds = getEquippedLicensePlateFrameIds(player);
  const activeCarPlate = activeCar ? getCarPlate(player, activeCar) : undefined;
  const carPlateBonusPercent = getLicensePlateSynergyPercent(
    activeCarPlate,
    frameIds.includes('season-01-vip'),
  );
  const hasFullSet = (['head', 'torso', 'legs', 'shoes', 'accessory'] as ClothingSlot[]).every(
    (slot) => equippedClothing.some((item) => item.slot === slot),
  );
  const clothingRespect = equippedClothing.reduce((total, item) => total + item.respect, 0);
  const carRespect = activeCar?.respect ?? 0;
  const respect = clothingRespect + carRespect * (1 + carPlateBonusPercent / 100);
  const setMultiplier = hasFullSet ? 1.2 : 1;

  return {
    activeCar,
    equippedClothing,
    hasFullSet,
    clothingRespect,
    carRespect,
    carPlateBonusPercent,
    carRespectBonus: carRespect * carPlateBonusPercent / 100,
    respect: Math.round(respect * setMultiplier),
  };
};

export const calculateStatusCapital = (player: PlayerState): number => {
  const vipFrame = getEquippedLicensePlateFrameIds(player).includes('season-01-vip');
  const inventoryValue = player.inventory.reduce((total, item) => {
    if (item.type !== 'car') return total + item.price;
    const plate = getCarPlate(player, item);
    const bonusPercent = getLicensePlateSynergyPercent(plate, vipFrame);
    return total + item.price * (1 + bonusPercent / 100);
  }, 0);

  return Math.round(player.balance + inventoryValue + player.licensePlates.reduce((total, plate) => total + plate.price, 0));
};

export const withEquippedStats = (player: PlayerState): PlayerState => {
  const stats = calculateEquippedStats(player);
  return {
    ...player,
    respect: stats.respect,
    economyVersion: 4,
  };
};
