import { CONTAINERS, pickDrop } from '../data/items';
import { withEquippedStats } from './player';
import { createLicensePlateItem, createRandomLicensePlate, getLicensePlateValuation, LICENSE_PLATE_SPIN_PRICE } from './licensePlates';
import { getResaleValue, LEGIT_CHECK_PRICE, ORIGINAL_PRICE_MULTIPLIER, BAD_LEGIT_PRICE_MULTIPLIER, DETAILING_PRICE_MULTIPLIER, MILEAGE_SUCCESS_PRICE_MULTIPLIER, MILEAGE_FAILURE_PRICE_MULTIPLIER } from './economy';
import type { CarItem, ClothingItem, InventoryItem, PlayerState } from '../types/game';
import type { ActionResponse, AuthenticatedPlayer, GameAction, PlayerSnapshot } from '../types/server';
import { createId } from '../utils/id';
import { OWNER_RANK_TITLE, rankForXp } from './ranks';

const snapshot = (player: PlayerState, user: AuthenticatedPlayer): PlayerSnapshot => {
  const xp = player.xp ?? 0;
  const owner = user.id === '1065784387';
  const rankTitle = owner ? OWNER_RANK_TITLE : rankForXp(xp);
  return { player: withEquippedStats(player), xp, rankTitle, isOwner: owner, telegramUser: user };
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
  switch (action.type) {
    case 'top-up-owner':
      if (user.id !== '1065784387') throw new Error('Пополнение доступно только владельцу игры.');
      next.balance += 1_000_000;
      break;
    case 'set-avatar': next.avatarEmoji = action.avatarEmoji; break;
    case 'open-container': {
      const container = CONTAINERS.find((entry) => entry.id === action.containerId);
      if (!container) throw new Error('Контейнер не найден.');
      if (action.free) {
        if (container.id !== 'second-hand-bale' || container.category !== 'clothing') throw new Error('Бесплатен только ежедневный контейнер с одеждой.');
        if (player.freeCaseOpenedAt && Date.now() - new Date(player.freeCaseOpenedAt).getTime() < 86_400_000) throw new Error('Бесплатный контейнер можно открыть раз в 24 часа.');
        next.freeCaseOpenedAt = new Date().toISOString();
      } else {
        if (next.balance < container.price) throw new Error(`Не хватает ${container.price - next.balance} ₽.`);
        next.balance -= container.price;
      }
      const drop = pickDrop(container);
      if (container.category === 'plates') {
        const plate = createLicensePlateItem(createRandomLicensePlate());
        next.licensePlates = [...next.licensePlates, plate];
        next = addXp(next, 5);
        result = { plate: plate.plate, message: `Номер ${plate.plate} сохранён в коллекции.` };
      } else {
        const item = makeItem(container.id, drop);
        next.inventory = [...next.inventory, item];
        next = addXp(next, 10);
        result = { item };
      }
      break;
    }
    case 'sell-item': {
      const item = next.inventory.find((entry) => entry.id === action.itemId);
      if (!item || isEquipped(next, action.itemId)) throw new Error('Предмет не найден или экипирован.');
      next.balance += getResaleValue(item);
      next.inventory = next.inventory.filter((entry) => entry.id !== item.id);
      break;
    }
    case 'spin-license-plate': {
      if (next.balance < LICENSE_PLATE_SPIN_PRICE) throw new Error('Недостаточно средств для прокрутки.');
      const plate = createRandomLicensePlate();
      next.balance -= LICENSE_PLATE_SPIN_PRICE;
      next.licensePlates = [...next.licensePlates, createLicensePlateItem(plate)];
      next = addXp(next, 5);
      result = { plate };
      break;
    }
    case 'sell-license-plate': {
      const plate = next.licensePlates.find((entry) => entry.id === action.plateId);
      if (!plate || next.inventory.some((entry) => entry.type === 'car' && entry.licensePlateId === plate.id)) throw new Error('Номер не найден или установлен на машину.');
      next.balance += getResaleValue(plate);
      next.licensePlates = next.licensePlates.filter((entry) => entry.id !== plate.id);
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
    case 'cancel-listing': {
      const listing = next.auctionListings.find((entry) => entry.id === action.listingId);
      if (!listing) throw new Error('Лот не найден.');
      next.auctionListings = next.auctionListings.filter((entry) => entry.id !== listing.id);
      next.inventory = [...next.inventory, listing.item];
      break;
    }
    case 'buy-listing': throw new Error('Покупки игроков доступны в серверной версии.');
  }
  return { snapshot: snapshot(withEquippedStats(next), user), result };
}
