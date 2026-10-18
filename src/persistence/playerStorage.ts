import { getClothingSlot, getItemImage } from '../data/items.js';
import { STARTING_PLAYER, withEquippedStats } from '../game/player.js';
import { createLicensePlateItem, getLicensePlateValuation, isValidRussianLicensePlate } from '../game/licensePlates.js';
import { normalizeDailyMissionState } from '../game/dailyMissions.js';
import type { AuctionItem, AuctionListing, ClothingSlot, InventoryItem, LicensePlateItem, PlayerState, Rarity } from '../types/game.js';

const STORAGE_KEY = 'kont_player_v1';
const SOUND_STORAGE_KEY = 'kont_sound_enabled_v1';
const MUSIC_STORAGE_KEY = 'lootland_music_enabled_v1';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isInventoryImageSource = (value: unknown): value is string =>
  typeof value === 'string' && (
    /^data:image\//i.test(value)
    || /^https?:\/\//i.test(value)
    || value.startsWith('/')
    || /\.(?:avif|gif|jpe?g|png|svg|webp)(?:[?#].*)?$/i.test(value)
  );

export const loadSoundPreference = (): boolean => {
  try {
    return localStorage.getItem(SOUND_STORAGE_KEY) !== 'false';
  } catch (error) {
    console.error('Не удалось прочитать настройку звука.', error);
    return true;
  }
};

export const saveSoundPreference = (enabled: boolean): void => {
  localStorage.setItem(SOUND_STORAGE_KEY, String(enabled));
};

export const loadMusicPreference = (): boolean => {
  try {
    return localStorage.getItem(MUSIC_STORAGE_KEY) === 'true';
  } catch (error) {
    console.error('Не удалось прочитать настройку фоновой музыки.', error);
    return false;
  }
};

export const saveMusicPreference = (enabled: boolean): void => {
  localStorage.setItem(MUSIC_STORAGE_KEY, String(enabled));
};

const isClothingSlot = (value: unknown): value is ClothingSlot =>
  value === 'head' || value === 'torso' || value === 'legs' || value === 'shoes' || value === 'accessory';

const migrateInventory = (value: unknown): InventoryItem[] => {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry): InventoryItem[] => {
    if (!isRecord(entry) || typeof entry.id !== 'string' || typeof entry.name !== 'string') return [];
    if (entry.type !== 'clothing' && entry.type !== 'car') return [];
    const type = entry.type;
    const price = typeof entry.price === 'number' ? entry.price : 0;
    const rarity: Rarity =
      entry.rarity === 'uncommon' || entry.rarity === 'rare' || entry.rarity === 'epic'
        || entry.rarity === 'legendary' || entry.rarity === 'mythic'
        ? entry.rarity
        : 'common';
    const base = {
      id: entry.id,
      name: entry.name,
      type,
      rarity,
      icon: typeof entry.icon === 'string' ? entry.icon : type === 'car' ? '🚘' : '🧥',
      image: [entry.image, entry.imageUrl, getItemImage(entry.name)].find(isInventoryImageSource),
      price,
      basePrice: typeof entry.basePrice === 'number' ? entry.basePrice : price,
      respect: typeof entry.respect === 'number' ? entry.respect : 0,
      serial: typeof entry.serial === 'string' ? entry.serial : '#001/500',
      wear: typeof entry.wear === 'number' ? entry.wear : 100,
      createdAt: typeof entry.createdAt === 'string' ? entry.createdAt : new Date().toISOString(),
      containerId: typeof entry.containerId === 'string' ? entry.containerId : 'legacy',
    };

    if (type === 'clothing') {
      return [{
        ...base,
        type: 'clothing',
        slot: isClothingSlot(entry.slot) ? entry.slot : getClothingSlot(entry.name),
        authenticity: entry.authenticity === 'original' || entry.authenticity === 'fake' ? entry.authenticity : 'unverified',
      }];
    }

    return [{
      ...base,
      type: 'car',
      slot: 'car',
      mileage: typeof entry.mileage === 'number' ? entry.mileage : 0,
      licensePlate: typeof entry.licensePlate === 'string' ? entry.licensePlate : undefined,
      licensePlateId: typeof entry.licensePlateId === 'string' ? entry.licensePlateId : undefined,
      mileageRolledBack: entry.mileageRolledBack === true,
      mileageTampered: entry.mileageTampered === true,
    }];
  });
};

const migrateLicensePlates = (value: unknown): LicensePlateItem[] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): LicensePlateItem[] => {
    if (!isRecord(entry) || typeof entry.id !== 'string' || typeof entry.plate !== 'string' || !isValidRussianLicensePlate(entry.plate)) return [];
    const generated = createLicensePlateItem(entry.plate, entry.id);
    return [{ ...generated, price: typeof entry.price === 'number' && entry.price > 0 ? Math.max(entry.price, generated.price) : generated.price }];
  });
};

const migrateMarketItem = (value: unknown): AuctionItem | undefined => {
  if (!isRecord(value)) return undefined;
  if (value.type === 'plate' && typeof value.id === 'string' && typeof value.plate === 'string' && isValidRussianLicensePlate(value.plate)) {
    const valuation = getLicensePlateValuation(value.plate);
    return {
      id: value.id,
      type: 'plate',
      name: value.plate,
      plate: value.plate,
      rarity: valuation.rarity,
      price: typeof value.price === 'number' && value.price > 0 ? value.price : valuation.price,
    };
  }
  return migrateInventory([value])[0];
};

const migrateAuctionListings = (value: unknown): AuctionListing[] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): AuctionListing[] => {
    if (
      !isRecord(entry) ||
      typeof entry.id !== 'string' ||
      typeof entry.seller !== 'string' ||
      typeof entry.askingPrice !== 'number' ||
      !isRecord(entry.item)
    ) {
      return [];
    }
    const item = migrateMarketItem(entry.item);
    if (!item) return [];
    return [{
      id: entry.id,
      seller: entry.seller,
      item,
      askingPrice: entry.askingPrice,
      listedAt: typeof entry.listedAt === 'string' ? entry.listedAt : new Date().toISOString(),
      isPlayerListing: entry.isPlayerListing === true,
    }];
  });
};

const migrateEquippedClothing = (
  value: unknown,
  inventory: InventoryItem[],
): Partial<Record<ClothingSlot, string>> => {
  if (!isRecord(value)) return {};
  const equipped: Partial<Record<ClothingSlot, string>> = {};
  for (const slot of ['head', 'torso', 'legs', 'shoes', 'accessory'] as ClothingSlot[]) {
    const itemId = value[slot];
    if (
      typeof itemId === 'string' &&
      inventory.some((item) => item.id === itemId && item.type === 'clothing' && item.slot === slot)
    ) {
      equipped[slot] = itemId;
    }
  }
  return equipped;
};

export const normalizePlayerState = (decoded: unknown, preserveBalance = false): PlayerState => {
  try {
    if (!isRecord(decoded)) throw new Error('Сохранённое состояние игрока имеет неверный формат.');

    const oldEconomy = decoded.economyVersion !== 4;
    const oldBalance = typeof decoded.balance === 'number' ? decoded.balance : STARTING_PLAYER.balance;
    let inventory = migrateInventory(decoded.inventory);
    let auctionListings = migrateAuctionListings(decoded.auctionListings);
    let licensePlates = migrateLicensePlates(decoded.licensePlates);

    const assignedPlateIds = new Set<string>();
    inventory = inventory.map((item) => {
      if (item.type !== 'car') return item;
      const linkedPlate = item.licensePlateId ? licensePlates.find((plate) => plate.id === item.licensePlateId) : undefined;
      if (linkedPlate && !assignedPlateIds.has(linkedPlate.id)) {
        assignedPlateIds.add(linkedPlate.id);
        return { ...item, licensePlate: undefined };
      }
      const legacyPlate = item.licensePlate;
      if (!legacyPlate || legacyPlate === '—' || !isValidRussianLicensePlate(legacyPlate)) {
        return { ...item, licensePlate: undefined, licensePlateId: undefined };
      }
      const availablePlate = licensePlates.find((plate) => plate.plate === legacyPlate && !assignedPlateIds.has(plate.id));
      const plate = availablePlate ?? createLicensePlateItem(legacyPlate, `legacy-plate-${item.id}`);
      if (!availablePlate) licensePlates = [...licensePlates, plate];
      assignedPlateIds.add(plate.id);
      return { ...item, licensePlate: undefined, licensePlateId: plate.id };
    });

    auctionListings = auctionListings.map((listing) => {
      if (!listing.isPlayerListing || listing.item.type !== 'car') return listing;
      const car = listing.item;
      const linkedPlate = car.licensePlateId ? licensePlates.find((plate) => plate.id === car.licensePlateId) : undefined;
      const legacyPlate = car.licensePlate;
      if (!linkedPlate && legacyPlate && legacyPlate !== '—' && isValidRussianLicensePlate(legacyPlate)) {
        licensePlates = [...licensePlates, createLicensePlateItem(legacyPlate, `legacy-auction-plate-${listing.id}`)];
      }
      return { ...listing, item: { ...car, licensePlateId: undefined, licensePlate: undefined } };
    });

    const activeCarId =
      typeof decoded.activeCarId === 'string' &&
      inventory.some((item) => item.id === decoded.activeCarId && item.type === 'car')
        ? decoded.activeCarId
        : undefined;
    const licensePlateFrames = Array.isArray(decoded.licensePlateFrames)
      ? [...new Set(decoded.licensePlateFrames.filter((id): id is string => typeof id === 'string' && id.length <= 80))]
      : [];
    const equippedLicensePlateFrameId = decoded.equippedLicensePlateFrameId === null
      ? null
      : typeof decoded.equippedLicensePlateFrameId === 'string' && licensePlateFrames.includes(decoded.equippedLicensePlateFrameId)
        ? decoded.equippedLicensePlateFrameId
        : undefined;
    return withEquippedStats({
      balance: !preserveBalance && oldEconomy && oldBalance === 1500 ? STARTING_PLAYER.balance : oldBalance,
      respect: typeof decoded.respect === 'number' ? decoded.respect : STARTING_PLAYER.respect,
      xp: typeof decoded.xp === 'number' && decoded.xp >= 0 ? Math.floor(decoded.xp) : 0,
      inventory,
      licensePlates,
      favoriteLicensePlateIds: Array.isArray(decoded.favoriteLicensePlateIds)
        ? [...new Set(decoded.favoriteLicensePlateIds.filter((id): id is string => typeof id === 'string' && licensePlates.some((plate) => plate.id === id)))]
        : [],
      licensePlateFrames,
      equippedLicensePlateFrameId,
      seasonCaseTokens: isRecord(decoded.seasonCaseTokens)
        ? Object.fromEntries(Object.entries(decoded.seasonCaseTokens).filter((entry): entry is [string, number] => typeof entry[0] === 'string' && Number.isSafeInteger(entry[1]) && Number(entry[1]) > 0))
        : {},
      containerKeys: typeof decoded.containerKeys === 'number' && Number.isSafeInteger(decoded.containerKeys) && decoded.containerKeys > 0
        ? Math.min(decoded.containerKeys, 1_000_000)
        : 0,
      dailyMissions: normalizeDailyMissionState(decoded.dailyMissions),
      equippedClothing: migrateEquippedClothing(decoded.equippedClothing, inventory),
      activeCarId,
      auctionListings,
      closedMarketListingIds: Array.isArray(decoded.closedMarketListingIds)
        ? decoded.closedMarketListingIds.filter((id): id is string => typeof id === 'string')
        : [],
      avatarEmoji: typeof decoded.avatarEmoji === 'string' ? decoded.avatarEmoji : STARTING_PLAYER.avatarEmoji,
      avatarUrl: typeof decoded.avatarUrl === 'string' ? decoded.avatarUrl : undefined,
      lastSaved: typeof decoded.lastSaved === 'string' ? decoded.lastSaved : undefined,
      freeCaseOpenedAt: typeof decoded.freeCaseOpenedAt === 'string' ? decoded.freeCaseOpenedAt : undefined,
      economyVersion: 4,
    });
  } catch (error) {
    console.error('Не удалось загрузить состояние LootLand из localStorage.', error);
    return STARTING_PLAYER;
  }
};

export const loadPlayerState = (): PlayerState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return STARTING_PLAYER;
    return normalizePlayerState(JSON.parse(raw) as unknown);
  } catch (error) {
    console.error('Не удалось загрузить состояние LootLand из localStorage.', error);
    return STARTING_PLAYER;
  }
};

export const savePlayerState = (player: PlayerState): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...player, lastSaved: new Date().toISOString() }));
};
