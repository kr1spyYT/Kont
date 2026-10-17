import { timingSafeEqual } from 'node:crypto';
import type { Container, ContainerDrop, ContainerType } from '../src/types/game.js';
import { deleteContainer, ensureContainerCatalog, listContainerCatalog, moveContainer, saveContainer } from './_lib/containers.js';
import { getPool } from './_lib/db.js';
import { bodyRecord, sendError, type ApiRequest, type ApiResponse } from './_lib/http.js';
import { OWNER_TELEGRAM_ID } from './_lib/auth.js';

interface TelegramChat {
  id: number;
}

interface TelegramMessage {
  message_id: number;
  chat: TelegramChat;
  from?: { id: number };
  text?: string;
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
  mode: 'create' | 'edit-add' | 'edit-replace' | 'edit-title' | 'edit-tier' | 'edit-price';
  step?: string;
  containerId?: string;
  draft?: AdminDraft;
}

interface TelegramApiResponse {
  ok: boolean;
  description?: string;
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
  const botToken = token();
  if (!botToken) throw new Error('TELEGRAM_BOT_TOKEN or BOT_TOKEN is not configured.');
  const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const result = await response.json() as TelegramApiResponse;
  if (!response.ok || !result.ok) throw new Error(`Telegram ${method} failed: ${result.description ?? response.statusText}`);
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
  await telegram('editMessageText', {
    chat_id: message.chat.id,
    message_id: message.message_id,
    text,
    ...(rows ? { reply_markup: inlineKeyboard(rows) } : {}),
  });
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
    ? `📦 Каталог поставок (${containers.length}) · страница ${page + 1}\n\n${containers.slice(page * CONTAINERS_PER_PAGE, (page + 1) * CONTAINERS_PER_PAGE).map(containerLabel).join('\n\n')}`
    : '📦 Каталог пуст. Создай первый контейнер.';
  if (edit) await editMessage(edit, text, containerMenu(containers, page));
  else await sendMessage(chatId, text, containerMenu(containers, page));
}

const createPrompts: Record<string, string> = {
  id: 'Введи короткий ID латиницей и дефисами (например, premium-box):',
  title: 'Введи название контейнера:',
  tier: 'Введи тир контейнера (целое число от 1 до 20):',
  price: 'Введи цену открытия в рублях (целое число, 0 или больше):',
  description: 'Введи короткое описание:',
  icon: 'Введи эмодзи-иконку контейнера:',
  image: 'Введи путь к изображению внутри игры (например, containers/second.png):',
  drops: 'Отправь JSON-массив доступных предметов. Вес weight задаёт относительный шанс выпадения; без weight используется стандартный вес редкости.\nПример:\n[{"name":"Кепка","icon":"🧢","image":"items/cap.png","rarity":"common","basePrice":1200,"respect":2,"slot":"head","weight":50}]',
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
      draft.image = text.trim().replace(/^\/+/, '');
      session.step = 'drops';
      break;
    case 'drops': {
      const drops: unknown = JSON.parse(text);
      if (!Array.isArray(drops)) throw new Error('Список дропа должен быть JSON-массивом.');
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
        drops: drops as ContainerDrop[],
      });
      await clearSession(client, String(chatId));
      await sendMessage(chatId, `✅ Контейнер «${draft.title}» создан и опубликован.`);
      await showContainerMenu(client, chatId);
      return;
    }
    default:
      throw new Error('Шаг диалога не распознан. Начни заново командой /admin.');
  }
  await setSession(client, String(chatId), { ...session, draft });
  await sendMessage(chatId, createPrompts[session.step ?? ''] ?? 'Продолжай ввод.');
}

async function processDropEdit(client: import('pg').PoolClient, chatId: number, session: AdminSession, text: string) {
  const container = (await listContainerCatalog(client)).find((entry) => entry.id === session.containerId);
  if (!container) throw new Error('Контейнер не найден.');
  const parsed: unknown = JSON.parse(text);
  if (!Array.isArray(parsed) && session.mode === 'edit-replace') throw new Error('Для замены отправь JSON-массив предметов.');
  const drops = session.mode === 'edit-add'
    ? [...container.contents, parsed as ContainerDrop]
    : parsed as ContainerDrop[];
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
  });
  await clearSession(client, String(chatId));
  await sendMessage(chatId, `✅ Список дропа контейнера «${container.name}» обновлён (${drops.length} предметов).`);
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
  const [, action, value] = data.split(':');
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
    await sendMessage(message.chat.id, '🔐 Админ-панель LootLand', [
      [{ text: '📦 Управление контейнерами', callback_data: 'ct:list' }],
    ]);
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
    } else {
      await processContainerFieldEdit(client, message.chat.id, session, text);
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
    if (update.callback_query) await handleCallback(client, update.callback_query);
    else if (update.message) await handleMessage(client, update.message);
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
