import { timingSafeEqual } from 'node:crypto';
import sharp from 'sharp';
import type { Container, ContainerDrop, ContainerType, Rarity } from '../src/types/game.js';
import { RARITY_LABELS } from '../src/data/items.js';
import { deleteContainer, ensureContainerCatalog, listContainerCatalog, moveContainer, saveContainer } from './_lib/containers.js';
import { getPool } from './_lib/db.js';
import { bodyRecord, sendError, type ApiRequest, type ApiResponse } from './_lib/http.js';
import { isRepeatedCreateSourceChoice, transitionAdminSessionStep } from './_lib/adminSession.js';
import { OWNER_TELEGRAM_ID } from './_lib/auth.js';
import { createId } from '../src/utils/id.js';
import { getCatalogPage } from './_lib/catalogPagination.js';
import { processCatalogImage, processCatalogSpriteSheet } from './_lib/image-processing.js';
import {
  deleteCatalogItem,
  getCatalogItem,
  listCatalogItems,
  saveCatalogItem,
  type CatalogItem,
} from './_lib/catalogItems.js';
import {
  adjustAdminPlayer,
  countAnnouncementRecipients,
  ensureAdminTables,
  formatAdminActivity,
  formatAdminActivityLabel,
  getAdminPlayer,
  getEconomySettings,
  listAdminActivity,
  listAdminListings,
  listAnnouncementRecipients,
  loadAdminAnalytics,
  moderateListing,
  searchAdminPlayers,
  resetPlayerContainerCooldowns,
  setPlayerBanned,
  updateEconomySetting,
} from './_lib/admin.js';
import { applySuccessfulStarsPayment, ensureSeasonTables, listSeasonContainers, updateSeasonSettings, validatePreCheckout, type PreCheckoutQuery, type StarsPayment } from './_lib/season.js';

interface TelegramChat {
  id: number;
}

interface TelegramMessage {
  message_id: number;
  chat: TelegramChat;
  from?: { id: number };
  text?: string;
  photo?: Array<{ file_id: string; width: number; height: number; file_size?: number }>;
  document?: { file_id: string; file_size?: number; mime_type?: string; file_name?: string };
  successful_payment?: StarsPayment;
}

interface TelegramCallback {
  id: string;
  from: { id: number };
  data?: string;
  message?: TelegramMessage;
}

interface TelegramUpdate {
  message?: TelegramMessage;
  callback_query?: TelegramCallback;
  pre_checkout_query?: PreCheckoutQuery;
}

interface AdminDraft {
  id?: string;
  title?: string;
  type?: ContainerType;
  tier?: number;
  price?: number;
  description?: string;
  icon?: string;
  image?: string;
  cooldownSeconds?: number;
}

interface AdminSession {
  mode:
    | 'create' | 'edit-title' | 'edit-tier' | 'edit-price' | 'edit-cooldown'
    | 'container-photo'
    | 'item-create' | 'item-edit' | 'item-photo' | 'item-attach'
    | 'item-field' | 'container-drop-select'
    | 'player-search' | 'player-adjust' | 'economy-adjust' | 'season-config'
    | 'announcement-draft' | 'announcement-confirm' | 'announcement-send';
  step?: string;
  containerId?: string;
  draft?: AdminDraft;
  catalogItem?: CatalogItem;
  draftItems?: CatalogItem[];
  itemSource?: 'grid' | 'single';
  itemCount?: number;
  itemNumbers?: number[];
  dropIndex?: number;
  targetId?: string;
  field?: 'balance' | 'xp' | 'resaleMultiplier' | 'name' | 'price';
  direction?: 1 | -1;
  announcement?: string;
  offset?: number;
  delivered?: number;
  failed?: number;
}

interface TelegramApiResponse {
  ok: boolean;
  description?: string;
  error_code?: number;
  result?: unknown;
}

const containerTypes: ContainerType[] = ['clothing', 'car', 'plates'];
const AUTO_DROP_WEIGHTS: Record<Rarity, number> = {
  common: 60,
  uncommon: 30,
  rare: 15,
  epic: 6,
  legendary: 2,
  mythic: 1,
};
const rarityRespectMultiplier: Record<Rarity, number> = {
  common: 1,
  uncommon: 2,
  rare: 3,
  epic: 4,
  legendary: 5,
  mythic: 6,
};
const calculateRespect = (price: number, rarity: Rarity) =>
  Math.max(1, Math.round((price / 1_000) * rarityRespectMultiplier[rarity]));

function formatCooldownSeconds(seconds: number): string {
  if (seconds <= 0) return '♾ Без таймера';
  if (seconds === 86_400) return '📅 Ежедневный · 24 часа';
  const totalMinutes = Math.ceil(seconds / 60);
  const days = Math.floor(totalMinutes / 1_440);
  const hours = Math.floor((totalMinutes % 1_440) / 60);
  const minutes = totalMinutes % 60;
  return `⏱ Свой таймер · ${days ? `${days}д ` : ''}${hours ? `${hours}ч ` : ''}${minutes ? `${minutes}м` : ''}`.trim();
}

function parseCooldown(text: string): number {
  const value = text.trim().toLowerCase().replace(',', '.');
  let seconds: number;
  if (/^\d+(?:\.\d+)?$/.test(value)) {
    seconds = Number(value) * 3_600;
  } else {
    const match = value.match(/^(?:(\d+(?:\.\d+)?)\s*(?:ч|час(?:а|ов)?|h|hours?)\s*)?(?:(\d+)\s*(?:м|мин(?:ут(?:а|ы)?)?|m|min|minutes?)\s*)?$/);
    if (!match || (!match[1] && !match[2])) throw new Error('Введи часы (например, 12) или время в формате «1ч 30м».');
    seconds = Number(match[1] ?? 0) * 3_600 + Number(match[2] ?? 0) * 60;
  }
  if (!Number.isSafeInteger(Math.round(seconds)) || seconds < 60 || seconds > 31_536_000) {
    throw new Error('Таймер должен быть не меньше 1 минуты и не больше 365 дней.');
  }
  return Math.round(seconds);
}
const token = () => process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN;
const adminTelegramId = () => process.env.ADMIN_TELEGRAM_ID || process.env.OWNER_TELEGRAM_ID || OWNER_TELEGRAM_ID;

function requireTelegramSecret(request: ApiRequest): void {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const receivedHeader = request.headers['x-telegram-bot-api-secret-token'];
  const received = Array.isArray(receivedHeader) ? receivedHeader[0] : receivedHeader;
  if (!secret || typeof received !== 'string') throw Object.assign(new Error('Webhook secret is not configured.'), { statusCode: 503 });
  const expectedBuffer = Buffer.from(secret);
  const receivedBuffer = Buffer.from(received);
  if (expectedBuffer.length !== receivedBuffer.length || !timingSafeEqual(expectedBuffer, receivedBuffer)) {
    throw Object.assign(new Error('Unauthorized webhook.'), { statusCode: 401 });
  }
}

async function telegram(method: string, payload: Record<string, unknown>): Promise<void> {
  await telegramResult(method, payload);
}

async function telegramResult<T>(method: string, payload: Record<string, unknown>): Promise<T> {
  const botToken = token();
  if (!botToken) throw new Error('TELEGRAM_BOT_TOKEN or BOT_TOKEN is not configured.');
  const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const result = await response.json() as TelegramApiResponse;
  if (!response.ok || !result.ok) {
    throw Object.assign(
      new Error(`Telegram ${method} failed: ${result.description ?? response.statusText}`),
      { telegramErrorCode: result.error_code },
    );
  }
  return result.result as T;
}

async function downloadTelegramImage(message: TelegramMessage): Promise<Buffer> {
  const botToken = token();
  if (!botToken) throw new Error('TELEGRAM_BOT_TOKEN or BOT_TOKEN is not configured.');
  const photo = message.photo?.reduce((largest, current) =>
    current.width * current.height > largest.width * largest.height ? current : largest);
  const document = message.document;
  if (!photo && !document) throw new Error('Отправь фото или файл изображения JPEG, PNG либо WebP.');
  if (document && !['image/jpeg', 'image/png', 'image/webp'].includes(document.mime_type ?? '')) {
    throw new Error('Поддерживаются файлы JPEG, PNG и WebP.');
  }
  const fileSize = photo?.file_size ?? document?.file_size;
  if (fileSize && fileSize > 10 * 1024 * 1024) {
    throw new Error('Изображение слишком большое. Максимальный размер — 10 МБ.');
  }
  const fileId = photo?.file_id ?? document?.file_id;
  if (!fileId) throw new Error('Не удалось прочитать изображение Telegram.');
  const file = await telegramResult<{ file_path?: string }>('getFile', { file_id: fileId });
  if (!file.file_path) throw new Error('Telegram не вернул путь к изображению. Попробуй отправить его ещё раз.');
  const response = await fetch(`https://api.telegram.org/file/bot${botToken}/${file.file_path}`);
  if (!response.ok) throw new Error(`Не удалось скачать изображение из Telegram (${response.status}).`);
  const source = Buffer.from(await response.arrayBuffer());
  if (!source.length || source.length > 10 * 1024 * 1024) throw new Error('Размер изображения должен быть не больше 10 МБ.');
  return source;
}

async function storeProcessedImage(image: Buffer): Promise<string> {
  if (image.length > 2 * 1024 * 1024) throw new Error('Обработанное изображение превышает 2 МБ. Загрузи картинку попроще.');
  await getPool().query(`
    CREATE TABLE IF NOT EXISTS game_assets (
      id TEXT PRIMARY KEY,
      content_type TEXT NOT NULL,
      image_data BYTEA NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  const assetId = createId('asset');
  await getPool().query(
    `INSERT INTO game_assets (id, content_type, image_data)
     VALUES ($1, 'image/webp', $2)`,
    [assetId, image],
  );
  return `/api/assets/${assetId}`;
}

async function storeTelegramImage(message: TelegramMessage): Promise<string> {
  return storeProcessedImage(await processCatalogImage(await downloadTelegramImage(message)));
}

async function storeTelegramSpriteSheet(message: TelegramMessage, itemCount: number): Promise<string[]> {
  const cells = await processCatalogSpriteSheet(await downloadTelegramImage(message), itemCount);
  return Promise.all(cells.map((cell) => storeProcessedImage(cell)));
}

async function sendCatalogPreview(client: import('pg').PoolClient, chatId: number, imagePath: string, caption: string): Promise<void> {
  const assetId = /^\/api\/assets\/([a-zA-Z0-9_-]{8,100})$/.exec(imagePath)?.[1];
  if (!assetId) throw new Error('Не удалось открыть обработанную иконку.');
  const { rows } = await client.query<{ image_data: Buffer }>('SELECT image_data FROM game_assets WHERE id = $1', [assetId]);
  if (!rows[0]) throw new Error('Обработанная иконка не найдена.');
  const png = await sharp(rows[0].image_data).png().toBuffer();
  const botToken = token();
  if (!botToken) throw new Error('TELEGRAM_BOT_TOKEN or BOT_TOKEN is not configured.');
  const form = new FormData();
  form.append('chat_id', String(chatId));
  form.append('photo', new Blob([Uint8Array.from(png)], { type: 'image/png' }), 'lootland-item.png');
  form.append('caption', caption.slice(0, 1_024));
  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, { method: 'POST', body: form });
  const result = await response.json() as TelegramApiResponse;
  if (!response.ok || !result.ok) throw new Error(`Telegram sendPhoto failed: ${result.description ?? response.statusText}`);
}

const inlineKeyboard = (rows: Array<Array<{ text: string; callback_data: string }>>) => ({ inline_keyboard: rows });

async function sendMessage(chatId: number, text: string, rows?: Array<Array<{ text: string; callback_data: string }>>) {
  await telegram('sendMessage', {
    chat_id: chatId,
    text,
    ...(rows ? { reply_markup: inlineKeyboard(rows) } : {}),
  });
}

async function editMessage(message: TelegramMessage, text: string, rows?: Array<Array<{ text: string; callback_data: string }>>) {
  try {
    await telegram('editMessageText', {
      chat_id: message.chat.id,
      message_id: message.message_id,
      text,
      ...(rows ? { reply_markup: inlineKeyboard(rows) } : {}),
    });
  } catch (failure) {
    if (!(failure instanceof Error) || !/message is not modified/i.test(failure.message)) {
      const cannotEdit = failure instanceof Error
        && /message to edit not found|message can't be edited|message can not be edited/i.test(failure.message);
      if (!cannotEdit) throw failure;
      await sendMessage(message.chat.id, text, rows);
    }
  }
}

async function answerCallback(id: string, text?: string) {
  await telegram('answerCallbackQuery', { callback_query_id: id, ...(text ? { text } : {}) });
}

async function getSession(client: import('pg').PoolClient, id: string): Promise<AdminSession | undefined> {
  const { rows } = await client.query<{ state: AdminSession }>(
    'SELECT state FROM telegram_admin_sessions WHERE telegram_id = $1',
    [id],
  );
  return rows[0]?.state;
}

async function setSession(client: import('pg').PoolClient, id: string, state: AdminSession): Promise<void> {
  await client.query(
    `INSERT INTO telegram_admin_sessions (telegram_id, state) VALUES ($1, $2::jsonb)
     ON CONFLICT (telegram_id) DO UPDATE SET state = EXCLUDED.state, updated_at = NOW()`,
    [id, JSON.stringify(state)],
  );
}

async function clearSession(client: import('pg').PoolClient, id: string): Promise<void> {
  await client.query('DELETE FROM telegram_admin_sessions WHERE telegram_id = $1', [id]);
}

const typeLabel = (type: ContainerType) => type === 'clothing' ? 'Одежда' : type === 'car' ? 'Машины' : 'Номера';
const containerLabel = (container: Container) =>
  `${container.order}. ${container.icon} ${container.name}\n   ${typeLabel(container.category)} · тир ${container.tier} · ${container.price.toLocaleString('ru-RU')} ₽ · дропов: ${container.contents.length}`;

const CONTAINERS_PER_PAGE = 15;

function containerMenu(containers: Container[], page: number) {
  const rows: Array<Array<{ text: string; callback_data: string }>> = [];
  for (const container of containers.slice(page * CONTAINERS_PER_PAGE, (page + 1) * CONTAINERS_PER_PAGE)) {
    rows.push([
      { text: `⬆️ ${container.order}`, callback_data: `ct:up:${container.id}` },
      { text: `⬇️ ${container.order}`, callback_data: `ct:down:${container.id}` },
      { text: `✏️ ${container.name.slice(0, 16)}`, callback_data: `ct:edit:${container.id}` },
      { text: '🗑️', callback_data: `ct:delete:${container.id}` },
    ]);
  }
  const pageCount = Math.ceil(containers.length / CONTAINERS_PER_PAGE);
  if (pageCount > 1) {
    rows.push([
      ...(page > 0 ? [{ text: '⬅️ Назад', callback_data: `ct:list:${page - 1}` }] : []),
      ...(page + 1 < pageCount ? [{ text: 'Вперёд ➡️', callback_data: `ct:list:${page + 1}` }] : []),
    ]);
  }
  rows.push([{ text: '➕ Создать контейнер', callback_data: 'ct:create' }]);
  return rows;
}

async function showContainerMenu(client: import('pg').PoolClient, chatId: number, edit?: TelegramMessage, page = 0) {
  const containers = await listContainerCatalog(client);
  const text = containers.length
    ? `📦 Контейнеры · каталог поставок\nВсего: ${containers.length} · страница ${page + 1}\nНажми кнопку контейнера для редактирования; стрелками меняется порядок.\n\n${containers.slice(page * CONTAINERS_PER_PAGE, (page + 1) * CONTAINERS_PER_PAGE).map(containerLabel).join('\n\n')}`
    : '📦 Контейнеры · каталог пуст. Создай первую поставку.';
  const rows = containerMenu(containers, page);
  rows.push([{ text: '🏠 Главное меню', callback_data: 'adm:home' }]);
  if (edit) await editMessage(edit, text, rows);
  else await sendMessage(chatId, text, rows);
}

async function beginCreate(client: import('pg').PoolClient, userId: string, chatId: number) {
  await setSession(client, userId, { mode: 'create', step: 'image', draft: { tier: 1 } });
  await sendMessage(chatId, '📦 Создание контейнера · шаг 1 из 5\nОтправь обложку контейнера фото или PNG/JPEG/WebP-файлом. Фон обработается автоматически.', cancelKeyboard());
}

function containerRarityKeyboard(allowSkip: boolean) {
  const rarities: Array<[Rarity, string]> = [
    ['common', '⚪ Обычный'],
    ['uncommon', '🟢 Необычный'],
    ['rare', '🔵 Редкий'],
    ['epic', '🟣 Эпический'],
    ['legendary', '🟡 Легендарный'],
    ['mythic', '🔴 Мифический'],
  ];
  return [
    ...rarities.map(([rarity, label]) => [{ text: label, callback_data: `ct:drop-rarity:${rarity}` }]),
    ...cancelKeyboard(),
    ...(allowSkip ? [[{ text: '⏭ Пропустить ячейку', callback_data: 'ct:skip-cell' }]] : []),
  ];
}

function createItemSourceKeyboard() {
  return [
    [
      { text: '🧩 Спрайт-лист · 5 в ряд', callback_data: 'ct:create-source:grid' },
      { text: '📷 По 1 картинке', callback_data: 'ct:create-source:single' },
    ],
    ...cancelKeyboard(),
  ];
}

function createDropItem(item: CatalogItem): ContainerDrop {
  return {
    catalogItemId: item.id,
    name: item.name,
    icon: item.icon,
    image: item.image,
    rarity: item.rarity,
    basePrice: item.basePrice,
    respect: item.respect,
    ...(item.type === 'clothing' ? { slot: item.slot as ContainerDrop['slot'] } : {}),
    weight: AUTO_DROP_WEIGHTS[item.rarity],
  };
}

async function finishContainerCreation(
  client: import('pg').PoolClient,
  chatId: number,
  userId: string,
  session: AdminSession,
): Promise<void> {
  const draft = session.draft;
  if (!draft?.id || !draft.title || !draft.type || draft.price === undefined || !draft.image) {
    throw new Error('Данные контейнера потеряны. Начни создание заново.');
  }
  const items = session.draftItems ?? [];
  if (draft.type !== 'plates' && !items.length) throw new Error('Добавь хотя бы один предмет перед сохранением контейнера.');
  const drops: ContainerDrop[] = draft.type === 'plates'
    ? [{ name: 'Госномер', icon: '🔢', image: draft.image, rarity: 'common', basePrice: 5_000, respect: 0, weight: AUTO_DROP_WEIGHTS.common }]
    : items.map(createDropItem);

  await client.query('BEGIN');
  try {
    for (const item of items) await saveCatalogItem(client, item);
    const containers = await listContainerCatalog(client);
    const sortOrder = Math.max(0, ...containers.map((container) => container.order)) + 1;
    await saveContainer(client, {
      id: draft.id,
      title: draft.title,
      type: draft.type,
      tier: draft.tier ?? 1,
      price: draft.price,
      sortOrder,
      description: '',
      icon: draft.icon ?? '📦',
      image: draft.image,
      drops,
      cooldownSeconds: draft.cooldownSeconds ?? 0,
    });
    await client.query('COMMIT');
  } catch (failure) {
    await client.query('ROLLBACK');
    throw failure;
  }
  await clearSession(client, userId);
  const savedContents = draft.type === 'plates' ? 'госномера будут создаваться автоматически' : `${items.length} предметов`;
  await sendMessage(chatId, `✅ Контейнер «${draft.title}» и ${savedContents} сохранены в каталоге игры.`);
  await showContainerMenu(client, chatId);
}

async function promptDraftCatalogItem(
  client: import('pg').PoolClient,
  chatId: number,
  session: AdminSession,
  index: number,
): Promise<void> {
  const item = session.draftItems?.[index];
  if (!item) throw new Error('Текущий предмет не найден в мастере.');
  const itemNumber = session.itemNumbers?.[index] ?? index + 1;
  session.dropIndex = index;
  session.step = 'item-name';
  await setSession(client, String(chatId), session);
  await sendCatalogPreview(client, chatId, item.image, `Предмет №${itemNumber}${session.itemSource === 'grid' ? ` из ${session.itemCount}` : ''}`);
  await sendMessage(chatId, `Предмет №${itemNumber}${session.itemSource === 'grid' ? ` из ${session.itemCount}` : ''}: введи название предмета.`, [
    ...cancelKeyboard(),
    ...(session.itemSource === 'grid' ? [[{ text: '⏭ Пропустить ячейку', callback_data: 'ct:skip-cell' }]] : []),
  ]);
}

async function continueAfterDraftItem(
  client: import('pg').PoolClient,
  chatId: number,
  userId: string,
  session: AdminSession,
): Promise<void> {
  if (session.itemSource === 'grid') {
    const nextIndex = (session.dropIndex ?? 0) + 1;
    if (nextIndex < (session.draftItems?.length ?? 0)) {
      await promptDraftCatalogItem(client, chatId, session, nextIndex);
      return;
    }
    await finishContainerCreation(client, chatId, userId, session);
    return;
  }
  session.step = 'next-single';
  await setSession(client, userId, session);
  await sendMessage(chatId, '✅ Предмет добавлен. Можно загрузить следующий или сохранить контейнер.', [
    [{ text: '➕ Следующий предмет', callback_data: 'ct:create-next-item' }],
    [{ text: '✅ Завершить и сохранить', callback_data: 'ct:finish-create' }],
    ...cancelKeyboard(),
  ]);
}

async function processCreateMessage(
  client: import('pg').PoolClient,
  chatId: number,
  userId: string,
  session: AdminSession,
  text: string,
): Promise<void> {
  const draft = { ...session.draft };
  switch (session.step) {
    case 'title': {
      const title = text.trim();
      if (!title || title.length > 100) throw new Error('Название контейнера должно содержать до 100 символов.');
      draft.title = title;
      draft.id = `custom-${createId('container').replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 16)}`;
      session.draft = draft;
      session.step = 'type';
      await setSession(client, userId, session);
      await sendMessage(chatId, 'Шаг 2 · выбери тип контейнера:', [
        [
          { text: '👕 Одежда', callback_data: 'ct:type:clothing' },
          { text: '🚗 Машины', callback_data: 'ct:type:car' },
          { text: '🔢 Госномера', callback_data: 'ct:type:plates' },
        ],
        ...cancelKeyboard(),
      ]);
      return;
    }
    case 'custom-cooldown': {
      draft.cooldownSeconds = parseCooldown(text);
      session.draft = draft;
      session.step = 'price';
      await setSession(client, userId, session);
      await sendMessage(chatId, 'Шаг 4 · введи цену открытия в ₽. Для бесплатного открытия укажи 0:', cancelKeyboard());
      return;
    }
    case 'price': {
      const price = Number(text.trim());
      if (!Number.isSafeInteger(price) || price < 0 || price > 2_000_000_000) {
        throw new Error('Цена должна быть целым числом от 0 до 2 000 000 000 ₽.');
      }
      draft.price = price;
      session.draft = draft;
      if (draft.type === 'plates') {
        await finishContainerCreation(client, chatId, userId, session);
        return;
      }
      session.step = 'item-source';
      await setSession(client, userId, session);
      await sendMessage(chatId, 'Шаг 5 · как добавить предметы? Для сетки укажи общее количество, максимум 100.', createItemSourceKeyboard());
      return;
    }
    case 'grid-count': {
      const count = Number(text.trim());
      if (!Number.isSafeInteger(count) || count < 1 || count > 100) throw new Error('Укажи целое количество от 1 до 100.');
      session.itemCount = count;
      session.step = 'grid-image';
      await setSession(client, userId, session);
      await sendMessage(chatId, `Отправь сетку из ${count} предметов. Нарезка идёт слева направо, по 5 ячеек в строке, затем сверху вниз.`, cancelKeyboard());
      return;
    }
    case 'item-name': {
      const name = text.trim();
      if (!name || name.length > 100) throw new Error('Название предмета должно содержать до 100 символов.');
      const index = session.dropIndex ?? 0;
      const items = [...(session.draftItems ?? [])];
      if (!items[index]) throw new Error('Черновик предмета потерян.');
      items[index] = { ...items[index], name };
      session.draftItems = items;
      session.step = 'item-rarity';
      await setSession(client, userId, session);
      await sendMessage(chatId, 'Выбери редкость кнопкой. Вес выпадения установится автоматически:', containerRarityKeyboard(session.itemSource === 'grid'));
      return;
    }
    case 'item-price': {
      const parts = text.trim().split(/\s+/);
      if (parts.length < 1 || parts.length > 2) throw new Error('Введи цену и, при желании, Респект через пробел, например: 1500 5.');
      const basePrice = Number(parts[0]);
      if (!Number.isSafeInteger(basePrice) || basePrice < 1 || basePrice > 2_000_000_000) {
        throw new Error('Базовая цена должна быть целым числом от 1 до 2 000 000 000 ₽.');
      }
      const index = session.dropIndex ?? 0;
      const items = [...(session.draftItems ?? [])];
      const item = items[index];
      if (!item) throw new Error('Черновик предмета потерян.');
      const respect = parts[1] === undefined ? calculateRespect(basePrice, item.rarity) : Number(parts[1]);
      if (!Number.isSafeInteger(respect) || respect < 0 || respect > 10_000_000) {
        throw new Error('Респект должен быть целым числом от 0 до 10 000 000.');
      }
      items[index] = { ...item, basePrice, respect };
      session.draftItems = items;
      await continueAfterDraftItem(client, chatId, userId, session);
      return;
    }
    case 'image':
    case 'grid-image':
    case 'item-photo':
      throw new Error('На этом шаге отправь фото или PNG/JPEG/WebP-файл как вложение Telegram.');
    default:
      throw new Error('Шаг диалога не распознан. Начни заново командой /admin.');
  }
}

function rarityKeyboard(prefix: string, selected?: string) {
  const rarities = [
    ['common', '⚪ Common'],
    ['uncommon', '🟢 Uncommon'],
    ['rare', '🔵 Rare'],
    ['epic', '🟣 Epic'],
    ['legendary', '🟡 Legendary'],
    ['mythic', '🔴 Mythic'],
  ];
  return [
    ...rarities.map(([value, label]) => [{
      text: `${selected === value ? '✓ ' : ''}${label}`,
      callback_data: `${prefix}:${value}`,
    }]),
    [{ text: '✖️ Отмена', callback_data: 'it:cancel' }],
  ];
}

async function beginCatalogItem(client: import('pg').PoolClient, userId: string, chatId: number) {
  await setSession(client, userId, { mode: 'item-create', step: 'type' });
  await sendMessage(chatId, '✨ Создание предмета\n\nШаг 1 из 7 · выбери категорию:', [
    [
      { text: '👕 Одежда / предмет', callback_data: 'it:type:clothing' },
      { text: '🚗 Автомобиль', callback_data: 'it:type:car' },
    ],
    [{ text: '✖️ Отмена', callback_data: 'it:cancel' }],
  ]);
}

async function showCatalogItems(client: import('pg').PoolClient, chatId: number, message?: TelegramMessage, page = 0) {
  const items = await listCatalogItems(client);
  const pageSize = 5;
  const pagination = getCatalogPage(items.length, page, pageSize);
  const { currentPage, start, end, totalPages } = pagination;
  const rows: Array<Array<{ text: string; callback_data: string }>> = items
    .slice(start, end)
    .map((item) => [{
    text: `${item.type === 'car' ? '🚗' : '👕'} ${item.name} · ${item.basePrice.toLocaleString('ru-RU')} ₽`,
    callback_data: `it:view:${item.id}`,
  }]);
  if (totalPages > 1) {
    rows.push([
      ...(pagination.hasPrevious ? [{ text: '⬅️ Назад', callback_data: `it:list:${currentPage - 1}` }] : []),
      { text: `📄 ${currentPage + 1}/${totalPages}`, callback_data: `it:list:${currentPage}` },
      ...(pagination.hasNext ? [{ text: `Ещё ${pageSize} ➡️`, callback_data: `it:list:${currentPage + 1}` }] : []),
    ]);
  }
  rows.push([{ text: '➕ Создать предмет / машину', callback_data: 'it:create' }]);
  rows.push([{ text: '🏠 Главное меню', callback_data: 'adm:home' }]);
  const text = items.length
    ? `✨ Каталог предметов · всего ${items.length} · по ${pageSize} на странице\nСтраница ${currentPage + 1} из ${totalPages}. Нажми на позицию, чтобы изменить или удалить её.`
    : '✨ Каталог предметов пока пуст.\nДобавь одежду или автомобиль для контейнеров.';
  if (message) await editMessage(message, text, rows);
  else await sendMessage(chatId, text, rows);
}

async function showCatalogItem(client: import('pg').PoolClient, chatId: number, id: string, message?: TelegramMessage) {
  const item = await getCatalogItem(client, id);
  if (!item) {
    await sendMessage(chatId, 'Предмет не найден.', [[{ text: '↩️ Каталог предметов', callback_data: 'it:list' }]]);
    return;
  }
  const text = [
    `${item.type === 'car' ? '🚗 Автомобиль' : '👕 Одежда / предмет'} · ${item.name}`,
    `Редкость: ${RARITY_LABELS[item.rarity]}`,
    `Цена: ${item.basePrice.toLocaleString('ru-RU')} ₽`,
    `Респект: ${item.respect}`,
    `Слот: ${item.type === 'car' ? 'car' : item.slot}`,
    `Изображение: ${item.image ? 'готово ✅' : 'не загружено ❌'}`,
    '',
    'Правки каталога автоматически отображаются во всех контейнерах, куда добавлен предмет.',
  ].join('\n');
  const rows = [
    [
      { text: '✏️ Название', callback_data: `it:rename:${id}` },
      { text: '💰 Цена', callback_data: `it:price:${id}` },
    ],
    [{ text: '🖼 Обновить картинку', callback_data: `it:photo:${id}` }],
    [{ text: '🗑 Удалить предмет', callback_data: `it:delete:${id}` }],
    [{ text: '↩️ К каталогу', callback_data: 'it:list' }],
    [{ text: '🏠 Главное меню', callback_data: 'adm:home' }],
  ];
  if (message) await editMessage(message, text, rows);
  else await sendMessage(chatId, text, rows);
}

function containerDropSummary(container: Container) {
  if (!container.contents.length) return 'Список предметов пуст.';
  const total = container.contents.reduce((sum, drop) => sum + (drop.weight ?? AUTO_DROP_WEIGHTS[drop.rarity]), 0);
  const visible = container.contents.slice(0, 18).map((drop, index) => {
    const weight = drop.weight ?? AUTO_DROP_WEIGHTS[drop.rarity];
    const chance = total ? (weight / total) * 100 : 0;
    return `${index + 1}. ${drop.icon} ${drop.name.slice(0, 48)} · ${chance.toFixed(2)}% (вес ${weight})`;
  });
  if (container.contents.length > visible.length) visible.push(`…ещё ${container.contents.length - visible.length} предметов`);
  return visible.join('\n');
}

async function showContainerDetails(client: import('pg').PoolClient, chatId: number, id: string, message?: TelegramMessage) {
  const container = (await listContainerCatalog(client)).find((entry) => entry.id === id);
  if (!container) {
    await sendMessage(chatId, 'Контейнер не найден.', [[{ text: '↩️ К списку контейнеров', callback_data: 'ct:list' }]]);
    return;
  }
  const text = [
    `📦 ${container.name}`,
    `Тип: ${typeLabel(container.category)} · тир ${container.tier}`,
    `Цена: ${container.price.toLocaleString('ru-RU')} ₽ · порядок: ${container.order}`,
    `Доступность: ${formatCooldownSeconds(container.cooldownSeconds ?? 0)}`,
    'Статус: ✅ Активен',
    `Фото: ${container.image ? 'загружено ✅' : 'не загружено ❌'}`,
    '',
    '🎲 Предметы и шансы выпадения:',
    containerDropSummary(container),
  ].join('\n');
  const rows = [
    [
      { text: '⬆️ Выше', callback_data: `ct:up:${container.id}` },
      { text: '⬇️ Ниже', callback_data: `ct:down:${container.id}` },
    ],
    [{ text: '🖼 Загрузить / обновить фото', callback_data: `ct:image:${container.id}` }],
    [{ text: '➕ Добавить предмет в дроп', callback_data: `ct:add-catalog:${container.id}` }],
    ...(container.contents.length ? [[{ text: '➖ Убрать предмет из дропа', callback_data: `ct:remove-drop:${container.id}` }]] : []),
    [{ text: '✏️ Изменить название / цену / тир', callback_data: `ct:edit-fields:${container.id}` }],
    [{ text: '🗑 Удалить контейнер', callback_data: `ct:delete:${container.id}` }],
    [{ text: '↩️ К списку контейнеров', callback_data: 'ct:list' }],
    [{ text: '🏠 Главное меню', callback_data: 'adm:home' }],
  ];
  if (message) await editMessage(message, text, rows);
  else await sendMessage(chatId, text, rows);
}

const cancelKeyboard = () => [[{ text: '✖️ Отмена', callback_data: 'adm:cancel' }]];

async function promptCatalogItemPhoto(chatId: number) {
  await sendMessage(chatId, 'Шаг 2 · отправь фото или PNG/JPEG/WebP-файл предмета.\nФон будет обработан автоматически; холст — 320 × 320.', cancelKeyboard());
}

async function saveNewCatalogItem(client: import('pg').PoolClient, chatId: number, userId: string, item: CatalogItem) {
  await saveCatalogItem(client, item);
  const containers = (await listContainerCatalog(client)).filter((container) =>
    item.type === 'clothing' ? container.category === 'clothing' : container.category === 'car');
  await setSession(client, userId, { mode: 'item-attach', targetId: item.id });
  const rows: Array<Array<{ text: string; callback_data: string }>> = containers.map((container) => [{
    text: `📦 ${container.name}`,
    callback_data: `it:attach:${container.id}`,
  }]);
  rows.push([{ text: 'Пропустить', callback_data: 'it:skip-attach' }]);
  await sendMessage(
    chatId,
    `✅ Предмет «${item.name}» создан.\n\nДобавить его в существующий контейнер? Выбери контейнер или пропусти.`,
    rows,
  );
}

async function showCatalogItemContainers(client: import('pg').PoolClient, chatId: number, itemId: string) {
  const item = await getCatalogItem(client, itemId);
  if (!item) throw new Error('Предмет не найден.');
  const containers = (await listContainerCatalog(client)).filter((container) =>
    item.type === 'clothing' ? container.category === 'clothing' : container.category === 'car');
  const rows: Array<Array<{ text: string; callback_data: string }>> = containers.map((container) => [{
    text: `📦 ${container.name}`,
    callback_data: `it:attach:${container.id}`,
  }]);
  rows.push([{ text: 'Пропустить', callback_data: 'it:skip-attach' }]);
  await sendMessage(chatId, `Куда добавить «${item.name}»?`, rows);
}

async function showContainerItemChoices(client: import('pg').PoolClient, chatId: number, containerId: string) {
  const container = (await listContainerCatalog(client)).find((entry) => entry.id === containerId);
  if (!container) throw new Error('Контейнер не найден.');
  if (container.category === 'plates') {
    await sendMessage(chatId, 'Контейнеры госномеров создают номера автоматически. Предметный каталог для них не используется.', [[
      { text: '↩️ Назад к контейнеру', callback_data: `ct:edit:${containerId}` },
    ]]);
    return;
  }
  const items = (await listCatalogItems(client)).filter((item) =>
    container.category === 'clothing' ? item.type === 'clothing' : item.type === 'car');
  if (!items.length) {
    await sendMessage(chatId, 'В каталоге пока нет подходящих предметов. Сначала создай их в разделе «Управление предметами».', [[
      { text: '✨ Открыть каталог предметов', callback_data: 'it:list' },
      { text: '↩️ Назад к контейнеру', callback_data: `ct:edit:${containerId}` },
    ]]);
    return;
  }
  const actorId = String(chatId);
  await setSession(client, actorId, { mode: 'container-drop-select', containerId });
  const rows = items.map((item) => [{
    text: `${item.type === 'car' ? '🚗' : '👕'} ${item.name} · ${item.basePrice.toLocaleString('ru-RU')} ₽`,
    callback_data: `ct:select-item:${item.id}`,
  }]);
  rows.push([{ text: '↩️ Назад к контейнеру', callback_data: `ct:edit:${containerId}` }]);
  await sendMessage(chatId, `Выбери предмет для «${container.name}»:`, rows);
}

async function showContainerDropChoices(client: import('pg').PoolClient, chatId: number, containerId: string) {
  const container = (await listContainerCatalog(client)).find((entry) => entry.id === containerId);
  if (!container) throw new Error('Контейнер не найден.');
  const rows = container.contents.map((drop, index) => [{
    text: `➖ ${drop.icon} ${drop.name}`,
    callback_data: `ct:dropremove:${containerId}:${index}`,
  }]);
  rows.push([{ text: '↩️ Назад к контейнеру', callback_data: `ct:edit:${containerId}` }]);
  await sendMessage(chatId, `Нажми предмет, который нужно убрать из «${container.name}»:`, rows);
}

async function attachCatalogItem(client: import('pg').PoolClient, containerId: string, itemId: string) {
  const container = (await listContainerCatalog(client)).find((entry) => entry.id === containerId);
  const item = await getCatalogItem(client, itemId);
  if (!container || !item) throw new Error('Контейнер или предмет не найден.');
  if (container.category !== item.type) throw new Error('Тип предмета не совпадает с типом контейнера.');
  const drop: ContainerDrop = {
    catalogItemId: item.id,
    name: item.name,
    icon: item.icon,
    image: item.image,
    rarity: item.rarity,
    basePrice: item.basePrice,
    respect: item.respect,
    ...(item.type === 'clothing' ? { slot: item.slot as ContainerDrop['slot'] } : {}),
    weight: AUTO_DROP_WEIGHTS[item.rarity],
  };
  const existingIndex = container.contents.findIndex((entry) => entry.catalogItemId === item.id);
  const contents = [...container.contents];
  if (existingIndex >= 0) contents[existingIndex] = drop;
  else contents.push(drop);
  await saveContainer(client, {
    id: container.id,
    title: container.name,
    type: container.category,
    tier: container.tier,
    price: container.price,
    sortOrder: container.order,
    description: container.description,
    icon: container.icon,
    image: container.image,
    drops: contents,
    cooldownSeconds: container.cooldownSeconds ?? 0,
  });
}

async function showContainerFields(client: import('pg').PoolClient, chatId: number, containerId: string, message?: TelegramMessage) {
  const container = (await listContainerCatalog(client)).find((entry) => entry.id === containerId);
  if (!container) throw new Error('Контейнер не найден.');
  const rows = [
    [{ text: '📝 Название', callback_data: `ct:title:${containerId}` }],
    [{ text: '💰 Цена открытия', callback_data: `ct:price:${containerId}` }],
    [{ text: '🏷 Тир', callback_data: `ct:tier:${containerId}` }],
    [{ text: '⏱ Режим доступа / таймер', callback_data: `ct:cooldown:${containerId}` }],
    [{ text: '↩️ Карточка контейнера', callback_data: `ct:edit:${containerId}` }],
  ];
  const text = `✏️ Изменение «${container.name}»\nВыбери параметр:`;
  if (message) await editMessage(message, text, rows);
  else await sendMessage(chatId, text, rows);
}

async function processCatalogItemMessage(
  client: import('pg').PoolClient,
  chatId: number,
  userId: string,
  session: AdminSession,
  text: string,
) {
  if (session.mode === 'item-field') {
    const stored = await getCatalogItem(client, session.targetId ?? '');
    if (!stored) throw new Error('Предмет не найден.');
    if (session.field === 'name') {
      stored.name = text.trim();
    } else if (session.field === 'price') {
      const price = Number(text.trim());
      if (!Number.isSafeInteger(price) || price < 1 || price > 2_000_000_000) {
        throw new Error('Цена должна быть целым числом от 1 до 2 000 000 000 ₽.');
      }
      stored.basePrice = price;
    } else {
      throw new Error('Параметр редактирования не распознан.');
    }
    await saveCatalogItem(client, stored);
    await clearSession(client, userId);
    await showCatalogItem(client, chatId, stored.id);
    return;
  }
  const item = session.catalogItem;
  if (!item) throw new Error('Черновик предмета потерян. Начни создание из каталога заново.');

  switch (session.step) {
    case 'name':
      if (!text.trim() || text.trim().length > 100) throw new Error('Название предмета должно содержать до 100 символов.');
      item.name = text.trim();
      session.step = 'rarity';
      await setSession(client, userId, session);
      await sendMessage(chatId, 'Шаг 4 · выбери редкость:', rarityKeyboard('it:rarity'));
      return;
    case 'price': {
      const price = Number(text.trim());
      if (!Number.isSafeInteger(price) || price < 1 || price > 2_000_000_000) {
        throw new Error('Цена должна быть целым числом от 1 до 2 000 000 000 ₽.');
      }
      item.basePrice = price;
      item.respect = calculateRespect(price, item.rarity);
      if (item.type === 'car') {
        await saveNewCatalogItem(client, chatId, userId, item);
        return;
      }
      session.step = 'slot';
      await setSession(client, userId, session);
      await sendMessage(chatId, 'Шаг 6 · выбери слот одежды:', [
        [{ text: '🧢 Голова', callback_data: 'it:slot:head' }, { text: '🧥 Верх', callback_data: 'it:slot:torso' }],
        [{ text: '👖 Низ', callback_data: 'it:slot:legs' }, { text: '👟 Обувь', callback_data: 'it:slot:shoes' }],
        [{ text: '🕶 Аксессуар', callback_data: 'it:slot:accessory' }],
        ...cancelKeyboard(),
      ]);
      return;
    }
    default:
      throw new Error('Шаг создания предмета не распознан. Запусти мастер ещё раз.');
  }
}

async function processContainerPhoto(client: import('pg').PoolClient, message: TelegramMessage, session: AdminSession) {
  const chatId = message.chat.id;
  const userId = String(message.from?.id ?? chatId);
  const createImageStep = session.mode === 'create'
    && (session.step === 'image' || session.step === 'grid-image' || session.step === 'item-photo');
  const expectsImage = createImageStep
    || session.mode === 'container-photo'
    || (session.mode === 'item-create' && session.step === 'photo')
    || session.mode === 'item-photo';
  if (!expectsImage) throw new Error('Сейчас загрузка картинки не ожидается. Открой нужный шаг в админ-меню.');

  if (session.mode === 'create' && session.step === 'grid-image') {
    if (!session.itemCount || (session.draft?.type !== 'clothing' && session.draft?.type !== 'car')) {
      throw new Error('Не хватает количества предметов или типа контейнера. Вернись в мастер и повтори этот шаг.');
    }
    const images = await storeTelegramSpriteSheet(message, session.itemCount);
    const type = session.draft.type;
    session.itemNumbers = images.map((_, index) => index + 1);
    session.draftItems = images.map((image) => ({
      id: createId('catalog'),
      type,
      name: '',
      icon: type === 'car' ? '🚗' : '👕',
      image,
      rarity: 'common',
      basePrice: 1,
      respect: 0,
      ...(type === 'car' ? { slot: 'car' as const } : {}),
    }));
    session.dropIndex = 0;
    await promptDraftCatalogItem(client, chatId, session, 0);
    return;
  }

  if (session.mode === 'create' && session.step === 'image') {
    const image = await storeTelegramImage(message);
    session.draft = { ...session.draft, image };
    session.step = 'title';
    await setSession(client, userId, session);
    await sendMessage(chatId, 'Иконка обработана и подогнана под формат игры! ✅\nШаг 2 · введи название контейнера:', cancelKeyboard());
    return;
  }

  if (session.mode === 'create' && session.step === 'item-photo') {
    if (session.itemSource !== 'single' || (session.draft?.type !== 'clothing' && session.draft?.type !== 'car')) {
      throw new Error('Загрузка одиночного предмета сейчас не ожидается.');
    }
    if ((session.draftItems?.length ?? 0) >= 100) throw new Error('В одном контейнере не может быть больше 100 предметов.');
    const image = await storeTelegramImage(message);
    const type = session.draft.type;
    const items = [...(session.draftItems ?? []), {
      id: createId('catalog'),
      type,
      name: '',
      icon: type === 'car' ? '🚗' : '👕',
      image,
      rarity: 'common' as const,
      basePrice: 1,
      respect: 0,
      ...(type === 'car' ? { slot: 'car' as const } : {}),
    }];
    session.draftItems = items;
    session.itemNumbers = [...(session.itemNumbers ?? []), items.length];
    await promptDraftCatalogItem(client, chatId, session, items.length - 1);
    return;
  }

  const image = await storeTelegramImage(message);
  if (session.mode === 'item-create' && session.step === 'photo') {
    const item = session.catalogItem;
    if (!item) throw new Error('Черновик предмета потерян. Начни создание заново.');
    item.image = image;
    await setSession(client, userId, { ...session, catalogItem: item, step: 'name' });
    await sendMessage(chatId, 'Иконка обработана и подогнана под формат игры! ✅\nШаг 3 · введи название предмета:', cancelKeyboard());
    return;
  }

  if (session.mode === 'item-photo' && session.targetId) {
    const item = await getCatalogItem(client, session.targetId);
    if (!item) throw new Error('Предмет не найден.');
    item.image = image;
    await saveCatalogItem(client, item);
    await clearSession(client, userId);
    await sendMessage(chatId, `✅ Картинка «${item.name}» обработана и обновлена.`);
    await showCatalogItem(client, chatId, item.id);
    return;
  }

  if (session.mode === 'container-photo' && session.containerId) {
    const container = (await listContainerCatalog(client)).find((entry) => entry.id === session.containerId);
    if (!container) throw new Error('Контейнер не найден.');
    await saveContainer(client, {
      id: container.id,
      title: container.name,
      type: container.category,
      tier: container.tier,
      price: container.price,
      sortOrder: container.order,
      description: container.description,
      icon: container.icon,
      image,
      drops: container.contents,
      cooldownSeconds: container.cooldownSeconds ?? 0,
    });
    await clearSession(client, userId);
    await sendMessage(chatId, `✅ Фото контейнера «${container.name}» обновлено.`);
    await showContainerDetails(client, chatId, container.id);
    return;
  }

  throw new Error('Сейчас фото не ожидается. Открой загрузку картинки из админ-меню.');
}

async function processContainerFieldEdit(client: import('pg').PoolClient, chatId: number, session: AdminSession, text: string) {
  const container = (await listContainerCatalog(client)).find((entry) => entry.id === session.containerId);
  if (!container) throw new Error('Контейнер не найден.');
  const updates = {
    title: session.mode === 'edit-title' ? text.trim() : container.name,
    price: session.mode === 'edit-price' ? Number(text.trim()) : container.price,
    tier: session.mode === 'edit-tier' ? Number(text.trim()) : container.tier,
    cooldownSeconds: session.mode === 'edit-cooldown' ? parseCooldown(text) : container.cooldownSeconds ?? 0,
  };
  await saveContainer(client, {
    id: container.id,
    title: updates.title,
    type: container.category,
    tier: updates.tier,
    price: updates.price,
    sortOrder: container.order,
    description: container.description,
    icon: container.icon,
    image: container.image,
    drops: container.contents,
    cooldownSeconds: updates.cooldownSeconds,
  });
  await clearSession(client, String(chatId));
  await sendMessage(chatId, `✅ Параметры контейнера «${updates.title}» обновлены.`);
  await showContainerMenu(client, chatId);
}

async function showAdminSeasonSettings(client: import('pg').PoolClient, chatId: number, message?: TelegramMessage) {
  await ensureSeasonTables(client);
  const { rows } = await client.query<{
    season_id: string; name: string; ends_at: Date | string | null; premium_price_stars: number;
    limited_container_id: string | null; is_active: boolean;
  }>(`SELECT season_id, name, ends_at, premium_price_stars, limited_container_id, is_active
      FROM game_seasons ORDER BY is_active DESC, updated_at DESC LIMIT 1`);
  const season = rows[0];
  if (!season) throw new Error('Сезон не найден в базе.');
  const containers = await listSeasonContainers(client);
  const limitedContainer = containers.find((entry) => entry.id === season.limited_container_id);
  const endLabel = season.ends_at
    ? new Date(season.ends_at).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow', dateStyle: 'medium' })
    : 'не задана';
  const text = [
    '🏆 Season Pass · настройки сезона', '', `Название: ${season.name}`,
    `Статус: ${season.is_active ? '🟢 активен' : '⚪ остановлен'}`,
    `Окончание: ${endLabel} (МСК)`, `Premium Pass: ${season.premium_price_stars} ⭐ XTR`,
    `Кейс 30-го уровня: ${limitedContainer?.name ?? 'не выбран'}`, '',
    'Оплата открывает премиальные награды. Итог подтверждает только Telegram webhook.',
  ].join('\n');
  const keyboard = [
    [{ text: '✏️ Название', callback_data: `se:name:${season.season_id}` }, { text: '📅 Дата окончания', callback_data: `se:date:${season.season_id}` }],
    [{ text: '⭐ Цена Stars', callback_data: `se:stars:${season.season_id}` }],
    [{ text: '🎁 Кейс 30 уровня', callback_data: `se:case:${season.season_id}` }],
    [{ text: season.is_active ? '⏸ Остановить сезон' : '▶️ Запустить сезон', callback_data: `se:toggle:${season.season_id}` }],
    [{ text: '↩️ Главное меню', callback_data: 'adm:home' }],
  ];
  if (message) await editMessage(message, text, keyboard);
  else await sendMessage(chatId, text, keyboard);
}

function adminHomeKeyboard() {
  return [
    [
      { text: '👥 Игроки', callback_data: 'adm:players' },
      { text: '🔨 Аукцион', callback_data: 'adm:auction' },
    ],
    [
      { text: '⚙️ Экономика', callback_data: 'adm:economy' },
      { text: '📊 Статистика', callback_data: 'adm:analytics' },
    ],
    [
      { text: '📢 Объявление', callback_data: 'adm:announcement' },
      { text: '📦 Контейнеры', callback_data: 'ct:list' },
    ],
    [{ text: '✨ Управление предметами (Каталог)', callback_data: 'it:list' }],
    [{ text: '🏆 Сезон 1 · Genesis и Stars', callback_data: 'adm:season' }],
    [{ text: '🧾 Журнал игровых действий', callback_data: 'adm:activity:0' }],
  ];
}

async function showAdminHome(chatId: number, message?: TelegramMessage) {
  const text = [
    '🔐 LootLand · Панель управления',
    '',
    'Выбери раздел. Изменения применяются сразу:',
    '• Игроки — поиск, баланс, XP и блокировки',
    '• Аукцион — проверка и снятие лотов',
    '• Экономика — доступность режимов и цены выкупа',
    '• Объявления — отправка игрокам',
    '• Статистика — активность и сделки',
    '• Журнал — последние игровые действия и история игрока',
    '• Контейнеры — каталог и состав дропа',
    '• Каталог предметов — одежда и машины',
    '• Season 1 — сроки, цена Stars и кейс 30-го уровня',
  ].join('\n');
  if (message) await editMessage(message, text, adminHomeKeyboard());
  else await sendMessage(chatId, text, adminHomeKeyboard());
}

const playerDisplayName = (player: { first_name: string; last_name: string | null; username: string | null }) =>
  [player.first_name, player.last_name].filter(Boolean).join(' ') || player.username || 'Игрок';

async function showAdminActivity(client: import('pg').PoolClient, chatId: number, offset = 0, message?: TelegramMessage) {
  const events = await listAdminActivity(client, offset);
  const visibleEvents = events.slice(0, 10);
  const lines = [`🧾 Последние игровые действия · с ${offset + 1}-й записи`];
  const rows: Array<Array<{ text: string; callback_data: string }>> = [];
  if (!visibleEvents.length) lines.push('', 'В журнале пока нет записей.');
  for (const event of visibleEvents) {
    lines.push('', formatAdminActivity(event));
    rows.push([{
      text: `👤 История: ${playerDisplayName(event)} · ${formatAdminActivityLabel(event.action_type)}`.slice(0, 60),
      callback_data: `pl:history:${event.telegram_id}:0`,
    }]);
  }
  const pagination = [
    ...(offset > 0 ? [{ text: '⬅️ Назад', callback_data: `adm:activity:${Math.max(0, offset - 10)}` }] : []),
    ...(events.length > 10 ? [{ text: 'Вперёд ➡️', callback_data: `adm:activity:${offset + 10}` }] : []),
  ];
  if (pagination.length) rows.push(pagination);
  rows.push([{ text: '↩️ Главное меню', callback_data: 'adm:home' }]);
  if (message) await editMessage(message, lines.join('\n'), rows);
  else await sendMessage(chatId, lines.join('\n'), rows);
}

async function showAdminPlayerHistory(client: import('pg').PoolClient, chatId: number, id: string, offset = 0, message?: TelegramMessage) {
  const player = await getAdminPlayer(client, id);
  if (!player) {
    await sendMessage(chatId, 'Игрок не найден.', [[{ text: '↩️ Игроки', callback_data: 'adm:players' }]]);
    return;
  }
  const events = await listAdminActivity(client, offset, id);
  const visibleEvents = events.slice(0, 10);
  const lines = [`📜 История операций · ${playerDisplayName(player)}`];
  if (!visibleEvents.length) lines.push('', 'Для игрока пока нет записей в журнале.');
  for (const event of visibleEvents) lines.push('', formatAdminActivity(event));
  const rows: Array<Array<{ text: string; callback_data: string }>> = [];
  const pagination = [
    ...(offset > 0 ? [{ text: '⬅️ Назад', callback_data: `pl:history:${id}:${Math.max(0, offset - 10)}` }] : []),
    ...(events.length > 10 ? [{ text: 'Вперёд ➡️', callback_data: `pl:history:${id}:${offset + 10}` }] : []),
  ];
  if (pagination.length) rows.push(pagination);
  rows.push([{ text: '↩️ К карточке игрока', callback_data: `pl:view:${id}` }]);
  if (message) await editMessage(message, lines.join('\n'), rows);
  else await sendMessage(chatId, lines.join('\n'), rows);
}

async function showPlayerSearch(client: import('pg').PoolClient, chatId: number, search: string) {
  const players = await searchAdminPlayers(client, search);
  if (!players.length) {
    await sendMessage(chatId, `Игроки по запросу «${search}» не найдены.`, [[
      { text: '↩️ В меню админки', callback_data: 'adm:home' },
    ]]);
    return;
  }
  const rows: Array<Array<{ text: string; callback_data: string }>> = players.map((player) => ([{
    text: `${player.is_banned ? '⛔ ' : ''}${playerDisplayName(player)}${player.username ? ` · @${player.username}` : ''}`,
    callback_data: `pl:view:${player.telegram_id}`,
  }]));
  rows.push([{ text: '↩️ В меню админки', callback_data: 'adm:home' }]);
  await sendMessage(chatId, `👥 Найдено игроков: ${players.length}\nНажми на игрока, чтобы открыть карточку управления:`, rows);
}

async function showAdminPlayer(client: import('pg').PoolClient, chatId: number, id: string, message?: TelegramMessage) {
  const player = await getAdminPlayer(client, id);
  if (!player) {
    await sendMessage(chatId, 'Игрок не найден.', [[{ text: '↩️ Игроки', callback_data: 'adm:players' }]]);
    return;
  }
  const inventoryCount = player.state.inventory?.length ?? 0;
  const plateCount = player.state.licensePlates?.length ?? 0;
  const text = [
    `👤 ${playerDisplayName(player)}`,
    player.username ? `Ник: @${player.username}` : 'Ник: не указан',
    `Telegram ID: ${player.telegram_id}`,
    `Статус: ${player.is_banned ? '⛔ Заблокирован' : '✅ Активен'}`,
    `Баланс: ${(Number(player.state.balance) || 0).toLocaleString('ru-RU')} ₽`,
    `XP: ${Number(player.xp) || 0}`,
    `Респект: ${Number(player.state.respect) || 0}`,
    `Коллекция: ${inventoryCount + plateCount} предметов`,
  ].join('\n');
  const rows = [
    [
      { text: '➕ Баланс', callback_data: `pl:add-balance:${id}` },
      { text: '➖ Баланс', callback_data: `pl:sub-balance:${id}` },
    ],
    [
      { text: '➕ XP', callback_data: `pl:add-xp:${id}` },
      { text: '➖ XP', callback_data: `pl:sub-xp:${id}` },
    ],
    [
      { text: '📜 История операций', callback_data: `pl:history:${id}:0` },
      { text: '⏱ Сбросить таймеры', callback_data: `pl:cooldowns:${id}` },
    ],
    [{ text: player.is_banned ? '✅ Разблокировать' : '⛔ Заблокировать', callback_data: `pl:${player.is_banned ? 'unban' : 'ban'}:${id}` }],
    [{ text: '↩️ К поиску игроков', callback_data: 'adm:players' }],
    [{ text: '🏠 Главное меню', callback_data: 'adm:home' }],
  ];
  if (message) await editMessage(message, text, rows);
  else await sendMessage(chatId, text, rows);
}

async function showAdminAuction(client: import('pg').PoolClient, chatId: number, offset = 0, message?: TelegramMessage) {
  const listings = await listAdminListings(client, offset);
  const visibleListings = listings.slice(0, 10);
  const rows: Array<Array<{ text: string; callback_data: string }>> = [];
  const lines = [`🔨 Активные лоты · с ${offset + 1}-го`];
  if (!listings.length) lines.push('', 'Активных лотов на этой странице нет.');
  for (const listing of visibleListings) {
    const seller = listing.username ? `@${listing.username}` : playerDisplayName(listing);
    lines.push('', `${listing.item.name ?? 'Предмет'} · ${Number(listing.asking_price).toLocaleString('ru-RU')} ₽`, `Продавец: ${seller}`);
    rows.push([{ text: `Снять лот · ${String(listing.item.name ?? 'Предмет').slice(0, 22)}`, callback_data: `au:remove:${listing.listing_id}` }]);
  }
  rows.push([
    ...(offset > 0 ? [{ text: '⬅️ Назад', callback_data: `au:page:${Math.max(0, offset - 10)}` }] : []),
    ...(listings.length > 10 ? [{ text: 'Вперёд ➡️', callback_data: `au:page:${offset + 10}` }] : []),
  ]);
  rows.push([{ text: '↩️ Главное меню', callback_data: 'adm:home' }]);
  if (message) await editMessage(message, lines.join('\n'), rows);
  else await sendMessage(chatId, lines.join('\n'), rows);
}

async function showEconomySettings(client: import('pg').PoolClient, chatId: number, message?: TelegramMessage) {
  const settings = await getEconomySettings(client);
  const text = [
    '⚙️ Экономика',
    '',
    `Аукцион: ${settings.marketplaceEnabled ? 'включён' : 'приостановлен'}`,
    `Открытие контейнеров: ${settings.containersEnabled ? 'включено' : 'приостановлено'}`,
    `Выкуп перекупом: ${Math.round(settings.resaleMultiplier * 100)}% от цены предмета`,
    '',
    'Нажми на действие — оно вступит в силу сразу для всех игроков.',
  ].join('\n');
  const rows = [
    [{ text: `${settings.marketplaceEnabled ? '⏸ Приостановить' : '▶️ Включить'} аукцион`, callback_data: 'ec:toggle:marketplaceEnabled' }],
    [{ text: `${settings.containersEnabled ? '⏸ Приостановить' : '▶️ Включить'} контейнеры`, callback_data: 'ec:toggle:containersEnabled' }],
    [{ text: '💰 Изменить процент выкупа', callback_data: 'ec:resale' }],
    [{ text: '↩️ Главное меню', callback_data: 'adm:home' }],
  ];
  if (message) await editMessage(message, text, rows);
  else await sendMessage(chatId, text, rows);
}

async function showAdminAnalytics(client: import('pg').PoolClient, chatId: number, message?: TelegramMessage) {
  const stats = await loadAdminAnalytics(client);
  const text = [
    '📊 Статистика LootLand',
    '',
    `Всего игроков: ${Number(stats.total_players).toLocaleString('ru-RU')}`,
    `Активны за 7 дней: ${Number(stats.active_players).toLocaleString('ru-RU')}`,
    `Заблокировано: ${Number(stats.banned_players).toLocaleString('ru-RU')}`,
    `Активных лотов: ${Number(stats.active_listings).toLocaleString('ru-RU')}`,
    `Продаж за 24 часа: ${Number(stats.sales_24h).toLocaleString('ru-RU')}`,
    `Открытий контейнеров за 24 часа: ${Number(stats.openings_24h).toLocaleString('ru-RU')}`,
  ].join('\n');
  const rows = [[{ text: '↻ Обновить', callback_data: 'adm:analytics' }], [{ text: '↩️ Главное меню', callback_data: 'adm:home' }]];
  if (message) await editMessage(message, text, rows);
  else await sendMessage(chatId, text, rows);
}

async function sendAnnouncementBatch(client: import('pg').PoolClient, chatId: number, session: AdminSession) {
  if (!session.announcement) throw new Error('Текст объявления потерян. Начни рассылку заново.');
  const offset = session.offset ?? 0;
  const recipients = await listAnnouncementRecipients(client, offset, 10);
  let delivered = session.delivered ?? 0;
  let failed = session.failed ?? 0;
  let processed = offset;
  for (const recipient of recipients) {
    try {
      await sendMessage(Number(recipient), session.announcement);
      delivered += 1;
    } catch (failure) {
      if (typeof failure === 'object' && failure !== null && 'telegramErrorCode' in failure
        && (failure as { telegramErrorCode?: number }).telegramErrorCode === 403) {
        failed += 1;
      } else {
        throw failure;
      }
    }
    processed += 1;
    await setSession(client, String(chatId), {
      ...session,
      mode: 'announcement-send',
      offset: processed,
      delivered,
      failed,
    });
  }
  const nextOffset = processed;
  const total = await countAnnouncementRecipients(client);
  if (nextOffset >= total) {
    await clearSession(client, String(chatId));
    await sendMessage(chatId, `✅ Рассылка завершена.\nДоставлено: ${delivered}\nНе доставлено: ${failed}`, [[
      { text: '🏠 Главное меню', callback_data: 'adm:home' },
    ]]);
    return;
  }
  const nextSession: AdminSession = {
    ...session,
    mode: 'announcement-send',
    offset: nextOffset,
    delivered,
    failed,
  };
  await setSession(client, String(chatId), nextSession);
  await sendMessage(chatId, `Рассылка: ${nextOffset} из ${total} обработано.\nДоставлено: ${delivered} · пропущено: ${failed}`, [[
    { text: 'Продолжить рассылку ➡️', callback_data: 'an:continue' },
    { text: '⏹ Остановить', callback_data: 'an:stop' },
  ]]);
}

async function handleCallback(client: import('pg').PoolClient, callback: TelegramCallback) {
  const message = callback.message;
  if (!message) return;
  const data = callback.data ?? '';
  const actorId = String(callback.from.id);
  if (actorId !== adminTelegramId()) {
    await answerCallback(callback.id, 'Нет доступа.');
    return;
  }
  await answerCallback(callback.id);
  const [section, action, value, extra] = data.split(':');
  if (section === 'adm') {
    if (action === 'home') {
      await clearSession(client, actorId);
      return showAdminHome(message.chat.id, message);
    }
    if (action === 'cancel') {
      await clearSession(client, actorId);
      return showAdminHome(message.chat.id, message);
    }
    if (action === 'players') {
      await setSession(client, actorId, { mode: 'player-search' });
      await sendMessage(message.chat.id, '👥 Поиск игрока\nОтправь Telegram ID, @username или часть имени:');
      return;
    }
    if (action === 'auction') return showAdminAuction(client, message.chat.id, 0, message);
    if (action === 'economy') return showEconomySettings(client, message.chat.id, message);
    if (action === 'analytics') return showAdminAnalytics(client, message.chat.id, message);
    if (action === 'season') {
      await clearSession(client, actorId);
      return showAdminSeasonSettings(client, message.chat.id, message);
    }
    if (action === 'activity') return showAdminActivity(client, message.chat.id, Math.max(0, Math.floor(Number(value) || 0)), message);
    if (action === 'announcement') {
      await setSession(client, actorId, { mode: 'announcement-draft' });
      await sendMessage(message.chat.id, '📢 Отправь текст объявления для игроков. Пока текст не подтверждён, он никому не отправится.', [[
        { text: 'Отмена', callback_data: 'adm:home' },
      ]]);
      return;
    }
  }
  if (section === 'se') {
    if (action === 'settings') return showAdminSeasonSettings(client, message.chat.id, message);
    if (action === 'name' || action === 'date' || action === 'stars') {
      await setSession(client, actorId, { mode: 'season-config', step: action, targetId: value });
      const prompt = action === 'name' ? 'Введи название сезона (2–60 символов):'
        : action === 'date' ? 'Введи дату окончания сезона по Москве в формате ГГГГ-ММ-ДД. Сезон завершится в 23:59 MSK этого дня:'
          : 'Введи целую цену Premium Pass в Telegram Stars XTR (от 1 до 10 000):';
      await sendMessage(message.chat.id, prompt, [[{ text: 'Отмена', callback_data: 'adm:season' }]]);
      return;
    }
    if (action === 'case') {
      await setSession(client, actorId, { mode: 'season-config', step: 'container', targetId: value });
      const containers = await listSeasonContainers(client);
      const rows: Array<Array<{ text: string; callback_data: string }>> = containers.map((container) => [{ text: `${container.category === 'car' ? '🚗' : '👕'} ${container.name}`.slice(0, 60), callback_data: `se:case-pick:${container.id}` }]);
      rows.push([{ text: 'Без привязки', callback_data: 'se:case-pick:none' }], [{ text: 'Отмена', callback_data: 'adm:season' }]);
      await sendMessage(message.chat.id, 'Выбери контейнер, который будет лимитированным призом Premium Pass на 30-м уровне:', rows);
      return;
    }
    if (action === 'case-pick') {
      const session = await getSession(client, actorId);
      if (!session || session.mode !== 'season-config' || session.step !== 'container' || !session.targetId) throw new Error('Сначала выбери контейнер для сезонной награды.');
      const container = value === 'none' ? undefined : (await listSeasonContainers(client)).find((entry) => entry.id === value);
      if (value !== 'none' && !container) throw new Error('Контейнер не найден или не подходит для сезонной награды.');
      await updateSeasonSettings(client, session.targetId, 'limited_container_id', container?.id ?? null);
      await clearSession(client, actorId);
      return showAdminSeasonSettings(client, message.chat.id, message);
    }
    if (action === 'toggle') {
      const { rows } = await client.query<{ is_active: boolean }>('SELECT is_active FROM game_seasons WHERE season_id = $1', [value]);
      if (!rows[0]) throw new Error('Сезон не найден.');
      await updateSeasonSettings(client, value, 'is_active', !rows[0].is_active);
      return showAdminSeasonSettings(client, message.chat.id, message);
    }
  }
  if (section === 'it') {
    if (action === 'list') return showCatalogItems(client, message.chat.id, message, Math.max(0, Number(value) || 0));
    if (action === 'create') return beginCatalogItem(client, actorId, message.chat.id);
    if (action === 'cancel' || action === 'skip-attach') {
      await clearSession(client, actorId);
      return showCatalogItems(client, message.chat.id, message);
    }
    if (action === 'type') {
      if (value !== 'clothing' && value !== 'car') throw new Error('Выбери одежду или автомобиль.');
      const session = await getSession(client, actorId);
      if (!session || session.mode !== 'item-create' || session.step !== 'type') throw new Error('Мастер создания уже завершён.');
      const item: CatalogItem = {
        id: createId('catalog'),
        type: value,
        name: '',
        icon: value === 'car' ? '🚗' : '👕',
        image: '',
        rarity: 'common',
        basePrice: 1,
        respect: 0,
        ...(value === 'car' ? { slot: 'car' as const } : {}),
      };
      await setSession(client, actorId, { mode: 'item-create', step: 'photo', catalogItem: item });
      await promptCatalogItemPhoto(message.chat.id);
      return;
    }
    if (action === 'rarity') {
      const session = await getSession(client, actorId);
      if (!session || session.mode !== 'item-create' || session.step !== 'rarity' || !session.catalogItem) {
        throw new Error('Сейчас выбор редкости не ожидается.');
      }
      if (!['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'].includes(value)) {
        throw new Error('Неизвестная редкость.');
      }
      session.catalogItem.rarity = value as CatalogItem['rarity'];
      session.step = 'price';
      await setSession(client, actorId, session);
      await sendMessage(message.chat.id, 'Шаг 6 · введи базовую цену в рублях:', cancelKeyboard());
      return;
    }
    if (action === 'slot') {
      const session = await getSession(client, actorId);
      if (!session || session.mode !== 'item-create' || session.step !== 'slot' || !session.catalogItem) {
        throw new Error('Сейчас выбор слота не ожидается.');
      }
      if (!['head', 'torso', 'legs', 'shoes', 'accessory'].includes(value)) throw new Error('Неизвестный слот одежды.');
      session.catalogItem.slot = value as CatalogItem['slot'];
      await saveNewCatalogItem(client, message.chat.id, actorId, session.catalogItem);
      return;
    }
    if (action === 'view') return showCatalogItem(client, message.chat.id, value, message);
    if (action === 'attach') {
      const session = await getSession(client, actorId);
      if (!session || session.mode !== 'item-attach' || !session.targetId) throw new Error('Выбери сначала предмет для привязки.');
      await attachCatalogItem(client, value, session.targetId);
      await clearSession(client, actorId);
      return showContainerDetails(client, message.chat.id, value, message);
    }
    if (action === 'rename' || action === 'price') {
      await setSession(client, actorId, { mode: 'item-field', targetId: value, field: action === 'rename' ? 'name' : 'price' });
      await sendMessage(message.chat.id, action === 'rename' ? 'Введи новое название предмета:' : 'Введи новую базовую цену в ₽:', cancelKeyboard());
      return;
    }
    if (action === 'photo') {
      await setSession(client, actorId, { mode: 'item-photo', targetId: value });
      await sendMessage(message.chat.id, 'Отправь фото или PNG/JPEG/WebP-файл. Новая картинка будет автоматически обработана.', cancelKeyboard());
      return;
    }
    if (action === 'delete') {
      const item = await getCatalogItem(client, value);
      if (!item) throw new Error('Предмет не найден.');
      await editMessage(message, `Удалить «${item.name}» из каталога? Сначала убери его из контейнеров.`, [[
        { text: '🗑 Подтвердить удаление', callback_data: `it:confirm-delete:${item.id}` },
        { text: 'Отмена', callback_data: `it:view:${item.id}` },
      ]]);
      return;
    }
    if (action === 'confirm-delete') {
      await deleteCatalogItem(client, value);
      return showCatalogItems(client, message.chat.id, message);
    }
  }
  if (section === 'pl') {
    if (action === 'view') return showAdminPlayer(client, message.chat.id, value, message);
    if (action === 'history') return showAdminPlayerHistory(client, message.chat.id, value, Math.max(0, Number(extra) || 0), message);
    if (action === 'cooldowns') {
      const player = await getAdminPlayer(client, value);
      if (!player) throw new Error('Игрок не найден.');
      await editMessage(message, `Сбросить все таймеры контейнеров для игрока «${playerDisplayName(player)}»? Сброс затронет только его доступ к контейнерам.`, [
        [{ text: '✅ Подтвердить сброс', callback_data: `pl:cooldowns-confirm:${value}` }],
        [{ text: '↩️ Отмена', callback_data: `pl:view:${value}` }],
      ]);
      return;
    }
    if (action === 'cooldowns-confirm') {
      const player = await getAdminPlayer(client, value);
      if (!player) throw new Error('Игрок не найден.');
      const cleared = await resetPlayerContainerCooldowns(client, value);
      await sendMessage(message.chat.id, `✅ Сброшено таймеров контейнеров: ${cleared}.`);
      return showAdminPlayer(client, message.chat.id, value, message);
    }
    if (action === 'ban' || action === 'unban') {
      if (value === actorId || value === adminTelegramId() || value === OWNER_TELEGRAM_ID) {
        throw new Error('Нельзя блокировать аккаунт администратора или владельца игры.');
      }
      await setPlayerBanned(client, value, action === 'ban');
      return showAdminPlayer(client, message.chat.id, value, message);
    }
    if (action === 'add-balance' || action === 'sub-balance' || action === 'add-xp' || action === 'sub-xp') {
      const field = action.endsWith('balance') ? 'balance' : 'xp';
      const direction = action.startsWith('add') ? 1 : -1;
      await setSession(client, actorId, { mode: 'player-adjust', targetId: value, field, direction });
      await sendMessage(message.chat.id, `Введи целое количество ${field === 'balance' ? '₽' : 'XP'} для ${direction > 0 ? 'начисления' : 'списания'}:`);
      return;
    }
  }
  if (section === 'au') {
    if (action === 'page') return showAdminAuction(client, message.chat.id, Math.max(0, Number(value) || 0), message);
    if (action === 'remove') {
      await editMessage(message, 'Снять этот лот с торгов? Предмет вернётся продавцу в коллекцию.', [[
        { text: '✅ Снять лот', callback_data: `au:confirm:${value}` },
        { text: 'Отмена', callback_data: 'adm:auction' },
      ]]);
      return;
    }
    if (action === 'confirm') {
      await moderateListing(client, value);
      return showAdminAuction(client, message.chat.id, 0, message);
    }
  }
  if (section === 'ec') {
    if (action === 'toggle' && (value === 'marketplaceEnabled' || value === 'containersEnabled')) {
      const settings = await getEconomySettings(client);
      await updateEconomySetting(client, value, !settings[value]);
      return showEconomySettings(client, message.chat.id, message);
    }
    if (action === 'resale') {
      await setSession(client, actorId, { mode: 'economy-adjust', field: 'resaleMultiplier' });
      await sendMessage(message.chat.id, 'Введи долю выкупа от цены (от 0,1 до 2, например 0,65):');
      return;
    }
  }
  if (section === 'an') {
    if (action === 'edit') {
      await setSession(client, actorId, { mode: 'announcement-draft' });
      await sendMessage(message.chat.id, 'Отправь исправленный текст объявления:');
      return;
    }
    if (action === 'send') {
      const session = await getSession(client, actorId);
      if (!session || session.mode !== 'announcement-confirm') throw new Error('Черновик объявления не найден.');
      await sendAnnouncementBatch(client, message.chat.id, { ...session, mode: 'announcement-send' });
      return;
    }
    if (action === 'continue') {
      const session = await getSession(client, actorId);
      if (!session || session.mode !== 'announcement-send') throw new Error('Активная рассылка не найдена.');
      await sendAnnouncementBatch(client, message.chat.id, session);
      return;
    }
    if (action === 'stop') {
      await clearSession(client, actorId);
      return showAdminHome(message.chat.id, message);
    }
  }
  if (action === 'create') {
    await beginCreate(client, actorId, message.chat.id);
    return;
  }
  if (action === 'type') {
    if (!containerTypes.includes(value as ContainerType)) throw new Error('Неизвестный тип контейнера.');
    const session = await getSession(client, actorId);
    if (!session || session.mode !== 'create' || session.step !== 'type') throw new Error('Диалог создания уже завершён.');
    const type = value as ContainerType;
    session.draft = { ...session.draft, type, icon: type === 'clothing' ? '🧥' : type === 'car' ? '🚗' : '🔢' };
    session.step = 'availability';
    await setSession(client, actorId, session);
    await sendMessage(message.chat.id, 'Шаг 3 · выбери режим доступности:', [
      [{ text: '♾ Обычный · без таймера', callback_data: 'ct:create-cooldown:none' }],
      [{ text: '📅 Ежедневный · раз в 24 часа', callback_data: 'ct:create-cooldown:daily' }],
      [{ text: '⏱ Свой таймер', callback_data: 'ct:create-cooldown:custom' }],
      ...cancelKeyboard(),
    ]);
    return;
  }
  if (action === 'create-cooldown') {
    const session = await getSession(client, actorId);
    if (!session || session.mode !== 'create' || session.step !== 'availability') throw new Error('Режим доступа сейчас не ожидается.');
    if (value === 'custom') {
      session.step = 'custom-cooldown';
      await setSession(client, actorId, session);
      await sendMessage(message.chat.id, 'Введи длительность таймера в часах (например, 12 или 1,5) либо в формате «1ч 30м».', cancelKeyboard());
      return;
    }
    if (value !== 'none' && value !== 'daily') throw new Error('Неизвестный режим таймера.');
    session.draft = { ...session.draft, cooldownSeconds: value === 'daily' ? 86_400 : 0 };
    session.step = 'price';
    await setSession(client, actorId, session);
    await sendMessage(message.chat.id, 'Шаг 4 · введи цену открытия в ₽. Для бесплатного открытия укажи 0:', cancelKeyboard());
    return;
  }
  if (action === 'create-source') {
    if (value !== 'grid' && value !== 'single') throw new Error('Выбери сетку или загрузку по одной картинке.');
    const session = await getSession(client, actorId);
    if (isRepeatedCreateSourceChoice(session, value)) {
      await sendMessage(message.chat.id, 'Этот способ уже выбран. Продолжай по последнему сообщению мастера.');
      return;
    }
    if (!session || session.mode !== 'create' || session.step !== 'item-source') {
      await sendMessage(message.chat.id, 'Эта кнопка уже устарела. Продолжай по последнему сообщению мастера или открой /admin заново.');
      return;
    }
    const nextSession: AdminSession = value === 'grid'
      ? { ...session, itemSource: 'grid', step: 'grid-count' }
      : { ...session, itemSource: 'single', draftItems: [], itemNumbers: [], step: 'item-photo' };
    const transitioned = await transitionAdminSessionStep(client, actorId, 'create', 'item-source', nextSession);
    if (!transitioned) {
      await sendMessage(message.chat.id, 'Выбор уже обработан. Продолжай по последнему сообщению мастера.');
      return;
    }
    if (value === 'grid') {
      await sendMessage(message.chat.id, 'Сколько всего предметов изображено на спрайт-листе? В одной строке будет ровно 5 ячеек.', cancelKeyboard());
      return;
    }
    await sendMessage(message.chat.id, 'Отправь фото или PNG/JPEG/WebP-файл первого предмета.', cancelKeyboard());
    return;
  }
  if (action === 'drop-rarity') {
    const session = await getSession(client, actorId);
    if (!session || session.mode !== 'create' || session.step !== 'item-rarity') throw new Error('Выбор редкости сейчас не ожидается.');
    if (!['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'].includes(value)) throw new Error('Неизвестная редкость.');
    const index = session.dropIndex ?? 0;
    const items = [...(session.draftItems ?? [])];
    if (!items[index]) throw new Error('Черновик предмета потерян.');
    const rarity = value as Rarity;
    items[index] = { ...items[index], rarity };
    session.draftItems = items;
    if (items[index].type === 'clothing') {
      session.step = 'item-slot';
      await setSession(client, actorId, session);
      await sendMessage(message.chat.id, 'Выбери слот одежды:', [
        [{ text: '🧢 Голова', callback_data: 'ct:drop-slot:head' }, { text: '🧥 Верх', callback_data: 'ct:drop-slot:torso' }],
        [{ text: '👖 Низ', callback_data: 'ct:drop-slot:legs' }, { text: '👟 Обувь', callback_data: 'ct:drop-slot:shoes' }],
        [{ text: '🕶 Аксессуар', callback_data: 'ct:drop-slot:accessory' }],
        ...cancelKeyboard(),
        ...(session.itemSource === 'grid' ? [[{ text: '⏭ Пропустить ячейку', callback_data: 'ct:skip-cell' }]] : []),
      ]);
      return;
    }
    items[index] = { ...items[index], slot: 'car' };
    session.step = 'item-price';
    await setSession(client, actorId, session);
    await sendMessage(message.chat.id, 'Введи базовую цену в ₽ и, при желании, Респект через пробел (например: 1500 5). Если Респект пропустить, он рассчитается автоматически.', [
      ...cancelKeyboard(),
      ...(session.itemSource === 'grid' ? [[{ text: '⏭ Пропустить ячейку', callback_data: 'ct:skip-cell' }]] : []),
    ]);
    return;
  }
  if (action === 'drop-slot') {
    const session = await getSession(client, actorId);
    if (!session || session.mode !== 'create' || session.step !== 'item-slot') throw new Error('Сейчас слот не ожидается.');
    if (!['head', 'torso', 'legs', 'shoes', 'accessory'].includes(value)) throw new Error('Неизвестный слот одежды.');
    const index = session.dropIndex ?? 0;
    const items = [...(session.draftItems ?? [])];
    if (!items[index] || items[index].type !== 'clothing') throw new Error('Предмет одежды не найден.');
    items[index] = { ...items[index], slot: value as CatalogItem['slot'] };
    session.draftItems = items;
    session.step = 'item-price';
    await setSession(client, actorId, session);
    await sendMessage(message.chat.id, 'Введи базовую цену в ₽ и, при желании, Респект через пробел (например: 1500 5). Если Респект пропустить, он рассчитается автоматически.', [
      ...cancelKeyboard(),
      ...(session.itemSource === 'grid' ? [[{ text: '⏭ Пропустить ячейку', callback_data: 'ct:skip-cell' }]] : []),
    ]);
    return;
  }
  if (action === 'skip-cell') {
    const session = await getSession(client, actorId);
    if (!session || session.mode !== 'create' || session.itemSource !== 'grid'
      || !['item-name', 'item-rarity', 'item-slot', 'item-price'].includes(session.step ?? '')) {
      throw new Error('Сейчас ячейку нельзя пропустить.');
    }
    const items = [...(session.draftItems ?? [])];
    const index = session.dropIndex ?? 0;
    if (!items[index]) throw new Error('Ячейка уже обработана.');
    items.splice(index, 1);
    session.itemNumbers?.splice(index, 1);
    session.draftItems = items;
    if (!items.length) {
      session.itemSource = undefined;
      session.itemCount = undefined;
      session.itemNumbers = [];
      session.step = 'item-source';
      await setSession(client, actorId, session);
      await sendMessage(message.chat.id, 'Все ячейки пропущены. Выбери другой способ загрузки или отмени создание.', createItemSourceKeyboard());
      return;
    }
    if (index >= items.length) {
      await finishContainerCreation(client, message.chat.id, actorId, session);
      return;
    }
    await promptDraftCatalogItem(client, message.chat.id, session, index);
    return;
  }
  if (action === 'create-next-item') {
    const session = await getSession(client, actorId);
    if (!session || session.mode !== 'create' || session.itemSource !== 'single' || session.step !== 'next-single') {
      throw new Error('Мастер не ожидает следующий предмет.');
    }
    session.step = 'item-photo';
    await setSession(client, actorId, session);
    await sendMessage(message.chat.id, `Предмет №${(session.draftItems?.length ?? 0) + 1} · отправь картинку.`, cancelKeyboard());
    return;
  }
  if (action === 'finish-create') {
    const session = await getSession(client, actorId);
    if (!session || session.mode !== 'create' || session.itemSource !== 'single' || session.step !== 'next-single') {
      throw new Error('Сначала добавь данные предмета.');
    }
    await finishContainerCreation(client, message.chat.id, actorId, session);
    return;
  }
  if (action === 'cooldown') {
    const container = (await listContainerCatalog(client)).find((entry) => entry.id === value);
    if (!container) throw new Error('Контейнер не найден.');
    await sendMessage(message.chat.id, `⏱ Режим доступа «${container.name}»\nСейчас: ${formatCooldownSeconds(container.cooldownSeconds ?? 0)}`, [
      [{ text: '♾ Без таймера', callback_data: `ct:cooldown-mode:none:${container.id}` }],
      [{ text: '📅 Ежедневный · 24 часа', callback_data: `ct:cooldown-mode:daily:${container.id}` }],
      [{ text: '⏱ Свой таймер', callback_data: `ct:cooldown-mode:custom:${container.id}` }],
      [{ text: '↩️ Карточка контейнера', callback_data: `ct:edit:${container.id}` }],
    ]);
    return;
  }
  if (action === 'cooldown-mode') {
    const container = (await listContainerCatalog(client)).find((entry) => entry.id === extra);
    if (!container) throw new Error('Контейнер не найден.');
    if (value === 'custom') {
      await setSession(client, actorId, { mode: 'edit-cooldown', containerId: container.id });
      await sendMessage(message.chat.id, 'Введи таймер в часах (например, 12 или 1,5) либо в формате «1ч 30м».', cancelKeyboard());
      return;
    }
    if (value !== 'none' && value !== 'daily') throw new Error('Неизвестный режим таймера.');
    await saveContainer(client, {
      id: container.id,
      title: container.name,
      type: container.category,
      tier: container.tier,
      price: container.price,
      sortOrder: container.order,
      description: container.description,
      icon: container.icon,
      image: container.image,
      drops: container.contents,
      cooldownSeconds: value === 'daily' ? 86_400 : 0,
    });
    return showContainerDetails(client, message.chat.id, container.id, message);
  }
  if (action === 'up' || action === 'down') {
    await moveContainer(client, value, action === 'up' ? -1 : 1);
    return showContainerDetails(client, message.chat.id, value, message);
  }
  if (action === 'edit') return showContainerDetails(client, message.chat.id, value, message);
  if (action === 'add-catalog') return showContainerItemChoices(client, message.chat.id, value);
  if (action === 'remove-drop') return showContainerDropChoices(client, message.chat.id, value);
  if (action === 'dropremove') {
    const container = (await listContainerCatalog(client)).find((entry) => entry.id === value);
    const index = Number(extra);
    if (!container || !Number.isSafeInteger(index) || index < 0 || index >= container.contents.length) {
      throw new Error('Предмет дропа изменился. Открой карточку контейнера ещё раз.');
    }
    const drops = container.contents.filter((_, current) => current !== index);
    if (!drops.length) throw new Error('В контейнере должен остаться хотя бы один предмет.');
    await saveContainer(client, {
      id: container.id,
      title: container.name,
      type: container.category,
      tier: container.tier,
      price: container.price,
      sortOrder: container.order,
      description: container.description,
      icon: container.icon,
      image: container.image,
      drops,
      cooldownSeconds: container.cooldownSeconds ?? 0,
    });
    return showContainerDetails(client, message.chat.id, container.id, message);
  }
  if (action === 'select-item') {
    const session = await getSession(client, actorId);
    if (!session || session.mode !== 'container-drop-select' || !session.containerId) {
      throw new Error('Сначала выбери контейнер, в который нужно добавить предмет.');
    }
    const item = await getCatalogItem(client, value);
    const container = (await listContainerCatalog(client)).find((entry) => entry.id === session.containerId);
    if (!item || !container || (container.category !== 'plates' && container.category !== item.type)) {
      throw new Error('Предмет не подходит для этого контейнера.');
    }
    await attachCatalogItem(client, container.id, item.id);
    await clearSession(client, actorId);
    return showContainerDetails(client, message.chat.id, container.id, message);
  }
  if (action === 'add') return showContainerItemChoices(client, message.chat.id, value);
  if (action === 'replace') {
    await sendMessage(message.chat.id, 'Убери ненужные предметы по одному, затем выбери новые позиции из каталога.', [[
      { text: '➖ Убрать предметы', callback_data: `ct:remove-drop:${value}` },
      { text: '➕ Добавить из каталога', callback_data: `ct:add-catalog:${value}` },
    ]]);
    return;
  }
  if (action === 'image') {
    await setSession(client, actorId, { mode: 'container-photo', containerId: value });
    await sendMessage(message.chat.id, 'Отправь новое фото или файл контейнера в формате PNG, JPEG или WebP.', cancelKeyboard());
    return;
  }
  if (action === 'edit-fields') return showContainerFields(client, message.chat.id, value, message);
  if (action === 'title' || action === 'price' || action === 'tier') {
    const prompts: Record<typeof action, string> = {
      title: 'Введи новое название контейнера:',
      price: 'Введи новую цену открытия в рублях (целое число):',
      tier: 'Введи новый тир (целое число от 1 до 20):',
    };
    await setSession(client, actorId, { mode: `edit-${action}`, containerId: value });
    await sendMessage(message.chat.id, prompts[action]);
    return;
  }
  if (action === 'delete') {
    const container = (await listContainerCatalog(client)).find((entry) => entry.id === value);
    if (!container) throw new Error('Контейнер не найден.');
    await editMessage(message, `Удалить «${container.name}»? Действие нельзя отменить.`, [[
      { text: '✅ Да, удалить', callback_data: `ct:confirm-delete:${container.id}` },
      { text: 'Отмена', callback_data: 'ct:list' },
    ]]);
    return;
  }
  if (action === 'confirm-delete') {
    const deleted = await deleteContainer(client, value);
    if (!deleted) throw new Error('Контейнер уже удалён.');
    await showContainerMenu(client, message.chat.id, message);
    return;
  }
  if (action === 'list') {
    const page = Number(value ?? 0);
    const totalPages = Math.max(1, Math.ceil((await listContainerCatalog(client)).length / CONTAINERS_PER_PAGE));
    await showContainerMenu(client, message.chat.id, message, Number.isSafeInteger(page) ? Math.min(Math.max(0, page), totalPages - 1) : 0);
    return;
  }
  throw new Error('Неизвестная команда меню.');
}

async function handleMessage(client: import('pg').PoolClient, message: TelegramMessage) {
  const text = message.text?.trim() ?? '';
  const userId = String(message.from?.id ?? message.chat.id);
  if (String(message.chat.id) !== userId) return;
  if (/^\/admin(?:@\w+)?(?:\s|$)/.test(text)) {
    if (userId !== adminTelegramId()) {
      await sendMessage(message.chat.id, '⛔ Доступ запрещён.');
      return;
    }
    await clearSession(client, userId);
    await showAdminHome(message.chat.id);
    return;
  }

  const session = await getSession(client, userId);
  if (!session) return;
  if (userId !== adminTelegramId()) {
    await clearSession(client, userId);
    return;
  }
  try {
    if (session.mode === 'create') {
      await processCreateMessage(client, message.chat.id, userId, session, text);
    } else if (session.mode === 'edit-title' || session.mode === 'edit-tier' || session.mode === 'edit-price' || session.mode === 'edit-cooldown') {
      await processContainerFieldEdit(client, message.chat.id, session, text);
    } else if (session.mode === 'container-photo') {
      throw new Error('Для этого шага отправь фото или JPEG/PNG/WebP-файл как вложение, не текст.');
    } else if (session.mode === 'item-create' || session.mode === 'item-field') {
      await processCatalogItemMessage(client, message.chat.id, userId, session, text);
    } else if (session.mode === 'item-photo') {
      throw new Error('Отправь JPEG/PNG/WebP-файл или фото, а не текст.');
    } else if (session.mode === 'item-attach') {
      await sendMessage(message.chat.id, 'Выбери контейнер кнопкой ниже или отмени действие.', cancelKeyboard());
    } else if (session.mode === 'season-config') {
      if (!session.targetId) throw new Error('Не найден сезон для изменения.');
      if (session.step === 'name') {
        if (text.length < 2 || text.length > 60) throw new Error('Название сезона должно содержать от 2 до 60 символов.');
        await updateSeasonSettings(client, session.targetId, 'name', text);
      } else if (session.step === 'date') {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error('Укажи дату строго в формате ГГГГ-ММ-ДД.');
        const endsAt = new Date(`${text}T23:59:59+03:00`);
        if (Number.isNaN(endsAt.getTime()) || endsAt.toISOString().slice(0, 10) !== text || endsAt.getTime() <= Date.now()) throw new Error('Дата окончания должна быть корректной и в будущем по Москве.');
        await updateSeasonSettings(client, session.targetId, 'ends_at', endsAt.toISOString());
      } else if (session.step === 'stars') {
        const amount = Number(text);
        if (!Number.isSafeInteger(amount) || amount < 1 || amount > 10_000) throw new Error('Цена должна быть целым числом Stars от 1 до 10 000.');
        await updateSeasonSettings(client, session.targetId, 'premium_price_stars', amount);
      } else {
        await sendMessage(message.chat.id, 'Используй кнопки выбора контейнера или отмени изменение.', [[{ text: '↩️ К сезону', callback_data: 'adm:season' }]]);
        return;
      }
      await clearSession(client, userId);
      await showAdminSeasonSettings(client, message.chat.id);
    } else if (session.mode === 'player-search') {
      await clearSession(client, userId);
      await showPlayerSearch(client, message.chat.id, text);
    } else if (session.mode === 'player-adjust') {
      const amount = Number(text.trim());
      if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 2_000_000_000) {
        throw new Error('Введи положительное целое число от 1 до 2 000 000 000.');
      }
      if (!session.targetId || (session.field !== 'balance' && session.field !== 'xp') || !session.direction) {
        throw new Error('Сессия изменения игрока повреждена. Открой карточку игрока заново.');
      }
      await adjustAdminPlayer(client, session.targetId, session.field, amount * session.direction);
      await clearSession(client, userId);
      await showAdminPlayer(client, message.chat.id, session.targetId);
    } else if (session.mode === 'economy-adjust') {
      const multiplier = Number(text.trim().replace(',', '.'));
      if (!Number.isFinite(multiplier)) throw new Error('Введи число от 0,1 до 2, например 0,65.');
      await updateEconomySetting(client, 'resaleMultiplier', multiplier);
      await clearSession(client, userId);
      await showEconomySettings(client, message.chat.id);
    } else if (session.mode === 'announcement-draft') {
      if (!text || text.length > 4_000) throw new Error('Текст объявления должен содержать от 1 до 4 000 символов.');
      const confirmation = { ...session, mode: 'announcement-confirm' as const, announcement: text };
      await setSession(client, userId, confirmation);
      await sendMessage(message.chat.id, `Предпросмотр объявления:\n\n${text}`, [[
        { text: '✅ Отправить всем игрокам', callback_data: 'an:send' },
        { text: '✏️ Изменить текст', callback_data: 'an:edit' },
        { text: 'Отмена', callback_data: 'adm:home' },
      ]]);
    } else if (session.mode === 'announcement-confirm') {
      if (!text || text.length > 4_000) throw new Error('Текст объявления должен содержать от 1 до 4 000 символов.');
      await setSession(client, userId, { ...session, mode: 'announcement-confirm', announcement: text });
      await sendMessage(message.chat.id, `Предпросмотр объявления:\n\n${text}`, [[
        { text: '✅ Отправить всем игрокам', callback_data: 'an:send' },
        { text: '✏️ Изменить текст', callback_data: 'an:edit' },
        { text: 'Отмена', callback_data: 'adm:home' },
      ]]);
    } else if (session.mode === 'announcement-send') {
      await sendMessage(message.chat.id, 'Рассылка ожидает действия в меню. Продолжить или остановить её можно кнопками ниже.');
    }
  } catch (failure) {
    await sendMessage(message.chat.id, `${failure instanceof Error ? failure.message : 'Не удалось сохранить контейнер.'}\n\nИсправь ввод и отправь ещё раз.`);
  }
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== 'POST') return response.status(200).json({ ok: true });
  let client: import('pg').PoolClient | undefined;
  try {
    requireTelegramSecret(request);
    client = await getPool().connect();
    const update = bodyRecord(request.body) as TelegramUpdate | undefined;
    if (!update) return sendError(response, 400, 'Invalid Telegram update.');
    await ensureContainerCatalog(client);
    await ensureAdminTables(client);
    if (update.pre_checkout_query) {
      const decision = await validatePreCheckout(client, update.pre_checkout_query);
      await telegram('answerPreCheckoutQuery', {
        pre_checkout_query_id: update.pre_checkout_query.id,
        ok: decision.ok,
        ...(!decision.ok ? { error_message: decision.errorMessage } : {}),
      });
    } else if (update.message?.successful_payment) {
      const payerId = String(update.message.from?.id ?? update.message.chat.id);
      await applySuccessfulStarsPayment(client, payerId, update.message.successful_payment);
    } else if (update.callback_query) {
      try {
        await handleCallback(client, update.callback_query);
      } catch (failure) {
        console.error('LootLand Telegram admin callback failed.', failure);
        const callbackMessage = update.callback_query.message;
        if (callbackMessage && String(update.callback_query.from.id) === adminTelegramId()) {
          await sendMessage(
            callbackMessage.chat.id,
            `Не удалось выполнить действие: ${failure instanceof Error ? failure.message : 'неизвестная ошибка'}\n\nПопробуй ещё раз или вернись в меню командой /admin.`,
            [[{ text: '🏠 Открыть главное меню', callback_data: 'adm:home' }]],
          );
        }
      }
    } else if (update.message?.photo?.length || update.message?.document) {
      const message = update.message;
      const userId = String(message.from?.id ?? message.chat.id);
      if (String(message.chat.id) === userId && userId === adminTelegramId()) {
        const session = await getSession(client, userId);
        try {
          if (!session) throw new Error('Фото не ожидается. Начни загрузку изображения из админ-меню.');
          await processContainerPhoto(client, message, session);
        } catch (failure) {
          console.error('LootLand Telegram admin photo upload failed.', failure);
          await sendMessage(
            message.chat.id,
            `${failure instanceof Error ? failure.message : 'Не удалось сохранить изображение.'}\n\nПроверь формат и попробуй отправить файл ещё раз.`,
          );
        }
      }
    } else if (update.message) await handleMessage(client, update.message);
    return response.status(200).json({ ok: true });
  } catch (failure) {
    console.error('LootLand Telegram admin webhook failed.', failure);
    const statusCode = typeof failure === 'object' && failure !== null && 'statusCode' in failure
      ? Number((failure as { statusCode?: unknown }).statusCode)
      : 500;
    return sendError(response, statusCode, failure instanceof Error ? failure.message : 'Telegram webhook failed.');
  } finally {
    client?.release();
  }
}
