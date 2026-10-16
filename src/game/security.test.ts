import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHmac } from 'node:crypto';
import { isOwnerTelegramId, verifyTelegramInitData } from '../../api/_lib/auth';
import { rankForXp } from './ranks';

const botToken = 'test-bot-token';
const previousToken = process.env.TELEGRAM_BOT_TOKEN;
const previousOwnerId = process.env.OWNER_TELEGRAM_ID;
beforeEach(() => {
  process.env.TELEGRAM_BOT_TOKEN = botToken;
  process.env.OWNER_TELEGRAM_ID = '1065784387';
});

function signedInitData(userId: number, authDate: number): string {
  const fields = new URLSearchParams({
    auth_date: String(authDate),
    query_id: 'test-query',
    signature: 'third-party-signature',
    user: JSON.stringify({ id: userId, first_name: 'Test' }),
  });
  const dataCheckString = [...fields.entries()].sort(([first], [second]) => first < second ? -1 : first > second ? 1 : 0).map(([key, value]) => `${key}=${value}`).join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = createHmac('sha256', secret).update(dataCheckString).digest('hex');
  fields.set('hash', hash);
  return fields.toString();
}

afterEach(() => {
  if (previousToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
  else process.env.TELEGRAM_BOT_TOKEN = previousToken;
  if (previousOwnerId === undefined) delete process.env.OWNER_TELEGRAM_ID;
  else process.env.OWNER_TELEGRAM_ID = previousOwnerId;
});

describe('Telegram signed initData', () => {
  it('accepts a valid, fresh signature and returns the signed Telegram ID', () => {
    const user = verifyTelegramInitData(signedInitData(1065784387, 1_800_000_000), 1_800_000_010);
    expect(user.id).toBe('1065784387');
    expect(isOwnerTelegramId(user.id)).toBe(true);
  });

  it('rejects altered data', () => {
    const altered = `${signedInitData(42, 1_800_000_000)}&query_id=forged`;
    expect(() => verifyTelegramInitData(altered, 1_800_000_010)).toThrow('Подпись Telegram не совпадает');
    const validNonOwner = verifyTelegramInitData(signedInitData(42, 1_800_000_000), 1_800_000_010);
    expect(isOwnerTelegramId(validNonOwner.id)).toBe(false);
  });

  it('rejects data older than 24 hours', () => {
    expect(() => verifyTelegramInitData(signedInitData(42, 1_800_000_000), 1_800_000_000 + 86_401)).toThrow('устарела');
  });

  it('does not grant owner role if the trusted owner setting disagrees', () => {
    process.env.OWNER_TELEGRAM_ID = '42';
    expect(isOwnerTelegramId('1065784387')).toBe(false);
    expect(isOwnerTelegramId('42')).toBe(false);
  });
});

describe('XP ranks', () => {
  it.each([
    [0, 'Новое лицо'], [99, 'Новое лицо'], [100, 'Искатель находок'],
    [500, 'Свой человек'], [1_500, 'Мастер поставок'], [4_000, 'Легенда района'],
  ])('maps %i XP to %s', (xp, title) => {
    expect(rankForXp(xp)).toBe(title);
  });
});
