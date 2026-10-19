import { describe, expect, it, vi } from 'vitest';
import { ensureSeasonTables, getPlayerPremiumPass, isSameStarsPaymentReplay, setPlayerPremiumPass, updateSeasonReward, validateStarsPayment } from './season';
import type { PoolClient } from 'pg';
import type { StarsPayment } from './season';

const invoice = { invoice_payload: 'season-pass:test:123:invoice-1', telegram_id: '123', stars_amount: 250 };
const payment: StarsPayment = {
  invoice_payload: invoice.invoice_payload,
  currency: 'XTR',
  total_amount: 250,
  telegram_payment_charge_id: 'charge-1',
};

describe('Telegram Stars season payments', () => {
  it('accepts only the exact XTR amount, payload, payer, and charge', () => {
    expect(validateStarsPayment(invoice, payment, '123')).toBe(true);
    expect(validateStarsPayment(invoice, { ...payment, currency: 'USD' }, '123')).toBe(false);
    expect(validateStarsPayment(invoice, { ...payment, total_amount: 249 }, '123')).toBe(false);
    expect(validateStarsPayment(invoice, { ...payment, invoice_payload: 'other' }, '123')).toBe(false);
    expect(validateStarsPayment(invoice, payment, '999')).toBe(false);
    expect(validateStarsPayment(invoice, { ...payment, telegram_payment_charge_id: '' }, '123')).toBe(false);
  });

  it('treats a repeated Telegram update as idempotent only for the same charge owner and invoice', () => {
    expect(isSameStarsPaymentReplay({ telegram_id: '123', invoice_payload: invoice.invoice_payload }, '123', payment)).toBe(true);
    expect(isSameStarsPaymentReplay({ telegram_id: '999', invoice_payload: invoice.invoice_payload }, '123', payment)).toBe(false);
    expect(isSameStarsPaymentReplay({ telegram_id: '123', invoice_payload: 'other' }, '123', payment)).toBe(false);
  });
});

describe('season reward configuration', () => {
  it('persists a simple currency reward without a hand-written JSON payload', async () => {
    const statements: Array<{ text: string; values?: unknown[] }> = [];
    const client = {
      query: async (text: string, values?: unknown[]) => {
        statements.push({ text, values });
        return { rows: [], rowCount: 1 };
      },
    } as unknown as PoolClient;

    await updateSeasonReward(client, 'season-1-genesis', {
      level: 4, track: 'free', type: 'coins', amount: 1_500,
    });

    const save = statements.find(({ text }) => text.includes('INSERT INTO season_pass_rewards') && text.includes('VALUES ($1, $2, $3'));
    expect(save?.values?.slice(0, 6)).toEqual(['season-1-genesis', 4, 'free', 'coins', 1_500, null]);
    expect(String(save?.values?.[6]).replace(/\u00a0/g, ' ')).toBe('1 500 ₽');
    expect(save?.values?.[7]).toBe('Игровая валюта');
  });
});

describe('season VIP access', () => {
  it('grants and revokes the existing Stars premium-pass flag', async () => {
    const statements: Array<{ text: string; values?: unknown[] }> = [];
    const client = {
      query: async (text: string, values?: unknown[]) => {
        statements.push({ text, values });
        if (text.includes('SELECT season_id, name, ends_at')) {
          return { rows: [{ season_id: 'season-1-genesis', name: 'Genesis', ends_at: new Date('2026-12-01T00:00:00Z'), premium_price_stars: 250, limited_container_id: null, is_active: true }], rowCount: 1 };
        }
        return { rows: [], rowCount: 1 };
      },
    } as unknown as PoolClient;

    await setPlayerPremiumPass(client, 'player-1', true);
    await setPlayerPremiumPass(client, 'player-1', false);
    const writes = statements.filter(({ text }) => text.includes('INSERT INTO player_season_progress (telegram_id, season_id, is_premium_pass)'));
    expect(writes.map(({ values }) => values)).toEqual([
      ['player-1', 'season-1-genesis', true],
      ['player-1', 'season-1-genesis', false],
    ]);
    expect(writes[0].text).toContain('ON CONFLICT (telegram_id, season_id) DO UPDATE');
  });

  it('reads the same active pass flag for own and public profile data', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ is_premium_pass: true }] });
    const client = { query } as unknown as PoolClient;
    await expect(getPlayerPremiumPass(client, 'player-1')).resolves.toBe(true);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('progress.is_premium_pass'), ['player-1']);
  });
});

describe('season date defaults', () => {
  it('stores a start time and fills missing end dates 30 days later', async () => {
    const statements: string[] = [];
    const client = {
      query: async (text: string) => {
        statements.push(text);
        return { rows: [], rowCount: 1 };
      },
    } as unknown as PoolClient;

    await ensureSeasonTables(client);

    expect(statements[0]).toContain('starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW()');
    expect(statements[0]).toContain("ends_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days')");
    expect(statements).toContain("UPDATE game_seasons SET ends_at = starts_at + INTERVAL '30 days' WHERE ends_at IS NULL");
  });
});
