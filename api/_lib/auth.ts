import { createHmac, timingSafeEqual } from 'node:crypto';
import type { AuthenticatedPlayer } from '../../src/types/server.js';

const MAX_INIT_DATA_AGE_SECONDS = 24 * 60 * 60;

export class AuthenticationError extends Error {}

export function verifyTelegramInitData(initData: string, nowSeconds = Math.floor(Date.now() / 1000)): AuthenticatedPlayer {
  const botToken = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN;
  if (!botToken) throw new Error('На сервере не настроен TELEGRAM_BOT_TOKEN или BOT_TOKEN.');
  if (!initData || initData.length > 16_384) throw new AuthenticationError('Открой игру через Telegram, чтобы войти.');

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  const authDate = Number(params.get('auth_date'));
  const userRaw = params.get('user');
  if (!hash || !/^[a-f0-9]{64}$/i.test(hash) || !Number.isFinite(authDate) || !userRaw) {
    throw new AuthenticationError('Данные Telegram повреждены. Перезапусти игру из бота.');
  }
  if (authDate > nowSeconds + 60 || nowSeconds - authDate > MAX_INIT_DATA_AGE_SECONDS) {
    throw new AuthenticationError('Сессия Telegram устарела. Перезапусти игру из бота.');
  }

  const checkString = [...params.entries()]
    .filter(([key]) => key !== 'hash')
    .sort(([first], [second]) => first < second ? -1 : first > second ? 1 : 0)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expected = createHmac('sha256', secretKey).update(checkString).digest();
  const provided = Buffer.from(hash, 'hex');
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    throw new AuthenticationError('Подпись Telegram не совпадает. Перезапусти игру.');
  }

  let user: Record<string, unknown>;
  try {
    const decoded: unknown = JSON.parse(userRaw);
    if (typeof decoded !== 'object' || decoded === null || Array.isArray(decoded)) throw new Error();
    user = decoded as Record<string, unknown>;
  } catch {
    throw new AuthenticationError('Профиль Telegram имеет неверный формат.');
  }
  if (!Number.isSafeInteger(user.id) || Number(user.id) <= 0) throw new AuthenticationError('Не удалось подтвердить Telegram ID.');
  const firstName = typeof user.first_name === 'string' && user.first_name.trim() ? user.first_name.trim() : 'Игрок';
  return {
    id: String(user.id),
    firstName,
    lastName: typeof user.last_name === 'string' ? user.last_name : undefined,
    username: typeof user.username === 'string' ? user.username : undefined,
  };
}

export const OWNER_TELEGRAM_ID = '1065784387';

export function isOwnerTelegramId(telegramId: string): boolean {
  const configuredOwnerId = process.env.OWNER_TELEGRAM_ID || OWNER_TELEGRAM_ID;
  return telegramId === OWNER_TELEGRAM_ID && configuredOwnerId === OWNER_TELEGRAM_ID;
}
