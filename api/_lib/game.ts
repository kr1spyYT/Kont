import { pickDrop } from '../../src/data/items.js';
import { ensureContainerCatalog, listContainerCatalog } from './containers.js';
import { withEquippedStats, STARTING_PLAYER } from '../../src/game/player.js';
import {
  createLicensePlateItem,
  createRandomLicensePlate,
  getLicensePlateValuation,
  getSellableLicensePlates,
  isLicensePlateRarity,
  isValidRussianLicensePlate,
  LICENSE_PLATE_RARITY_LABELS,
  LICENSE_PLATE_SPIN_PRICE,
} from '../../src/game/licensePlates.js';
import { getResaleValue, getQuickSellValue, getQuickSellEligibleItems, LEGIT_CHECK_PRICE, ORIGINAL_PRICE_MULTIPLIER, BAD_LEGIT_PRICE_MULTIPLIER, DETAILING_PRICE_MULTIPLIER, MILEAGE_SUCCESS_PRICE_MULTIPLIER, MILEAGE_FAILURE_PRICE_MULTIPLIER } from '../../src/game/economy.js';
import { normalizePlayerState } from '../../src/persistence/playerStorage.js';
import type { AuctionItem, CarItem, ClothingItem, DailyMissionId, InventoryItem, MarketPlateItem, PlayerState } from '../../src/types/game.js';
import type { ActionResponse, AuthenticatedPlayer, GameAction, LeaderboardEntry, LeaderboardMetric, MarketListing, MarketSaleNotification, MarketSnapshot, PlayerSnapshot, PublicPlayerProfile } from '../../src/types/server.js';
import { createId } from '../../src/utils/id.js';
import { OWNER_RANK_TITLE, rankForXp } from '../../src/game/ranks.js';
import { isOwnerTelegramId } from './auth.js';
import { getPool } from './db.js';
import { getEconomySettings } from './admin.js';
import { claimDailyMissionReward, recordDailyMissionProgress } from '../../src/game/dailyMissions.js';
import { awardSeasonXp } from './season.js';

export interface PlayerRow {
  telegram_id: string;
  first_name: string;
  last_name: string | null;
  username: string | null;
  xp: number;
  state: unknown;
  free_case_opened_at: Date | string | null;
}

export const ensurePlayer = async (client: import('pg').PoolClient, user: AuthenticatedPlayer): Promise<PlayerRow> => {
  await client.query(
    `INSERT INTO players (telegram_id, first_name, last_name, username, state)
     VALUES ($1, $2, $3, $4, $5::jsonb)
     ON CONFLICT (telegram_id) DO UPDATE SET first_name = EXCLUDED.first_name,
       last_name = EXCLUDED.last_name, username = EXCLUDED.username,
       state = CASE WHEN $6::text IS NULL THEN players.state
                    ELSE jsonb_set(players.state, '{avatarUrl}', to_jsonb($6::text), true) END,
       updated_at = NOW()`,
    [user.id, user.firstName, user.lastName ?? null, user.username ?? null, JSON.stringify({ ...STARTING_PLAYER, avatarUrl: user.photoUrl }), user.photoUrl ?? null],
  );
  const { rows } = await client.query<PlayerRow>('SELECT * FROM players WHERE telegram_id = $1 FOR UPDATE', [user.id]);
  return rows[0];
};

const normalizeDbPlayer = (row: PlayerRow): PlayerState => {
  const state = normalizePlayerState(row.state);
  return withEquippedStats({ ...state, auctionListings: [] });
};

export const makeSnapshot = (row: PlayerRow, user: AuthenticatedPlayer): PlayerSnapshot => {
  const isOwner = isOwnerTelegramId(user.id);
  const xp = Number(row.xp) || 0;
  const freeCaseNextAt = row.free_case_opened_at ? new Date(row.free_case_opened_at).getTime() + 24 * 60 * 60 * 1000 : 0;
  return {
    player: { ...normalizeDbPlayer(row), xp },
    xp,
    rankTitle: isOwner ? OWNER_RANK_TITLE : rankForXp(xp),
    isOwner,
    freeCaseAvailableAt: freeCaseNextAt > Date.now() ? new Date(freeCaseNextAt).toISOString() : undefined,
    telegramUser: user,
  };
};

async function makeServerSnapshot(
  client: import('pg').PoolClient,
  row: PlayerRow,
  user: AuthenticatedPlayer,
): Promise<PlayerSnapshot> {
  await ensureContainerCatalog(client);
  const { rows } = await client.query<{
    container_id: string;
    last_opened_at: Date | string;
    cooldown_seconds: number;
  }>(
    `SELECT o.container_id, o.last_opened_at, c.cooldown_seconds
     FROM player_container_openings o
     JOIN game_containers c ON c.id = o.container_id
     WHERE o.telegram_id = $1 AND c.deleted_at IS NULL AND c.cooldown_seconds > 0`,
    [user.id],
  );
  const now = Date.now();
  const containerCooldowns = Object.fromEntries(rows.flatMap((opening) => {
    const availableAt = new Date(opening.last_opened_at).getTime() + Number(opening.cooldown_seconds) * 1000;
    return availableAt > now ? [[opening.container_id, new Date(availableAt).toISOString()]] : [];
  }));
  return { ...makeSnapshot(row, user), containerCooldowns };
}

function formatCooldown(milliseconds: number): string {
  const totalMinutes = Math.max(1, Math.ceil(milliseconds / 60_000));
  const days = Math.floor(totalMinutes / 1_440);
  const hours = Math.floor((totalMinutes % 1_440) / 60);
  const minutes = totalMinutes % 60;
  return days ? `${days}д ${hours}ч` : hours ? `${hours}ч ${minutes}м` : `${minutes}м`;
}

const savePlayer = async (client: import('pg').PoolClient, userId: string, player: PlayerState, xp: number, freeCaseOpenedAt?: Date): Promise<PlayerRow> => {
  const normalized = withEquippedStats({ ...player, auctionListings: [], lastSaved: new Date().toISOString() });
  const values: unknown[] = [JSON.stringify(normalized), xp, userId];
  let freeCaseUpdate = '';
  if (freeCaseOpenedAt) {
    values.push(freeCaseOpenedAt.toISOString());
    freeCaseUpdate = `, free_case_opened_at = $4`;
  }
  const { rows } = await client.query<PlayerRow>(
    `UPDATE players SET state = $1::jsonb, xp = $2, updated_at = NOW()${freeCaseUpdate}
     WHERE telegram_id = $3 RETURNING *`,
    values,
  );
  return rows[0];
};

function error(message: string, status = 400): never {
  const failure = new Error(message) as Error & { statusCode?: number };
  failure.statusCode = status;
  throw failure;
}

async function assertPlayerAllowed(client: import('pg').PoolClient, userId: string): Promise<void> {
  const { rows } = await client.query<{ is_banned: boolean }>(
    'SELECT is_banned FROM players WHERE telegram_id = $1',
    [userId],
  );
  if (rows[0]?.is_banned) error('Доступ к игре временно ограничен. Обратись в поддержку.', 403);
}

const ensureRequestId = (action: GameAction) => {
  if (!('requestId' in action) || typeof action.requestId !== 'string' || action.requestId.length < 8 || action.requestId.length > 100) {
    error('Не удалось подтвердить запрос. Повтори действие.', 400);
  }
};

const equipped = (player: PlayerState, itemId: string) =>
  player.activeCarId === itemId || Object.values(player.equippedClothing).includes(itemId);

const makeDropItem = (container: import('../../src/types/game.js').Container, drop: ReturnType<typeof pickDrop>): InventoryItem => {
  const wear = Math.round((Math.random() * 80 + 20) * 100) / 100;
  const itemPrice = Math.round(drop.basePrice * (0.55 + (wear / 100) * 0.45));
  const base = {
    id: createId('item'), name: drop.name, type: container.category, rarity: drop.rarity,
    icon: drop.icon, image: drop.image, price: itemPrice, basePrice: drop.basePrice,
    respect: drop.respect, serial: `#${String(Math.floor(Math.random() * 500) + 1).padStart(3, '0')}/500`,
    wear,     createdAt: new Date().toISOString(), containerId: container.id,
  };
  if (container.category === 'clothing') {
    return { ...base, type: 'clothing', slot: drop.slot ?? 'accessory', authenticity: 'unverified' } as ClothingItem;
  }
  return { ...base, type: 'car', slot: 'car', mileage: Math.floor(Math.random() * (380_000 - 15_000 + 1)) + 15_000 } as CarItem;
};

const addXp = (xp: number, delta: number) => xp + delta;

export async function performAction(user: AuthenticatedPlayer, action: GameAction): Promise<ActionResponse> {
  ensureRequestId(action);
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    if (['list-item', 'list-license-plate', 'cancel-listing', 'buy-listing'].includes(action.type)) {
      await client.query('SELECT pg_advisory_xact_lock(731004812)');
    }
    let row = await ensurePlayer(client, user);
    await assertPlayerAllowed(client, user.id);
    const economy = await getEconomySettings(client);
    const duplicate = await client.query<{ response: { result?: ActionResponse['result'] } }>(
      'SELECT response FROM player_events WHERE telegram_id = $1 AND idempotency_key = $2',
      [user.id, action.requestId],
    );
    if (duplicate.rowCount) {
      await client.query('COMMIT');
      return { snapshot: await makeServerSnapshot(client, row, user), result: duplicate.rows[0].response?.result };
    }
    let player = normalizeDbPlayer(row);
    let xp = Number(row.xp) || 0;
    let freeCaseOpenedAt: Date | undefined;
    let result: ActionResponse['result'];
    let xpDelta = 0;
    let seasonXpDelta = 0;
    let balanceDelta = 0;
    let missionProgressEvent: DailyMissionId | undefined;
    let missionProgressAmount = 1;

    switch (action.type) {
      case 'top-up-owner':
        if (!isOwnerTelegramId(user.id)) error('Пополнение доступно только владельцу игры.', 403);
        player.balance += 1_000_000;
        balanceDelta = 1_000_000;
        break;
      case 'set-avatar': {
        const allowed = ['🕶️', '😎', '👽', '🤖', '🧢', '🐈‍⬛'];
        if (!allowed.includes(action.avatarEmoji)) error('Этот аватар недоступен.');
        player.avatarEmoji = action.avatarEmoji;
        break;
      }
      case 'open-container': {
        if (!economy.containersEnabled) error('Открытие контейнеров временно приостановлено.', 503);
        const container = (await listContainerCatalog(client)).find((entry) => entry.id === action.containerId);
        if (!container) error('Контейнер не найден. Обнови игру.');
        if ((container.cooldownSeconds ?? 0) > 0) {
          const { rows: openings } = await client.query<{ last_opened_at: Date | string }>(
            'SELECT last_opened_at FROM player_container_openings WHERE telegram_id = $1 AND container_id = $2 FOR UPDATE',
            [user.id, container.id],
          );
          const lastOpenedAt = openings[0]?.last_opened_at;
          if (lastOpenedAt) {
            const availableAt = new Date(lastOpenedAt).getTime() + (container.cooldownSeconds ?? 0) * 1000;
            if (availableAt > Date.now()) {
              error(`Контейнер снова будет доступен через ${formatCooldown(availableAt - Date.now())}.`, 429);
            }
          }
        }
        if (action.free && action.useKey) error('Для бесплатного открытия ключ не нужен.');
        if (action.useKey) {
          if (container.category === 'plates') error('Ключи подходят для контейнеров с одеждой и автомобилями.');
          if (player.containerKeys < 1) error('У тебя нет ключа для открытия контейнера.');
          player.containerKeys -= 1;
        } else if (action.free) {
          if (container.id !== 'second-hand-bale' || container.category !== 'clothing') error('Бесплатно доступен только ежедневный контейнер с одеждой.');
          const lastOpenedAt = row.free_case_opened_at ? new Date(row.free_case_opened_at).getTime() : 0;
          if (Date.now() - lastOpenedAt < 24 * 60 * 60 * 1000) error('Бесплатный контейнер можно открыть раз в 24 часа.', 429);
          freeCaseOpenedAt = new Date();
        } else {
          if (player.balance < container.price) error(`Не хватает ${container.price - player.balance} ₽.`);
          player.balance -= container.price;
          balanceDelta = -container.price;
        }
        const drop = pickDrop(container);
        missionProgressEvent = 'open-container';
        seasonXpDelta = 25;
        if (container.category === 'plates') {
          const plate = createLicensePlateItem(createRandomLicensePlate());
          player.licensePlates = [...player.licensePlates, plate];
          xpDelta = 5;
          result = { plate: plate.plate, message: `Номер ${plate.plate} сохранён в коллекции.` };
        } else {
          const item = makeDropItem(container, drop);
          player.inventory = [...player.inventory, item];
          xpDelta = 10;
          result = { item, message: action.useKey ? 'Контейнер открыт за ключ. Приз сохранён в инвентаре.' : 'Приз сохранён в инвентаре.' };
        }
        await client.query(
          `INSERT INTO player_container_openings (telegram_id, container_id, last_opened_at)
           VALUES ($1, $2, NOW())
           ON CONFLICT (telegram_id, container_id) DO UPDATE SET last_opened_at = EXCLUDED.last_opened_at`,
          [user.id, container.id],
        );
        break;
      }
      case 'open-season-case': {
        const container = (await listContainerCatalog(client)).find((entry) => entry.id === action.containerId);
        const tokenCount = player.seasonCaseTokens?.[action.containerId] ?? 0;
        if (!container || (container.category !== 'clothing' && container.category !== 'car') || !container.contents.length) error('Сезонный кейс не найден.');
        if (tokenCount < 1) error('Для этого контейнера нет билета на бесплатное открытие.', 403);
        const nextTokens = { ...(player.seasonCaseTokens ?? {}) };
        if (tokenCount === 1) delete nextTokens[action.containerId];
        else nextTokens[action.containerId] = tokenCount - 1;
        player.seasonCaseTokens = nextTokens;
        const item = makeDropItem(container, pickDrop(container));
        player.inventory = [...player.inventory, item];
        xpDelta = 10;
        seasonXpDelta = 25;
        missionProgressEvent = 'open-container';
        result = { item, message: `Сезонный кейс открыт бесплатно: «${item.name}».` };
        break;
      }
      case 'sell-item': {
        const item = player.inventory.find((entry) => entry.id === action.itemId);
        if (!item) error('Предмет не найден в инвентаре.');
        if (equipped(player, item.id)) error('Сначала сними предмет или убери машину из профиля.');
        player.inventory = player.inventory.filter((entry) => entry.id !== item.id);
        player.balance += getResaleValue(item, economy.resaleMultiplier);
        balanceDelta = getResaleValue(item, economy.resaleMultiplier);
        result = { message: `Предмет продан за ${balanceDelta} ₽.` };
        break;
      }
      case 'quick-sell-item': {
        const item = player.inventory.find((entry) => entry.id === action.itemId);
        if (!item) error('Предмет не найден в инвентаре.');
        if (equipped(player, item.id)) error('Сначала сними предмет или убери машину из профиля.');
        if (item.type === 'car' && (item.licensePlateId || item.licensePlate)) error('Сначала сними госномер с машины.');
        balanceDelta = getQuickSellValue(item);
        player.inventory = player.inventory.filter((entry) => entry.id !== item.id);
        player.balance += balanceDelta;
        seasonXpDelta = 10;
        result = { message: `Быстрая продажа: +${balanceDelta.toLocaleString('ru-RU')} ₽ и +10 XP сезона.` };
        break;
      }
      case 'quick-sell-junk': {
        const protectedIds = new Set(player.inventory.filter((item) => equipped(player, item.id)).map((item) => item.id));
        const itemsToSell = getQuickSellEligibleItems(player.inventory, protectedIds);
        if (!itemsToSell.length) error('Нет обычных или необычных предметов для безопасной продажи. Редкие вещи и машины с номерами защищены.');
        const soldIds = new Set(itemsToSell.map((item) => item.id));
        balanceDelta = itemsToSell.reduce((total, item) => total + getQuickSellValue(item), 0);
        player.inventory = player.inventory.filter((item) => !soldIds.has(item.id));
        player.balance += balanceDelta;
        seasonXpDelta = itemsToSell.length * 10;
        result = {
          success: true,
          soldCount: itemsToSell.length,
          seasonXpEarned: seasonXpDelta,
          message: `Продано предметов: ${itemsToSell.length} · +${balanceDelta.toLocaleString('ru-RU')} ₽ · +${seasonXpDelta} XP сезона. Редкие, экипированные и машины с номерами оставлены.`,
        };
        break;
      }
      case 'spin-license-plate': {
        if (player.balance < LICENSE_PLATE_SPIN_PRICE) error(`Не хватает ${LICENSE_PLATE_SPIN_PRICE - player.balance} ₽.`);
        const plate = createRandomLicensePlate();
        const item = createLicensePlateItem(plate);
        player.balance -= LICENSE_PLATE_SPIN_PRICE;
        balanceDelta = -LICENSE_PLATE_SPIN_PRICE;
        player.licensePlates = [...player.licensePlates, item];
        missionProgressEvent = 'spin-license-plate';
        xpDelta = 5;
        result = { plate, message: 'Номер добавлен в коллекцию.' };
        break;
      }
      case 'sell-license-plate': {
        const plate = player.licensePlates.find((entry) => entry.id === action.plateId);
        if (!plate) error('Номер не найден в коллекции.');
        if (player.inventory.some((entry) => entry.type === 'car' && entry.licensePlateId === plate.id)) error('Сначала сними номер с машины.');
        if (player.favoriteLicensePlateIds.includes(plate.id)) error('Сначала убери номер из избранного.');
        player.licensePlates = player.licensePlates.filter((entry) => entry.id !== plate.id);
        player.favoriteLicensePlateIds = player.favoriteLicensePlateIds.filter((id) => id !== plate.id);
        missionProgressEvent = 'sell-license-plate';
        player.balance += getResaleValue(plate, economy.resaleMultiplier);
        balanceDelta = getResaleValue(plate, economy.resaleMultiplier);
        break;
      }
      case 'sell-license-plates': {
        if (action.rarity !== 'all' && !isLicensePlateRarity(action.rarity)) error('Редкость номера имеет неверный формат.');
        const installedPlateIds = new Set(player.inventory.flatMap((item) => item.type === 'car' && item.licensePlateId ? [item.licensePlateId] : []));
        const platesToSell = getSellableLicensePlates(player.licensePlates, installedPlateIds, action.rarity, new Set(player.favoriteLicensePlateIds));
        if (!platesToSell.length) error('Нет свободных номеров выбранной редкости для продажи.');
        const soldIds = new Set(platesToSell.map((plate) => plate.id));
        balanceDelta = platesToSell.reduce((total, plate) => total + getResaleValue(plate, economy.resaleMultiplier), 0);
        player.licensePlates = player.licensePlates.filter((plate) => !soldIds.has(plate.id));
        player.favoriteLicensePlateIds = player.favoriteLicensePlateIds.filter((id) => !soldIds.has(id));
        player.balance += balanceDelta;
        missionProgressEvent = 'sell-license-plate';
        missionProgressAmount = platesToSell.length;
        const rarityLabel = action.rarity === 'all' ? 'всех редкостей' : `редкости «${LICENSE_PLATE_RARITY_LABELS[action.rarity]}»`;
        result = { success: true, message: `Продано номеров: ${platesToSell.length} (${rarityLabel}), выручка ${balanceDelta.toLocaleString('ru-RU')} ₽.` };
        break;
      }
      case 'set-license-plate-favorite': {
        if (typeof action.favorite !== 'boolean') error('Не удалось изменить статус избранного.');
        if (!player.licensePlates.some((plate) => plate.id === action.plateId)) error('Номер не найден в коллекции.');
        const favoriteIds = new Set(player.favoriteLicensePlateIds);
        if (action.favorite) favoriteIds.add(action.plateId);
        else favoriteIds.delete(action.plateId);
        player.favoriteLicensePlateIds = [...favoriteIds];
        break;
      }
      case 'claim-daily-mission': {
        const claim = claimDailyMissionReward(player.dailyMissions, action.missionId);
        player.dailyMissions = claim.state;
        player.balance += claim.reward;
        balanceDelta = claim.reward;
        result = { success: true, reward: claim.reward, message: `Награда получена: ${claim.reward.toLocaleString('ru-RU')} ₽.` };
        break;
      }
      case 'equip-clothing': {
        const item = player.inventory.find((entry) => entry.id === action.itemId);
        if (!item || item.type !== 'clothing' || item.slot !== action.slot) error('Предмет не подходит для этого слота.');
        const equippedItemId = player.equippedClothing[action.slot];
        const equippedClothing = { ...player.equippedClothing };
        if (equippedItemId === item.id) delete equippedClothing[action.slot];
        else equippedClothing[action.slot] = item.id;
        player.equippedClothing = equippedClothing;
        break;
      }
      case 'set-active-car': {
        if (action.carId && !player.inventory.some((entry) => entry.id === action.carId && entry.type === 'car')) error('Эта машина не принадлежит аккаунту.');
        player.activeCarId = player.activeCarId === action.carId ? undefined : action.carId;
        break;
      }
      case 'set-car-plate': {
        const car = player.inventory.find((entry) => entry.id === action.carId && entry.type === 'car');
        if (!car || car.type !== 'car') error('Машина не найдена.');
        if (action.plateId && !player.licensePlates.some((entry) => entry.id === action.plateId)) error('Этот номер не принадлежит аккаунту.');
        player.inventory = player.inventory.map((entry) => entry.type === 'car'
          ? { ...entry, licensePlateId: entry.id === car.id ? action.plateId : entry.licensePlateId === action.plateId ? undefined : entry.licensePlateId, licensePlate: undefined }
          : entry);
        break;
      }
      case 'workshop': {
        const item = player.inventory.find((entry) => entry.id === action.itemId);
        if (!item) error('Предмет не найден в гараже.');
        if (action.operation === 'detail') {
          if (item.type !== 'car' || item.wear >= 100) error('Детейлинг этому автомобилю не требуется.');
          const updated: CarItem = { ...item, wear: 100, price: Math.max(item.price, Math.round(item.basePrice * DETAILING_PRICE_MULTIPLIER)) };
          player.inventory = player.inventory.map((entry) => entry.id === item.id ? updated : entry);
          result = { success: true, message: 'Детейлинг завершён.' };
        } else if (action.operation === 'legit') {
          if (item.type !== 'clothing') error('Проверку легитимности проходит одежда.');
          if (action.free !== undefined && typeof action.free !== 'boolean') error('Неверный тип проверки легитимности.');
          if (!action.free) {
            if (player.balance < LEGIT_CHECK_PRICE) error(`Не хватает ${LEGIT_CHECK_PRICE - player.balance} ₽.`);
            player.balance -= LEGIT_CHECK_PRICE;
            balanceDelta = -LEGIT_CHECK_PRICE;
          }
          const original = Math.random() < 0.65;
          const updated: ClothingItem = {
            ...item,
            authenticity: original ? 'original' : 'fake',
            price: original ? Math.max(item.price, Math.round(item.basePrice * ORIGINAL_PRICE_MULTIPLIER)) : Math.max(1, Math.round(item.price * BAD_LEGIT_PRICE_MULTIPLIER)),
          };
          player.inventory = player.inventory.map((entry) => entry.id === item.id ? updated : entry);
          result = { success: original, message: original ? 'Экспертиза пройдена: оригинал.' : 'Экспертиза выявила подделку.' };
        } else {
          if (item.type !== 'car' || item.mileageRolledBack || item.mileageTampered) error('Пробег этой машины уже проверен.');
          if (!Number.isInteger(action.skillScore) || action.skillScore! < 0 || action.skillScore! > 100) error('Результат мини-игры имеет неверный формат.');
          const success = action.skillScore! >= 40 && action.skillScore! <= 60;
          const updated: CarItem = success
            ? { ...item, mileage: 15_000, mileageRolledBack: true, price: Math.round(item.price * MILEAGE_SUCCESS_PRICE_MULTIPLIER) }
            : { ...item, mileageTampered: true, price: Math.max(1, Math.round(item.price * MILEAGE_FAILURE_PRICE_MULTIPLIER)) };
          player.inventory = player.inventory.map((entry) => entry.id === item.id ? updated : entry);
          result = { success, message: success ? 'Пробег обновлён до 15 000 км.' : 'Операция не удалась: появилась отметка о вмешательстве.' };
        }
        xpDelta = 2;
        break;
      }
      case 'list-item': {
        if (!economy.marketplaceEnabled) error('Аукцион временно приостановлен.', 503);
        const item = player.inventory.find((entry) => entry.id === action.itemId);
        if (!item) error('Предмет не найден в инвентаре.');
        if (equipped(player, item.id)) error('Сначала сними предмет или убери машину из профиля.');
        if (!Number.isSafeInteger(action.askingPrice) || action.askingPrice < 1 || action.askingPrice > 2_000_000_000) error('Укажи корректную цену лота.');
        const marketItem = item.type === 'car' ? { ...item, licensePlateId: undefined, licensePlate: undefined } : item;
        const listingId = createId('listing');
        await client.query(
          `INSERT INTO market_listings (listing_id, seller_id, item, asking_price) VALUES ($1, $2, $3::jsonb, $4)`,
          [listingId, user.id, JSON.stringify(marketItem), action.askingPrice],
        );
        player.inventory = player.inventory.filter((entry) => entry.id !== item.id);
        result = { message: 'Лот опубликован на общем рынке.' };
        break;
      }
      case 'list-license-plate': {
        if (!economy.marketplaceEnabled) error('Аукцион временно приостановлен.', 503);
        const plate = player.licensePlates.find((entry) => entry.id === action.plateId);
        if (!plate) error('Номер не найден в коллекции.');
        if (player.favoriteLicensePlateIds.includes(plate.id)) error('Сначала убери номер из избранного.');
        if (player.inventory.some((entry) => entry.type === 'car' && entry.licensePlateId === plate.id)) error('Сначала сними номер с машины.');
        if (!Number.isSafeInteger(action.askingPrice) || action.askingPrice < 1 || action.askingPrice > 2_000_000_000) error('Укажи корректную цену лота.');
        const marketItem: MarketPlateItem = {
          id: plate.id,
          type: 'plate',
          name: plate.plate,
          plate: plate.plate,
          rarity: getLicensePlateValuation(plate.plate).rarity,
          price: plate.price,
        };
        const listingId = createId('listing');
        await client.query(
          `INSERT INTO market_listings (listing_id, seller_id, item, asking_price) VALUES ($1, $2, $3::jsonb, $4)`,
          [listingId, user.id, JSON.stringify(marketItem), action.askingPrice],
        );
        player.licensePlates = player.licensePlates.filter((entry) => entry.id !== plate.id);
        result = { message: 'Номер выставлен на общий рынок.' };
        break;
      }
      case 'cancel-listing': {
        const listing = await client.query<{ item: AuctionItem }>(
          `UPDATE market_listings SET status = 'cancelled' WHERE listing_id = $1 AND seller_id = $2 AND status = 'active' RETURNING item`,
          [action.listingId, user.id],
        );
        if (!listing.rowCount) error('Активный лот не найден.');
        const cancelledItem = listing.rows[0].item;
        if (cancelledItem.type === 'plate') {
          player.licensePlates = [...player.licensePlates, createLicensePlateItem(cancelledItem.plate, cancelledItem.id)];
        } else {
          player.inventory = [...player.inventory, cancelledItem];
        }
        break;
      }
      case 'buy-listing': {
        if (!economy.marketplaceEnabled) error('Аукцион временно приостановлен.', 503);
        const listingResult = await client.query<{ seller_id: string; item: AuctionItem; asking_price: number }>(
          'SELECT seller_id, item, asking_price FROM market_listings WHERE listing_id = $1 AND status = $2 FOR UPDATE',
          [action.listingId, 'active'],
        );
        const listing = listingResult.rows[0];
        if (!listing) error('Этот лот уже продан или снят. Обнови рынок.', 409);
        if (listing.seller_id === user.id) error('Нельзя купить собственный лот.');
        const participants = await client.query<PlayerRow>(
          'SELECT * FROM players WHERE telegram_id = ANY($1::text[]) ORDER BY telegram_id FOR UPDATE',
          [[user.id, listing.seller_id]],
        );
        const buyerRow = participants.rows.find((entry) => entry.telegram_id === user.id)!;
        const sellerRow = participants.rows.find((entry) => entry.telegram_id === listing.seller_id);
        if (!sellerRow) error('Профиль продавца не найден.', 409);
        const buyer = normalizeDbPlayer(buyerRow);
        const seller = normalizeDbPlayer(sellerRow);
        const price = Number(listing.asking_price);
        if (buyer.balance < price) error(`Не хватает ${price - buyer.balance} ₽ для покупки.`);
        const transferredItem = listing.item.type === 'plate'
          ? undefined
          : { ...listing.item, id: createId('market-item'), createdAt: new Date().toISOString() };
        const transferredPlate = listing.item.type === 'plate'
          ? createLicensePlateItem(listing.item.plate, createId('market-plate'))
          : undefined;
        buyer.balance -= price;
        if (transferredPlate) buyer.licensePlates = [...buyer.licensePlates, transferredPlate];
        if (transferredItem) buyer.inventory = [...buyer.inventory, transferredItem];
        seller.balance += price;
        await client.query(
          `UPDATE players SET state = $1::jsonb, updated_at = NOW() WHERE telegram_id = $2`,
          [JSON.stringify(withEquippedStats({ ...buyer, auctionListings: [] })), user.id],
        );
        await client.query(
          `UPDATE players SET state = $1::jsonb, updated_at = NOW() WHERE telegram_id = $2`,
          [JSON.stringify(withEquippedStats({ ...seller, auctionListings: [] })), listing.seller_id],
        );
        const marked = await client.query(
          `UPDATE market_listings SET status = 'sold', buyer_id = $1, sold_at = NOW() WHERE listing_id = $2 AND status = 'active'`,
          [user.id, action.listingId],
        );
        if (marked.rowCount !== 1) error('Лот уже купил другой игрок.', 409);
        row = buyerRow;
        player = buyer;
        xp = Number(buyerRow.xp);
        xpDelta = 5;
        balanceDelta = -price;
        result = transferredPlate
          ? { plate: transferredPlate.plate, message: `Номер ${transferredPlate.plate} куплен за ${price.toLocaleString('ru-RU')} ₽.` }
          : { item: transferredItem, message: `Покупка завершена за ${price.toLocaleString('ru-RU')} ₽.` };
        await client.query(
          `INSERT INTO player_events (telegram_id, idempotency_key, action_type, xp_delta, balance_delta, response)
           VALUES ($1, $2, 'market-sale', 0, $3, '{}'::jsonb)
           ON CONFLICT (telegram_id, idempotency_key) DO NOTHING`,
          [listing.seller_id, `market-sale-${action.listingId}`, price],
        );
        break;
      }
      default:
        error('Неизвестное игровое действие.');
    }

    if (missionProgressEvent) {
      player.dailyMissions = recordDailyMissionProgress(player.dailyMissions, missionProgressEvent, missionProgressAmount);
    }
    xp = addXp(Number(row.xp) || 0, xpDelta);
    row = await savePlayer(client, user.id, player, xp, freeCaseOpenedAt);
    if (seasonXpDelta > 0) {
      await awardSeasonXp(client, user.id, seasonXpDelta, action.requestId);
      if (result) result = { ...result, seasonXpEarned: seasonXpDelta };
    }
    const response: ActionResponse = { snapshot: await makeServerSnapshot(client, row, user), result };
    await client.query(
      `INSERT INTO player_events (telegram_id, idempotency_key, action_type, xp_delta, balance_delta, response)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
      [user.id, action.requestId, action.type, xpDelta, balanceDelta, JSON.stringify({ result })],
    );
    await client.query('COMMIT');
    return response;
  } catch (failure) {
    await client.query('ROLLBACK');
    throw failure;
  } finally {
    client.release();
  }
}

const leaderboardColumns: Record<LeaderboardMetric, string> = {
  xp: 'xp',
  respect: 'respect',
  collection: 'collection_value',
};

const playerCollectionValue = (state: PlayerState) =>
  state.inventory.reduce((total, item) => total + item.price, 0) +
  state.licensePlates.reduce((total, plate) => total + plate.price, 0);

const playerCollectionCount = (state: PlayerState) => state.inventory.length + state.licensePlates.length;

const displayPlayerName = (firstName: string, lastName: string | null) =>
  [firstName, lastName].filter(Boolean).join(' ') || 'Игрок';

export async function loadLeaderboard(user: AuthenticatedPlayer, metric: LeaderboardMetric): Promise<{ entries: LeaderboardEntry[]; currentPosition: number }> {
  const orderColumn = leaderboardColumns[metric];
  if (!orderColumn) throw new Error('Неизвестный тип рейтинга.');
  const client = await getPool().connect();
  try {
    await assertPlayerAllowed(client, user.id);
    const { rows } = await client.query<{
      telegram_id: string; first_name: string; last_name: string | null; username: string | null;
      xp: number; state: PlayerState; position: number;
    }>(
      `WITH player_scores AS (
         SELECT telegram_id, first_name, last_name, username, xp, state,
                ROW_NUMBER() OVER (ORDER BY ${orderColumn} DESC, telegram_id ASC) AS position
         FROM (
           SELECT telegram_id, first_name, last_name, username, xp, state,
                  COALESCE((state->>'respect')::numeric, 0) AS respect,
                  COALESCE((SELECT SUM((inventory_entry.item->>'price')::numeric)
                            FROM jsonb_array_elements(COALESCE(state->'inventory', '[]'::jsonb)) AS inventory_entry(item)), 0)
                    + COALESCE((SELECT SUM((plate_entry.item->>'price')::numeric)
                                FROM jsonb_array_elements(COALESCE(state->'licensePlates', '[]'::jsonb)) AS plate_entry(item)), 0)
                    AS collection_value
           FROM players
         ) AS scored_players
       )
       SELECT telegram_id, first_name, last_name, username, xp, state, position
       FROM player_scores
       WHERE position <= 50 OR telegram_id = $1
       ORDER BY position`,
      [user.id],
    );
    const entries = rows.map((row): LeaderboardEntry => {
      const state = normalizeDbPlayer({ telegram_id: row.telegram_id, first_name: row.first_name, last_name: row.last_name, username: row.username, xp: row.xp, state: row.state, free_case_opened_at: null });
      const xp = Number(row.xp) || 0;
      return {
        telegramId: row.telegram_id,
        displayName: displayPlayerName(row.first_name, row.last_name),
        username: row.username ?? undefined,
        avatarUrl: state.avatarUrl,
        xp,
        respect: state.respect,
        collectionValue: playerCollectionValue(state),
        collectionCount: playerCollectionCount(state),
        rankTitle: isOwnerTelegramId(row.telegram_id) ? OWNER_RANK_TITLE : rankForXp(xp),
        position: Number(row.position),
      };
    });
    const currentEntry = entries.find((entry) => entry.telegramId === user.id);
    return { entries: entries.filter((entry) => entry.position <= 50), currentPosition: currentEntry?.position ?? 0 };
  } finally {
    client.release();
  }
}

export async function loadPublicProfile(userId: string, viewerId: string): Promise<PublicPlayerProfile | undefined> {
  const client = await getPool().connect();
  try {
    await assertPlayerAllowed(client, viewerId);
    const { rows } = await client.query<PlayerRow>(
      'SELECT * FROM players WHERE telegram_id = $1',
      [userId],
    );
    const row = rows[0];
    if (!row) return undefined;
    const player = normalizeDbPlayer(row);
    const xp = Number(row.xp) || 0;
    const activeCar = player.inventory.find((item): item is CarItem => item.id === player.activeCarId && item.type === 'car');
    const { rows: rankRows } = await client.query<{ position: number }>(
      `SELECT position FROM (
         SELECT telegram_id, ROW_NUMBER() OVER (ORDER BY xp DESC, telegram_id ASC) AS position
         FROM players
       ) AS ranked_players
       WHERE telegram_id = $1`,
      [userId],
    );
    const { rows: listings } = await client.query<{
      listing_id: string; item: AuctionItem; asking_price: number; created_at: Date;
    }>(
      `SELECT listing_id, item, asking_price, created_at
       FROM market_listings
       WHERE seller_id = $1 AND status = 'active'
       ORDER BY created_at DESC LIMIT 100`,
      [userId],
    );
    return {
      telegramId: userId,
      displayName: displayPlayerName(row.first_name, row.last_name),
      username: row.username ?? undefined,
      avatarUrl: player.avatarUrl,
      xp,
      respect: player.respect,
      collectionValue: playerCollectionValue(player),
      collectionCount: playerCollectionCount(player),
      rankTitle: isOwnerTelegramId(userId) ? OWNER_RANK_TITLE : rankForXp(xp),
      rankPosition: Number(rankRows[0]?.position) || 0,
      equippedClothing: Object.values(player.equippedClothing)
        .map((itemId) => player.inventory.find((item): item is ClothingItem => item.id === itemId && item.type === 'clothing'))
        .filter((item): item is ClothingItem => item !== undefined),
      activeCar,
      licensePlates: player.licensePlates.filter((plate) => plate.id === activeCar?.licensePlateId),
      activeListings: listings.map((listing) => ({
        id: listing.listing_id,
        seller: row.username ? `@${row.username}` : displayPlayerName(row.first_name, row.last_name),
        sellerId: userId,
        sellerTitle: isOwnerTelegramId(userId) ? OWNER_RANK_TITLE : rankForXp(xp),
        sellerAvatarUrl: player.avatarUrl,
        isMine: userId === viewerId,
        item: listing.item,
        askingPrice: Number(listing.asking_price),
        listedAt: listing.created_at.toISOString(),
        isPlayerListing: true,
      })),
    };
  } finally {
    client.release();
  }
}
export async function loadPlayer(user: AuthenticatedPlayer): Promise<PlayerSnapshot> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const row = await ensurePlayer(client, user);
    await assertPlayerAllowed(client, user.id);
    await client.query('COMMIT');
    return await makeServerSnapshot(client, row, user);
  } catch (failure) {
    await client.query('ROLLBACK');
    throw failure;
  } finally {
    client.release();
  }
}

export async function loadMarket(user: AuthenticatedPlayer): Promise<MarketSnapshot> {
  const client = await getPool().connect();
  try {
    await assertPlayerAllowed(client, user.id);
    const economy = await getEconomySettings(client);
    if (!economy.marketplaceEnabled) return { listings: [], sales: [] };
    const { rows } = await client.query<{
      listing_id: string; seller_id: string; item: AuctionItem; asking_price: number;
      created_at: Date; first_name: string; last_name: string | null; username: string | null; xp: number; avatar_emoji: string | null; avatar_url: string | null;
    }>(
      `SELECT l.listing_id, l.seller_id, l.item, l.asking_price, l.created_at,
              p.first_name, p.last_name, p.username, p.xp,
              p.state->>'avatarEmoji' AS avatar_emoji, p.state->>'avatarUrl' AS avatar_url
       FROM market_listings l JOIN players p ON p.telegram_id = l.seller_id
       WHERE l.status = 'active' ORDER BY l.created_at DESC LIMIT 100`,
    );
    const playerListings: MarketListing[] = rows.map((row) => ({
      id: row.listing_id,
      seller: row.seller_id === user.id ? 'Ты' : (row.username ? `@${row.username}` : [row.first_name, row.last_name].filter(Boolean).join(' ')),
      sellerTitle: isOwnerTelegramId(row.seller_id) ? OWNER_RANK_TITLE : rankForXp(Number(row.xp)),
      sellerId: row.seller_id,
      sellerAvatarUrl: row.avatar_url ?? undefined,
      isMine: row.seller_id === user.id,
      item: row.item,
      askingPrice: Number(row.asking_price),
      listedAt: row.created_at.toISOString(),
      isPlayerListing: true,
    }));
    const { rows: salesRows } = await client.query<{
      listing_id: string;
      item_name: string;
      asking_price: number;
      sold_at: Date;
    }>(
      `SELECT listing_id, item->>'name' AS item_name, asking_price, sold_at
       FROM market_listings
       WHERE seller_id = $1 AND status = 'sold' AND sold_at > NOW() - INTERVAL '1 day'
       ORDER BY sold_at DESC LIMIT 50`,
      [user.id],
    );
    const sales: MarketSaleNotification[] = salesRows.map((sale) => ({
      listingId: sale.listing_id,
      itemName: sale.item_name,
      askingPrice: Number(sale.asking_price),
      soldAt: sale.sold_at.toISOString(),
    }));
    return {
      listings: playerListings.sort((first, second) => second.listedAt.localeCompare(first.listedAt)),
      sales,
    };
  } finally {
    client.release();
  }
}
