import { timingSafeEqual } from 'node:crypto';
import type { Container, ContainerDrop, ContainerType } from '../src/types/game.js';
import { deleteContainer, ensureContainerCatalog, listContainerCatalog, moveContainer, saveContainer } from './_lib/containers.js';
import { getPool } from './_lib/db.js';
import { bodyRecord, sendError, type ApiRequest, type ApiResponse } from './_lib/http.js';
import { OWNER_TELEGRAM_ID } from './_lib/auth.js';
import { createId } from '../src/utils/id.js';
import {
  adjustAdminPlayer,
  countAnnouncementRecipients,
  ensureAdminTables,
  getAdminPlayer,
  getEconomySettings,
  listAdminListings,
  listAnnouncementRecipients,
  loadAdminAnalytics,
  moderateListing,
  searchAdminPlayers,
  setPlayerBanned,
  updateEconomySetting,
} from './_lib/admin.js';

interface TelegramChat {
  id: number;
}

interface TelegramMessage {
  message_id: number;
  chat: TelegramChat;
  from?: { id: number };
  text?: string;
  photo?: Array<{ file_id: string; width: number; height: number; file_size?: number }>;
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
}

interface AdminSession {
  mode:
    | 'create' | 'edit-add' | 'edit-replace' | 'edit-title' | 'edit-tier' | 'edit-price'
    | 'drop-photo' | 'container-photo'
    | 'player-search' | 'player-adjust' | 'economy-adjust'
    | 'announcement-draft' | 'announcement-confirm' | 'announcement-send';
  step?: string;
  containerId?: string;
  draft?: AdminDraft;
  draftDrop?: ContainerDrop;
  draftDrops?: ContainerDrop[];
  dropIndex?: number;
  targetId?: string;
  field?: 'balance' | 'xp' | 'resaleMultiplier';
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

async function storeTelegramPhoto(message: TelegramMessage): Promise<string> {
  const botToken = token();
  if (!botToken) throw new Error('TELEGRAM_BOT_TOKEN or BOT_TOKEN is not configured.');
  const photo = message.photo?.reduce((largest, current) =>
    current.width * current.height > largest.width * largest.height ? current : largest);
  if (!photo) throw new Error('Отправь изображение как фото через Telegram, а не документом.');
  if (photo.file_size && photo.file_size > 10 * 1024 * 1024) {
    throw new Error('Фото слишком большое. Отправь изображение размером до 10 МБ.');
  }
  const file = await telegramResult<{ file_path?: string }>('getFile', { file_id: photo.file_id });
  if (!file.file_path) throw new Error('Telegram не вернул путь к фотографии. Попробуй отправить фото ещё раз.');
  const response = await fetch(`https://api.telegram.org/file/bot${botToken}/${file.file_path}`);
  if (!response.ok) throw new Error(`Не удалось скачать фото из Telegram (${response.status}).`);
  const image = Buffer.from(await response.arrayBuffer());
  if (!image.length || image.length > 10 * 1024 * 1024) throw new Error('Размер фото должен быть не больше 10 МБ.');
  const contentType = response.headers.get('content-type')?.split(';')[0] ?? 'image/jpeg';
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(contentType)) {
    throw new Error('Поддерживаются фото JPEG, PNG или WebP.');
  }
  const assetId = createId('asset');
  await getPool().query(`
    CREATE TABLE IF NOT EXISTS game_assets (
      id TEXT PRIMARY KEY,
      content_type TEXT NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp')),
      image_data BYTEA NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await getPool().query(
    `INSERT INTO game_assets (id, content_type, image_data)
     VALUES ($1, $2, $3)`,
    [assetId, contentType, image],
  );
  return `/api/assets/${assetId}`;
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

const createPrompts: Record<string, string> = {
  id: 'Введи короткий ID латиницей и дефисами (например, premium-box):',
  title: 'Введи название контейнера:',
  tier: 'Введи тир контейнера (целое число от 1 до 20):',
  price: 'Введи цену открытия в рублях (целое число, 0 или больше):',
  description: 'Введи короткое описание:',
  icon: 'Введи короткую эмодзи-иконку контейнера (например, 📦):',
  image: 'Теперь отправь фото контейнера именно как фото в Telegram (не документом).',
  drops: 'Отправь JSON-массив предметов контейнера. После этого бот попросит отдельное фото для каждого предмета.\nПример одежды:\n[{"name":"Кепка","icon":"🧢","rarity":"common","basePrice":1200,"respect":2,"slot":"head","weight":50}]\nДля машины укажи "slot":"car"; для номера поле slot не нужно.',
};

async function beginCreate(client: import('pg').PoolClient, userId: string, chatId: number) {
  await setSession(client, userId, { mode: 'create', step: 'id', draft: {} });
  await sendMessage(chatId, `Создание контейнера.\n${createPrompts.id}`);
}

async function processCreateMessage(client: import('pg').PoolClient, chatId: number, session: AdminSession, text: string) {
  const draft = { ...session.draft };
  switch (session.step) {
    case 'id':
      draft.id = text.trim().toLowerCase();
      session.step = 'title';
      break;
    case 'title':
      draft.title = text.trim();
      session.step = 'type';
      await setSession(client, String(chatId), { ...session, draft });
      await sendMessage(chatId, 'Выбери тип контейнера:', [[
        { text: 'Одежда', callback_data: 'ct:type:clothing' },
        { text: 'Машины', callback_data: 'ct:type:car' },
        { text: 'Номера', callback_data: 'ct:type:plates' },
      ]]);
      return;
    case 'tier':
      draft.tier = Number(text.trim());
      session.step = 'price';
      break;
    case 'price':
      draft.price = Number(text.trim());
      session.step = 'description';
      break;
    case 'description':
      draft.description = text.trim();
      session.step = 'icon';
      break;
    case 'icon':
      draft.icon = text.trim();
      session.step = 'image';
      break;
    case 'image':
      throw new Error('Для изображения контейнера отправь фото как вложение Telegram.');
    case 'drops': {
      const drops: unknown = JSON.parse(text);
      if (!Array.isArray(drops)) throw new Error('Список дропа должен быть JSON-массивом.');
      if (!drops.every((drop) => typeof drop === 'object' && drop !== null && !Array.isArray(drop))) {
        throw new Error('Каждый предмет должен быть JSON-объектом.');
      }
      const draftDrops = drops.map((drop) => ({ ...(drop as ContainerDrop), image: '' }));
      await setSession(client, String(chatId), { ...session, mode: 'drop-photo', step: 'create', draft, draftDrops, dropIndex: 0 });
      await promptDropPhoto(chatId, draftDrops, 0);
      return;
    }
    default:
      throw new Error('Шаг диалога не распознан. Начни заново командой /admin.');
  }
  await setSession(client, String(chatId), { ...session, draft });
  await sendMessage(chatId, createPrompts[session.step ?? ''] ?? 'Продолжай ввод.');
}

async function processDropEdit(client: import('pg').PoolClient, chatId: number, session: AdminSession, text: string) {
  const parsed: unknown = JSON.parse(text);
  const isAdd = session.mode === 'edit-add';
  if (isAdd && (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))) {
    throw new Error('Для добавления отправь JSON-объект одного предмета.');
  }
  if (!isAdd && !Array.isArray(parsed)) throw new Error('Для замены отправь JSON-массив предметов.');
  const rawDrops = isAdd ? [parsed] : parsed as unknown[];
  if (!rawDrops.every((drop) => typeof drop === 'object' && drop !== null && !Array.isArray(drop))) {
    throw new Error('Каждый предмет должен быть JSON-объектом.');
  }
  const draftDrops = rawDrops.map((drop) => ({ ...(drop as ContainerDrop), image: '' }));
  await setSession(client, String(chatId), {
    mode: 'drop-photo',
    step: isAdd ? 'add' : 'replace',
    containerId: session.containerId,
    draftDrops,
    dropIndex: 0,
  });
  await promptDropPhoto(chatId, draftDrops, 0);
}

async function promptDropPhoto(chatId: number, drops: ContainerDrop[], index: number) {
  const drop = drops[index];
  await sendMessage(
    chatId,
    `Отправь фото предмета ${index + 1} из ${drops.length}: «${drop.name || 'без названия'}».\nИменно фото, не документ.`,
  );
}

async function processContainerPhoto(client: import('pg').PoolClient, message: TelegramMessage, session: AdminSession) {
  const chatId = message.chat.id;
  const userId = String(message.from?.id ?? chatId);
  const image = await storeTelegramPhoto(message);

  if (session.mode === 'create' && session.step === 'image') {
    const draft = { ...session.draft, image };
    await setSession(client, userId, { ...session, draft, step: 'drops' });
    await sendMessage(chatId, createPrompts.drops);
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
    });
    await clearSession(client, userId);
    await sendMessage(chatId, `✅ Фото контейнера «${container.name}» обновлено.`);
    await showContainerMenu(client, chatId);
    return;
  }

  if (session.mode !== 'drop-photo' || !session.draftDrops?.length) {
    throw new Error('Сейчас фото не ожидается. Открой редактирование контейнера и начни добавление предмета заново.');
  }
  const drops = [...session.draftDrops];
  const index = session.dropIndex ?? 0;
  if (index < 0 || index >= drops.length) throw new Error('Шаг загрузки фото потерян. Начни изменение дропа заново.');
  drops[index] = { ...drops[index], image };
  const nextIndex = index + 1;
  if (nextIndex < drops.length) {
    await setSession(client, userId, { ...session, draftDrops: drops, dropIndex: nextIndex });
    await promptDropPhoto(chatId, drops, nextIndex);
    return;
  }

  if (session.step === 'create') {
    const draft = session.draft;
    if (!draft) throw new Error('Данные контейнера потеряны. Начни создание заново.');
    const containers = await listContainerCatalog(client);
    const sortOrder = Math.max(0, ...containers.map((container) => container.order)) + 1;
    await saveContainer(client, {
      id: draft.id ?? '',
      title: draft.title ?? '',
      type: draft.type ?? 'clothing',
      tier: draft.tier ?? 0,
      price: draft.price ?? -1,
      sortOrder,
      description: draft.description ?? '',
      icon: draft.icon ?? '',
      image: draft.image ?? '',
      drops,
    });
    await clearSession(client, userId);
    await sendMessage(chatId, `✅ Контейнер «${draft.title}» создан и опубликован.`);
    await showContainerMenu(client, chatId);
    return;
  }

  const container = (await listContainerCatalog(client)).find((entry) => entry.id === session.containerId);
  if (!container) throw new Error('Контейнер не найден.');
  const updatedDrops = session.step === 'add' ? [...container.contents, ...drops] : drops;
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
    drops: updatedDrops,
  });
  await clearSession(client, userId);
  await sendMessage(chatId, `✅ Фото и дроп контейнера «${container.name}» обновлены (${updatedDrops.length} предметов).`);
  await showContainerMenu(client, chatId);
}

async function processContainerFieldEdit(client: import('pg').PoolClient, chatId: number, session: AdminSession, text: string) {
  const container = (await listContainerCatalog(client)).find((entry) => entry.id === session.containerId);
  if (!container) throw new Error('Контейнер не найден.');
  const updates = {
    title: session.mode === 'edit-title' ? text.trim() : container.name,
    price: session.mode === 'edit-price' ? Number(text.trim()) : container.price,
    tier: session.mode === 'edit-tier' ? Number(text.trim()) : container.tier,
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
  });
  await clearSession(client, String(chatId));
  await sendMessage(chatId, `✅ Параметры контейнера «${updates.title}» обновлены.`);
  await showContainerMenu(client, chatId);
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
    '• Контейнеры — каталог и состав дропа',
  ].join('\n');
  if (message) await editMessage(message, text, adminHomeKeyboard());
  else await sendMessage(chatId, text, adminHomeKeyboard());
}

const playerDisplayName = (player: { first_name: string; last_name: string | null; username: string | null }) =>
  [player.first_name, player.last_name].filter(Boolean).join(' ') || player.username || 'Игрок';

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
  const [section, action, value] = data.split(':');
  if (section === 'adm') {
    if (action === 'home') {
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
    if (action === 'announcement') {
      await setSession(client, actorId, { mode: 'announcement-draft' });
      await sendMessage(message.chat.id, '📢 Отправь текст объявления для игроков. Пока текст не подтверждён, он никому не отправится.', [[
        { text: 'Отмена', callback_data: 'adm:home' },
      ]]);
      return;
    }
  }
  if (section === 'pl') {
    if (action === 'view') return showAdminPlayer(client, message.chat.id, value, message);
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
    session.draft = { ...session.draft, type: value as ContainerType };
    session.step = 'tier';
    await setSession(client, actorId, session);
    await sendMessage(message.chat.id, createPrompts.tier);
    return;
  }
  if (action === 'up' || action === 'down') {
    await moveContainer(client, value, action === 'up' ? -1 : 1);
    await showContainerMenu(client, message.chat.id, message);
    return;
  }
  if (action === 'edit') {
    const container = (await listContainerCatalog(client)).find((entry) => entry.id === value);
    if (!container) throw new Error('Контейнер не найден.');
    await editMessage(message, `✏️ ${container.name}\nПредметов в дропе: ${container.contents.length}`, [
      [{ text: '📝 Изменить название', callback_data: `ct:title:${container.id}` }],
      [{ text: '💰 Изменить цену', callback_data: `ct:price:${container.id}` }],
      [{ text: '🏷 Изменить тир', callback_data: `ct:tier:${container.id}` }],
      [{ text: '🖼 Изменить фото', callback_data: `ct:image:${container.id}` }],
      [{ text: '➕ Добавить предмет', callback_data: `ct:add:${container.id}` }],
      [{ text: '🔄 Заменить дроп-лист', callback_data: `ct:replace:${container.id}` }],
      [{ text: '↩️ К списку', callback_data: 'ct:list' }],
    ]);
    return;
  }
  if (action === 'add' || action === 'replace') {
    const session: AdminSession = { mode: action === 'add' ? 'edit-add' : 'edit-replace', containerId: value };
    await setSession(client, actorId, session);
    await sendMessage(message.chat.id, action === 'add'
      ? 'Отправь один предмет дропа как JSON-объект.'
      : 'Отправь новый список дропа как JSON-массив.');
    return;
  }
  if (action === 'image') {
    await setSession(client, actorId, { mode: 'container-photo', containerId: value });
    await sendMessage(message.chat.id, 'Отправь новое фото контейнера как фото Telegram (не документом).');
    return;
  }
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
      await processCreateMessage(client, message.chat.id, session, text);
    } else if (session.mode === 'edit-add' || session.mode === 'edit-replace') {
      await processDropEdit(client, message.chat.id, session, text);
    } else if (session.mode === 'edit-title' || session.mode === 'edit-tier' || session.mode === 'edit-price') {
      await processContainerFieldEdit(client, message.chat.id, session, text);
    } else if (session.mode === 'drop-photo' || session.mode === 'container-photo') {
      throw new Error('Для этого шага нужно отправить фото как вложение, не текст.');
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
    if (update.callback_query) {
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
    } else if (update.message?.photo?.length) {
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
            `${failure instanceof Error ? failure.message : 'Не удалось сохранить фото.'}\n\nПроверь, что отправляешь фото, а не документ, и попробуй ещё раз.`,
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
