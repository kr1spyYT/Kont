import type { PoolClient } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import {
  consumeGameActionRateLimit,
  getGameActionRateGroup,
  recordFinancialLedgerEntry,
} from './economySecurity.js';

const ledgerEntry = {
  telegramId: '12345',
  idempotencyKey: 'game-action:request-123',
  operationType: 'quick-sell-item',
  amountDelta: 1_000,
  balanceAfter: 4_000,
  referenceType: 'game-action',
  referenceId: 'request-123',
};

const mockClient = (query: ReturnType<typeof vi.fn>) => ({ query }) as unknown as PoolClient;

describe('economy security helpers', () => {
  it('groups sensitive actions into their own server-side rate limits', () => {
    expect(getGameActionRateGroup('open-container')).toBe('container-open');
    expect(getGameActionRateGroup('quick-sell-item')).toBe('quick-sale');
    expect(getGameActionRateGroup('quick-sell-junk')).toBe('quick-sale');
    expect(getGameActionRateGroup('list-item')).toBe('market');
    expect(getGameActionRateGroup('buy-listing')).toBe('market');
    expect(getGameActionRateGroup('set-avatar')).toBe('general');
  });

  it('writes a financial event with the action idempotency key', async () => {
    const query = vi.fn(async (_sql: string, _params?: unknown[]) => ({ rows: [{ ledger_id: '1' }], rowCount: 1 }));

    await recordFinancialLedgerEntry(mockClient(query), ledgerEntry);

    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toContain('ON CONFLICT (telegram_id, idempotency_key) DO NOTHING');
    expect(query.mock.calls[0][1]).toEqual([
      ledgerEntry.telegramId,
      ledgerEntry.idempotencyKey,
      ledgerEntry.operationType,
      ledgerEntry.amountDelta,
      ledgerEntry.balanceAfter,
      ledgerEntry.referenceType,
      ledgerEntry.referenceId,
      '{}',
    ]);
  });

  it('accepts an identical ledger replay but rejects conflicting reuse', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [{
        operation_type: ledgerEntry.operationType,
        amount_delta: ledgerEntry.amountDelta,
        balance_after: ledgerEntry.balanceAfter,
      }], rowCount: 1 });
    await expect(recordFinancialLedgerEntry(mockClient(query), ledgerEntry)).resolves.toBeUndefined();

    const conflictingQuery = vi.fn()
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [{
        operation_type: ledgerEntry.operationType,
        amount_delta: 500,
        balance_after: 3_500,
      }], rowCount: 1 });
    await expect(recordFinancialLedgerEntry(mockClient(conflictingQuery), ledgerEntry)).rejects.toThrow(/уже использован/);
  });

  it('persists an atomic rate-limit increment and allows requests below the threshold', async () => {
    const query = vi.fn(async (_sql: string, _params?: unknown[]) => ({ rows: [{ attempt_count: 1, window_started_at: new Date(), blocked_until: null }], rowCount: 1 }));

    await expect(consumeGameActionRateLimit(mockClient(query), '12345', 'quick-sale'))
      .resolves.toEqual({ allowed: true, retryAfterSeconds: 0 });
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toContain('ON CONFLICT (telegram_id, action_group) DO UPDATE');
    expect(query.mock.calls[0][0]).toContain('player_action_rate_limits.attempt_count + 1');
  });

  it('blocks over-limit requests and records a security event', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [{
        attempt_count: 13,
        window_started_at: new Date(),
        blocked_until: new Date(Date.now() + 45_000),
      }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 });

    const result = await consumeGameActionRateLimit(mockClient(query), '12345', 'quick-sale');

    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[1][0]).toContain('action_rate_limited');
  });
});
