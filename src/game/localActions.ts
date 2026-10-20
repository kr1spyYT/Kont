import { CONTAINERS, pickDrop } from '../data/items';
import { withEquippedStats } from './player';
import { createLicensePlateItem, createRandomLicensePlate, getLicensePlateValuation, getSellableLicensePlates, isLicensePlateRarity, LICENSE_PLATE_RARITY_LABELS, LICENSE_PLATE_SPIN_PRICE } from './licensePlates';
import { claimDailyMissionReward, recordDailyMissionProgress } from './dailyMissions';
import { getResaleValue, getQuickSellValue, getQuickSellEligibleItems, LEGIT_CHECK_PRICE, ORIGINAL_PRICE_MULTIPLIER, BAD_LEGIT_PRICE_MULTIPLIER, DETAILING_PRICE_MULTIPLIER, MILEAGE_SUCCESS_PRICE_MULTIPLIER, MILEAGE_FAILURE_PRICE_MULTIPLIER } from './economy';
import type { CarItem, ClothingItem, InventoryItem, PlayerState } from '../types/game';
import type { ActionResponse, AuthenticatedPlayer, GameAction, PlayerSnapshot } from '../types/server';
import { createId } from '../utils/id';
import { OWNER_RANK_TITLE, rankForXp } from './ranks';

const snapshot = (player: PlayerState, user: AuthenticatedPlayer): PlayerSnapshot => {
  const xp = player.xp ?? 0;
  const owner = user.id === '1065784387';
  const rankTitle = owner ? OWNER_RANK_TITLE : rankForXp(xp);
  return { player: withEquippedStats(player), xp, rankTitle, isOwner: owner, isPremiumPass: false, telegramUser: user };
};

const makeItem = (containerId: string, drop: ReturnType<typeof pickDrop>): InventoryItem => {
  const container = CONTAINERS.find((entry) => entry.id === containerId)!;
  const wear = Math.round((Math.random() * 80 + 20) * 100) / 100;
  const base = {
    id: createId('item'), name: drop.name, type: container.category, rarity: drop.rarity,
    icon: drop.icon, image: drop.image, price: Math.round(drop.basePrice * (0.55 + wear / 100 * 0.45)),
    basePrice: drop.basePrice, respect: drop.respect,
    serial: `#${String(Math.floor(Math.random() * 500) + 1).padStart(3, '0')}/500`, wear,
    createdAt: new Date().toISOString(), containerId,
  };
  if (container.category === 'clothing') return { ...base, type: 'clothing', slot: drop.slot ?? 'accessory', authenticity: 'unverified' } as ClothingItem;
  if (container.category === 'car') return { ...base, type: 'car', slot: 'car', mileage: Math.floor(Math.random() * 365_001) + 15_000 } as CarItem;
  throw new Error('Контейнер с номерами не выдаёт предметы одежды или автомобили.');
};

const addXp = (player: PlayerState, amount: number) => ({ ...player, xp: (player.xp ?? 0) + amount });
const isEquipped = (player: PlayerState, itemId: string) => player.activeCarId === itemId || Object.values(player.equippedClothing).includes(itemId);

export function applyLocalAction(player: PlayerState, action: GameAction, user: AuthenticatedPlayer): ActionResponse {
  let next = { ...player };
  let result: ActionResponse['result'];
  let missionProgressEvent: 'open-container' | 'spin-license-plate' | 'sell-license-plate' | undefined;
  let missionProgressAmount = 1;
  switch (action.type) {
    case 'top-up-owner':
      if (user.id !== '1065784387') throw new Error('Пополнение доступно только владельцу игры.');
      next.balance += 1_000_000;
      break;
    case 'set-avatar': next.avatarEmoji = action.avatarEmoji; break;
    case 'open-container': {
      const container = CONTAINERS.find((entry) => entry.id === action.containerId);
      if (!container) throw new Error('Контейнер не найден.');
      if (action.free && action.useKey) throw new Error('Для бесплатного открытия ключ не нужен.');
      if (action.useKey) {
        if (container.category === 'plates') throw new Error('Ключи подходят для контейнеров с одеждой и автомобилями.');
        if (next.containerKeys < 1) throw new Error('У тебя нет ключа для открытия контейнера.');
        next.containerKeys -= 1;
      } else if (action.free) {
        if (container.id !== 'second-hand-bale' || container.category !== 'clothing') throw new Error('Бесплатен только ежедневный контейнер с одеждой.');
        if (player.freeCaseOpenedAt && Date.now() - new Date(player.freeCaseOpenedAt).getTime() < 86_400_000) throw new Error('Бесплатный контейнер можно открыть раз в 24 часа.');
        next.freeCaseOpenedAt = new Date().toISOString();
      } else {
        if (next.balance < container.price) throw new Error(`Не хватает ${container.price - next.balance} ₽.`);
        next.balance -= container.price;
      }
      const drop = pickDrop(container);
      missionProgressEvent = 'open-container';
      if (container.category === 'plates') {
        const plate = createLicensePlateItem(createRandomLicensePlate());
        next.licensePlates = [...next.licensePlates, plate];
        next = addXp(next, 5);
        result = { plate: plate.plate, message: `Номер ${plate.plate} сохранён в коллекции.` };
      } else {
        const item = makeItem(container.id, drop);
        next.inventory = [...next.inventory, item];
        next = addXp(next, 10);
        result = { item, message: action.useKey ? 'Контейнер открыт за ключ. Приз сохранён в инвентаре.' : undefined };
      }
      break;
    }
    case 'open-season-case': {
      const container = CONTAINERS.find((entry) => entry.id === action.containerId);
      const tokenCount = next.seasonCaseTokens[action.containerId] ?? 0;
      if (!container || (container.category !== 'clothing' && container.category !== 'car') || tokenCount < 1) throw new Error('Сезонный кейс не найден или билет уже использован.');
      next.seasonCaseTokens = { ...next.seasonCaseTokens };
      if (tokenCount === 1) delete next.seasonCaseTokens[action.containerId];
      else next.seasonCaseTokens[action.containerId] = tokenCount - 1;
      const item = makeItem(container.id, pickDrop(container));
      next.inventory = [...next.inventory, item];
      next = addXp(next, 10);
      missionProgressEvent = 'open-container';
      result = { item, message: `Сезонный кейс открыт бесплатно: «${item.name}».` };
      break;
    }
    case 'sell-item': {
      const item = next.inventory.find((entry) => entry.id === action.itemId);
      if (!item || isEquipped(next, action.itemId)) throw new Error('Предмет не найден или экипирован.');
      next.balance += getResaleValue(item);
      next.inventory = next.inventory.filter((entry) => entry.id !== item.id);
      break;
    }
    case 'quick-sell-item': {
      const item = next.inventory.find((entry) => entry.id === action.itemId);
      if (!item || isEquipped(next, action.itemId)) throw new Error('Предмет не найден или экипирован.');
      if (item.type === 'car' && (item.licensePlateId || item.licensePlate)) throw new Error('Сначала сними госномер с машины.');
      const proceeds = getQuickSellValue(item);
      next.balance += proceeds;
      next.inventory = next.inventory.filter((entry) => entry.id !== item.id);
      result = { message: `Быстрая продажа: +${proceeds.toLocaleString('ru-RU')} ₽.` };
      break;
    }
    case 'quick-sell-junk': {
      const protectedIds = new Set(next.inventory.filter((item) => isEquipped(next, item.id)).map((item) => item.id));
      const itemsToSell = getQuickSellEligibleItems(next.inventory, protectedIds);
      if (!itemsToSell.length) throw new Error('Нет неэкипированных предметов для быстрой продажи. Сначала сними госномера с машин.');
      const soldIds = new Set(itemsToSell.map((item) => item.id));
      const proceeds = itemsToSell.reduce((total, item) => total + getQuickSellValue(item), 0);
      next.inventory = next.inventory.filter((item) => !soldIds.has(item.id));
      next.balance += proceeds;
      result = { success: true, soldCount: itemsToSell.length, message: `Продано предметов: ${itemsToSell.length} · +${proceeds.toLocaleString('ru-RU')} ₽.` };
      break;
    }
    case 'spin-license-plate': {
      if (next.balance < LICENSE_PLATE_SPIN_PRICE) throw new Error('Недостаточно средств для прокрутки.');
      const plate = createRandomLicensePlate();
      next.balance -= LICENSE_PLATE_SPIN_PRICE;
      next.licensePlates = [...next.licensePlates, createLicensePlateItem(plate)];
      missionProgressEvent = 'spin-license-plate';
      next = addXp(next, 5);
      result = { plate };
      break;
    }
    case 'sell-license-plate': {
      const plate = next.licensePlates.find((entry) => entry.id === action.plateId);
      if (!plate || next.inventory.some((entry) => entry.type === 'car' && entry.licensePlateId === plate.id)) throw new Error('Номер не найден или установлен на машину.');
      if (next.favoriteLicensePlateIds.includes(plate.id)) throw new Error('Сначала убери номер из избранного.');
      next.balance += getResaleValue(plate);
      next.licensePlates = next.licensePlates.filter((entry) => entry.id !== plate.id);
      next.favoriteLicensePlateIds = next.favoriteLicensePlateIds.filter((id) => id !== plate.id);
      missionProgressEvent = 'sell-license-plate';
      break;
    }
    case 'sell-license-plates': {
      if (action.rarity !== 'all' && !isLicensePlateRarity(action.rarity)) throw new Error('Редкость номера имеет неверный формат.');
      const installedPlateIds = new Set(next.inventory.flatMap((item) => item.type === 'car' && item.licensePlateId ? [item.licensePlateId] : []));
      const favoritePlateIds = new Set(next.favoriteLicensePlateIds);
      const platesToSell = getSellableLicensePlates(next.licensePlates, installedPlateIds, action.rarity, favoritePlateIds);
      if (!platesToSell.length) throw new Error('Нет свободных номеров выбранной редкости для продажи.');
      const soldIds = new Set(platesToSell.map((plate) => plate.id));
      const proceeds = platesToSell.reduce((total, plate) => total + getResaleValue(plate), 0);
      next.licensePlates = next.licensePlates.filter((plate) => !soldIds.has(plate.id));
      next.favoriteLicensePlateIds = next.favoriteLicensePlateIds.filter((id) => !soldIds.has(id));
      next.balance += proceeds;
      missionProgressEvent = 'sell-license-plate';
      missionProgressAmount = platesToSell.length;
      const rarityLabel = action.rarity === 'all' ? 'всех редкостей' : `редкости «${LICENSE_PLATE_RARITY_LABELS[action.rarity]}»`;
      result = { success: true, message: `Продано номеров: ${platesToSell.length} (${rarityLabel}), выручка ${proceeds.toLocaleString('ru-RU')} ₽.` };
      break;
    }
    case 'set-license-plate-favorite': {
      if (!next.licensePlates.some((plate) => plate.id === action.plateId)) throw new Error('Номер не найден в коллекции.');
      const favoriteIds = new Set(next.favoriteLicensePlateIds);
      if (action.favorite) favoriteIds.add(action.plateId);
      else favoriteIds.delete(action.plateId);
      next.favoriteLicensePlateIds = [...favoriteIds];
      break;
    }
    case 'claim-daily-mission': {
      const claim = claimDailyMissionReward(next.dailyMissions, action.missionId);
      next.dailyMissions = claim.state;
      next.balance += claim.reward;
      result = { success: true, reward: claim.reward, message: `Награда получена: ${claim.reward.toLocaleString('ru-RU')} ₽.` };
      break;
    }
    case 'equip-clothing': {
      const item = next.inventory.find((entry) => entry.id === action.itemId);
      if (!item || item.type !== 'clothing' || item.slot !== action.slot) throw new Error('Предмет не подходит для этого слота.');
      const equippedClothing = { ...next.equippedClothing };
      if (equippedClothing[action.slot] === item.id) delete equippedClothing[action.slot];
      else equippedClothing[action.slot] = item.id;
      next.equippedClothing = equippedClothing;
      break;
    }
    case 'equip-license-plate-frame':
      if (action.frameId !== null && !next.licensePlateFrames.includes(action.frameId)) throw new Error('Эта рамка ещё не получена. Забери её в награде Season Pass.');
      next.equippedLicensePlateFrameId = action.frameId;
      break;
    case 'set-active-car':
      if (action.carId && !next.inventory.some((entry) => entry.id === action.carId && entry.type === 'car')) throw new Error('Машина не найдена.');
      next.activeCarId = next.activeCarId === action.carId ? undefined : action.carId;
      break;
    case 'set-car-plate': {
      const car = next.inventory.find((entry) => entry.id === action.carId && entry.type === 'car');
      if (!car || (action.plateId && !next.licensePlates.some((entry) => entry.id === action.plateId))) throw new Error('Машина или номер не найдены.');
      next.inventory = next.inventory.map((entry) => entry.type === 'car'
        ? { ...entry, licensePlateId: entry.id === car.id ? action.plateId : entry.licensePlateId === action.plateId ? undefined : entry.licensePlateId }
        : entry);
      break;
    }
    case 'workshop': {
      const item = next.inventory.find((entry) => entry.id === action.itemId);
      if (!item) throw new Error('Предмет не найден.');
      let updated: InventoryItem = item;
      if (action.operation === 'detail' && item.type === 'car' && item.wear < 100) {
        updated = { ...item, wear: 100, price: Math.max(item.price, Math.round(item.basePrice * DETAILING_PRICE_MULTIPLIER)) };
        result = { success: true };
      } else if (action.operation === 'legit' && item.type === 'clothing' && (action.free || next.balance >= LEGIT_CHECK_PRICE)) {
        if (!action.free) next.balance -= LEGIT_CHECK_PRICE;
        const original = Math.random() < 0.65;
        updated = { ...item, authenticity: original ? 'original' : 'fake', price: original ? Math.max(item.price, Math.round(item.basePrice * ORIGINAL_PRICE_MULTIPLIER)) : Math.max(1, Math.round(item.price * BAD_LEGIT_PRICE_MULTIPLIER)) };
        result = { success: original };
      } else if (action.operation === 'mileage' && item.type === 'car' && !item.mileageRolledBack && !item.mileageTampered) {
        const success = action.skillScore !== undefined && action.skillScore >= 40 && action.skillScore <= 60;
        updated = success ? { ...item, mileage: 15_000, mileageRolledBack: true, price: Math.round(item.price * MILEAGE_SUCCESS_PRICE_MULTIPLIER) } : { ...item, mileageTampered: true, price: Math.max(1, Math.round(item.price * MILEAGE_FAILURE_PRICE_MULTIPLIER)) };
        result = { success };
      } else throw new Error('Эту операцию нельзя выполнить.');
      next.inventory = next.inventory.map((entry) => entry.id === item.id ? updated : entry);
      next = addXp(next, 2);
      break;
    }
    case 'list-item': {
      const item = next.inventory.find((entry) => entry.id === action.itemId);
      if (!item || isEquipped(next, item.id) || !Number.isSafeInteger(action.askingPrice) || action.askingPrice < 1) throw new Error('Невозможно выставить этот предмет.');
      next.inventory = next.inventory.filter((entry) => entry.id !== item.id);
      next.auctionListings = [{ id: createId('listing'), seller: '@you', item: item.type === 'car' ? { ...item, licensePlateId: undefined } : item, askingPrice: action.askingPrice, listedAt: new Date().toISOString(), isPlayerListing: true }, ...next.auctionListings];
      break;
    }
    case 'list-license-plate': {
      const plate = next.licensePlates.find((entry) => entry.id === action.plateId);
      const installed = next.inventory.some((entry) => entry.type === 'car' && entry.licensePlateId === action.plateId);
      if (!plate || installed || next.favoriteLicensePlateIds.includes(action.plateId) || !Number.isSafeInteger(action.askingPrice) || action.askingPrice < 1) {
        throw new Error('Номер не найден, установлен, избран или цена указана неверно.');
      }
      const item = { id: plate.id, type: 'plate' as const, name: plate.plate, plate: plate.plate, rarity: getLicensePlateValuation(plate.plate).rarity, price: plate.price };
      next.licensePlates = next.licensePlates.filter((entry) => entry.id !== plate.id);
      next.auctionListings = [{ id: createId('listing'), seller: '@you', item, askingPrice: action.askingPrice, listedAt: new Date().toISOString(), isPlayerListing: true }, ...next.auctionListings];
      break;
    }
    case 'cancel-listing': {
      const listing = next.auctionListings.find((entry) => entry.id === action.listingId);
      if (!listing) throw new Error('Лот не найден.');
      next.auctionListings = next.auctionListings.filter((entry) => entry.id !== listing.id);
      if (listing.item.type === 'plate') next.licensePlates = [...next.licensePlates, createLicensePlateItem(listing.item.plate, listing.item.id)];
      else next.inventory = [...next.inventory, listing.item];
      break;
    }
    case 'buy-listing': throw new Error('Покупки игроков доступны в серверной версии.');
  }
  if (missionProgressEvent) {
    next.dailyMissions = recordDailyMissionProgress(next.dailyMissions, missionProgressEvent, missionProgressAmount);
  }
  return { snapshot: snapshot(withEquippedStats(next), user), result };
}
