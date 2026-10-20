import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ActionResponse, GameAction } from '../types/server';
import { loadServerContainers, sendServerAction } from './client';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('loadServerContainers retry behavior', () => {
  it('retries transient network failures before reporting a catalog error', async () => {
    const catalog = [{ id: 'case-1' }];
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError('Load failed'))
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, data: catalog }) });
    vi.stubGlobal('window', { Telegram: { WebApp: { initData: 'verified-init-data' } } });
    vi.stubGlobal('fetch', fetchMock);
    vi.useFakeTimers();

    const request = loadServerContainers();
    await vi.advanceTimersByTimeAsync(250);

    await expect(request).resolves.toEqual(catalog);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('sendServerAction retry behavior', () => {
  it('retries a transient network failure with the same idempotency requestId', async () => {
    const action: GameAction = { type: 'quick-sell-item', itemId: 'item-1', requestId: 'sale-request-1' };
    const response = { snapshot: {} } as ActionResponse;
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError('network disconnected'))
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, data: response }) });
    vi.stubGlobal('window', { Telegram: { WebApp: { initData: 'verified-init-data' } } });
    vi.stubGlobal('fetch', fetchMock);

    await expect(sendServerAction(action)).resolves.toBe(response);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const calls = fetchMock.mock.calls as Array<[RequestInfo | URL, RequestInit?]>;
    expect(JSON.parse(String(calls[0][1]?.body)).action.requestId).toBe('sale-request-1');
    expect(JSON.parse(String(calls[1][1]?.body)).action.requestId).toBe('sale-request-1');
  });

  it('does not retry an application-level rejection', async () => {
    const action: GameAction = { type: 'quick-sell-item', itemId: 'item-1', requestId: 'sale-request-2' };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ ok: false, error: 'Предмет нельзя продать.' }),
    });
    vi.stubGlobal('window', { Telegram: { WebApp: { initData: 'verified-init-data' } } });
    vi.stubGlobal('fetch', fetchMock);

    await expect(sendServerAction(action)).rejects.toThrow('Предмет нельзя продать.');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
