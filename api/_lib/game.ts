import { CONTAINERS, pickDrop } from '../../src/data/items.js';
import { MARKET_SEED } from '../../src/data/market.js';
import { withEquippedStats, STARTING_PLAYER } from '../../src/game/player.js';
import {
  createLicensePlateItem,
  createRandomLicensePlate,
  isValidRussianLicensePlate,
  LICENSE_PLATE_SPIN_PRICE,
} from '../../src/game/licensePlates.js';
import { getResaleValue, LEGIT_CHECK_PRICE, ORIGINAL_PRICE_MULTIPLIER, BAD_LEGIT_PRICE_MULTIPLIER, DETAILING_PRICE_MULTIPLIER, MILEAGE_SUCCESS_PRICE_MULTIPLIER, MILEAGE_FAILURE_PRICE_MULTIPLIER } from '../../src/game/economy.js';
import { normalizePlayerState } from '../../src/persistence/playerStorage.js';
import type { CarItem, ClothingItem, InventoryItem, PlayerState } from '../../src/types/game.js';
import type { ActionResponse, AuthenticatedPlayer, GameAction, LeaderboardEntry, LeaderboardMetric, MarketListing, PlayerSnapshot, PublicPlayerProfile } from '../../src/types/server.js';
import { createId } from '../../src/utils/id.js';
import { OWNER_RANK_TITLE, rankForXp } from '../../src/game/ranks.js';
import { isOwnerTelegramId } from './auth.js';
import { getPool } from './db.js';

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
       last_name = EXCLUDED.last_name, username = EXCLUDED.username, updated_at = NOW()`,
    [user.id, user.firstName, user.lastName ?? null, user.username ?? null, JSON.stringify(STARTING_PLAYER)],
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

const ensureRequestId = (action: GameAction) => {
  if (!('requestId' in action) || typeof action.requestId !== 'string' || action.requestId.length < 8 || action.requestId.length > 100) {
    error('Не удалось подтвердить запрос. Повтори действие.', 400);
  }
};

const equipped = (player: PlayerState, itemId: string) =>
  player.activeCarId === itemId || Object.values(player.equippedClothing).includes(itemId);

const makeDropItem = (containerId: string, drop: ReturnType<typeof pickDrop>): InventoryItem => {
  const container = CONTAINERS.find((entry) => entry.id === containerId)!;
  const wear = Math.round((Math.random() * 80 + 20) * 100) / 100;
  const itemPrice = Math.round(drop.basePrice * (0.55 + (wear / 100) * 0.45));
  const base = {
    id: createId('item'), name: drop.name, type: container.category, rarity: drop.rarity,
    icon: drop.icon, image: drop.image, price: itemPrice, basePrice: drop.basePrice,
    respect: drop.respect, serial: `#${String(Math.floor(Math.random() * 500) + 1).padStart(3, '0')}/500`,
    wear, createdAt: new Date().toISOString(), containerId,
  };
  if (container.category === 'clothing') {
    return { ...base, type: 'clothing', slot: drop.slot ?? 'accessory', authenticity: 'unverified' } as ClothingItem;
  }
  return { ...base, type: 'car', slot: 'car', mileage: Math.floor(Math.random() * (380_000 - 15_000 + 1)) + 15_000 } as CarItem;
};

const addXp = (xp: number, delta: number) => xp + delta;

const buyBotListing = async (client: import('pg').PoolClient, player: PlayerState, xp: number, userId: string, listingId: string) => {
  const listing = MARKET_SEED.find((entry) => entry.id === listingId);
  if (!listing) error('Лот не найден. Обнови рынок.');
  if (player.closedMarketListingIds.includes(listingId)) error('Этот лот уже недоступен.');
  if (player.balance < listing.askingPrice) error(`Не хватает ${listing.askingPrice - player.balance} ₽ для покупки.`);
  let item: InventoryItem = { ...listing.item, id: createId('market-item'), createdAt: new Date().toISOString() };
  let licensePlates = player.licensePlates;
  if (item.type === 'car' && item.licensePlate && isValidRussianLicensePlate(item.licensePlate)) {
    const plate = createLicensePlateItem(item.licensePlate);
    licensePlates = [...licensePlates, plate];
    item = { ...item, licensePlate: undefined, licensePlateId: plate.id };
  }
  player = {
    ...player, balance: player.balance - listing.askingPrice,
    inventory: [...player.inventory, item], licensePlates,
    closedMarketListingIds: [...player.closedMarketListingIds, listingId],
  };
  xp = addXp(xp, 5);
  return { player, xp, result: { item, message: 'Лот куплен и добавлен в инвентарь.' } };
};

export async function performAction(user: AuthenticatedPlayer, action: GameAction): Promise<ActionResponse> {
  ensureRequestId(action);
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    if (['list-item', 'cancel-listing', 'buy-listing'].includes(action.type)) {
      await client.query('SELECT pg_advisory_xact_lock(731004812)');
    }
    let row = await ensurePlayer(client, user);
    const duplicate = await client.query<{ response: { result?: ActionResponse['result'] } }>(
      'SELECT response FROM player_events WHERE telegram_id = $1 AND idempotency_key = $2',
      [user.id, action.requestId],
    );
    if (duplicate.rowCount) {
      await client.query('COMMIT');
      return { snapshot: makeSnapshot(row, user), result: duplicate.rows[0].response?.result };
    }
    let player = normalizeDbPlayer(row);
    let xp = Number(row.xp) || 0;
    let freeCaseOpenedAt: Date | undefined;
    let result: ActionResponse['result'];
    let xpDelta = 0;
    let balanceDelta = 0;

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
        const container = CONTAINERS.find((entry) => entry.id === action.containerId);
        if (!container) error('Контейнер не найден. Обнови игру.');
        if (action.free) {
          if (container.id !== 'second-hand-bale') error('Бесплатно доступен только ежедневный контейнер.');
          const lastOpenedAt = row.free_case_opened_at ? new Date(row.free_case_opened_at).getTime() : 0;
          if (Date.now() - lastOpenedAt < 24 * 60 * 60 * 1000) error('Бесплатный контейнер можно открыть раз в 24 часа.', 429);
          freeCaseOpenedAt = new Date();
        } else {
          if (player.balance < container.price) error(`Не хватает ${container.price - player.balance} ₽.`);
          player.balance -= container.price;
          balanceDelta = -container.price;
        }
        const item = makeDropItem(container.id, pickDrop(container));
        player.inventory = [...player.inventory, item];
        xpDelta = 10;
        result = { item, message: 'Приз сохранён в инвентаре.' };
        break;
      }
      case 'sell-item': {
        const item = player.inventory.find((entry) => entry.id === action.itemId);
        if (!item) error('Предмет не найден в инвентаре.');
        if (equipped(player, item.id)) error('Сначала сними предмет или убери машину из профиля.');
        player.inventory = player.inventory.filter((entry) => entry.id !== item.id);
        player.balance += getResaleValue(item);
        balanceDelta = getResaleValue(item);
        result = { message: `Предмет продан за ${balanceDelta} ₽.` };
        break;
      }
      case 'spin-license-plate': {
        if (player.balance < LICENSE_PLATE_SPIN_PRICE) error(`Не хватает ${LICENSE_PLATE_SPIN_PRICE - player.balance} ₽.`);
        const plate = createRandomLicensePlate();
        const item = createLicensePlateItem(plate);
        player.balance -= LICENSE_PLATE_SPIN_PRICE;
        balanceDelta = -LICENSE_PLATE_SPIN_PRICE;
        player.licensePlates = [...player.licensePlates, item];
        xpDelta = 5;
        result = { plate, message: 'Номер добавлен в коллекцию.' };
        break;
      }
      case 'sell-license-plate': {
        const plate = player.licensePlates.find((entry) => entry.id === action.plateId);
        if (!plate) error('Номер не найден в коллекции.');
        if (player.inventory.some((entry) => entry.type === 'car' && entry.licensePlateId === plate.id)) error('Сначала сними номер с машины.');
        player.licensePlates = player.licensePlates.filter((entry) => entry.id !== plate.id);
        player.balance += getResaleValue(plate);
        balanceDelta = getResaleValue(plate);
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
          if (player.balance < LEGIT_CHECK_PRICE) error(`Не хватает ${LEGIT_CHECK_PRICE - player.balance} ₽.`);
          player.balance -= LEGIT_CHECK_PRICE;
          balanceDelta = -LEGIT_CHECK_PRICE;
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
      case 'cancel-listing': {
        const listing = await client.query<{ item: InventoryItem }>(
          `UPDATE market_listings SET status = 'cancelled' WHERE listing_id = $1 AND seller_id = $2 AND status = 'active' RETURNING item`,
          [action.listingId, user.id],
        );
        if (!listing.rowCount) error('Активный лот не найден.');
        player.inventory = [...player.inventory, listing.rows[0].item];
        break;
      }
      case 'buy-listing': {
        const listingResult = await client.query<{ seller_id: string; item: InventoryItem; asking_price: number }>(
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
        const transferredItem = { ...listing.item, id: createId('market-item'), createdAt: new Date().toISOString() };
        buyer.balance -= price;
        buyer.inventory = [...buyer.inventory, transferredItem];
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
        result = { item: transferredItem, message: `Покупка завершена за ${price} ₽.` };
        await client.query(
          `INSERT INTO player_events (telegram_id, idempotency_key, action_type, xp_delta, balance_delta, response)
           VALUES ($1, $2, 'market-sale', 0, $3, '{}'::jsonb)
           ON CONFLICT (telegram_id, idempotency_key) DO NOTHING`,
          [listing.seller_id, `market-sale-${action.listingId}`, price],
        );
        break;
      }
      case 'buy-bot-listing': {
        const purchased = await buyBotListing(client, player, xp, user.id, action.listingId);
        Object.assign(player, purchased.player);
        xp = purchased.xp;
        xpDelta = 5;
        balanceDelta = -MARKET_SEED.find((entry) => entry.id === action.listingId)!.askingPrice;
        result = purchased.result;
        break;
      }
      default:
        error('Неизвестное игровое действие.');
    }

    xp = addXp(Number(row.xp) || 0, xpDelta);
    row = await savePlayer(client, user.id, player, xp, freeCaseOpenedAt);
    const response: ActionResponse = { snapshot: makeSnapshot(row, user), result };
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
        avatarEmoji: state.avatarEmoji,
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
      listing_id: string; item: InventoryItem; asking_price: number; created_at: Date;
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
      avatarEmoji: player.avatarEmoji,
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
        sellerAvatar: player.avatarEmoji,
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
    await client.query('COMMIT');
    return makeSnapshot(row, user);
  } catch (failure) {
    await client.query('ROLLBACK');
    throw failure;
  } finally {
    client.release();
  }
}

export async function loadMarket(user: AuthenticatedPlayer): Promise<MarketListing[]> {
  const client = await getPool().connect();
  try {
    const { rows } = await client.query<{
      listing_id: string; seller_id: string; item: InventoryItem; asking_price: number;
      created_at: Date; first_name: string; last_name: string | null; username: string | null; xp: number; avatar_emoji: string | null;
    }>(
      `SELECT l.listing_id, l.seller_id, l.item, l.asking_price, l.created_at,
              p.first_name, p.last_name, p.username, p.xp, p.state->>'avatarEmoji' AS avatar_emoji
       FROM market_listings l JOIN players p ON p.telegram_id = l.seller_id
       WHERE l.status = 'active' ORDER BY l.created_at DESC LIMIT 100`,
    );
    const playerListings: MarketListing[] = rows.map((row) => ({
      id: row.listing_id,
      seller: row.seller_id === user.id ? 'Ты' : (row.username ? `@${row.username}` : [row.first_name, row.last_name].filter(Boolean).join(' ')),
      sellerTitle: isOwnerTelegramId(row.seller_id) ? OWNER_RANK_TITLE : rankForXp(Number(row.xp)),
      sellerId: row.seller_id,
      sellerAvatar: row.avatar_emoji ?? '😎',
      isMine: row.seller_id === user.id,
      item: row.item,
      askingPrice: Number(row.asking_price),
      listedAt: row.created_at.toISOString(),
      isPlayerListing: true,
    }));
    const { rows: playerRows } = await client.query<PlayerRow>('SELECT * FROM players WHERE telegram_id = $1', [user.id]);
    const state = playerRows[0] ? normalizeDbPlayer(playerRows[0]) : STARTING_PLAYER;
    const botListings = MARKET_SEED.filter((listing) => !state.closedMarketListingIds.includes(listing.id));
    return [...playerListings, ...botListings].sort((first, second) => second.listedAt.localeCompare(first.listedAt));
  } finally {
    client.release();
  }
}
