import type { ApiEnvelope, ActionResponse, AuthenticatedPlayer, ContainerCatalog, GameAction, GameUpdate, LeaderboardEntry, LeaderboardMetric, MarketSnapshot, PlayerSnapshot, PublicPlayerProfile, SeasonInvoiceResponse, SeasonPassSnapshot, SeasonRewardClaimResponse } from '../types/server';

export const isServerGame = import.meta.env.VITE_GAME_MODE === 'server' || (import.meta.env.PROD && import.meta.env.VITE_GAME_MODE !== 'demo');

export const getTelegramInitData = (): string =>
  typeof window === 'undefined' ? '' : window.Telegram?.WebApp?.initData ?? '';

export const getDemoUser = (): AuthenticatedPlayer => {
  const user = typeof window === 'undefined' ? undefined : window.Telegram?.WebApp?.initDataUnsafe?.user;
  const id = typeof user?.id === 'number' ? String(user.id) : 'demo-player';
  return {
    id,
    firstName: user?.first_name ?? 'Игрок',
    lastName: user?.last_name,
    username: user?.username,
    photoUrl: user?.photo_url,
  };
};

const API_TIMEOUT_MS = 15_000;

async function post<T>(path: string, body: Record<string, unknown> = {}): Promise<T> {
  const initData = getTelegramInitData();
  if (!initData) throw new Error('Не получены проверяемые данные Telegram. Открой игру из бота.');
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    const response = await fetch(path, {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, initData }),
      signal: controller.signal,
    });
    const payload = await response.json() as ApiEnvelope<T>;
    if (!response.ok || !payload.ok || payload.data === undefined) throw new Error(payload.error ?? 'Серверная игра временно недоступна.');
    return payload.data;
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

const isTransientNetworkError = (error: unknown): boolean =>
  error instanceof TypeError || (error instanceof Error && ['AbortError', 'NetworkError'].includes(error.name));

export const loadServerPlayer = () => post<PlayerSnapshot>('/api/player');
export const loadServerContainers = () => post<ContainerCatalog>('/api/containers');
export const sendServerAction = async (action: GameAction): Promise<ActionResponse> => {
  try {
    return await post<ActionResponse>('/api/action', { action });
  } catch (error) {
    if (!isTransientNetworkError(error)) throw error;
    // Retry the identical idempotent action request, preserving its requestId.
    return post<ActionResponse>('/api/action', { action });
  }
};
export const loadServerMarket = () => post<MarketSnapshot>('/api/market');
export const loadServerLeaderboard = (metric: LeaderboardMetric) =>
  post<{ entries: LeaderboardEntry[]; currentPosition: number }>('/api/leaderboard', { metric });
export const loadServerPublicProfile = (telegramId: string) =>
  post<PublicPlayerProfile>('/api/profile', { telegramId });
export const loadUnseenGameUpdates = () => post<GameUpdate[]>('/api/updates', { action: 'list' });
export const markGameUpdateSeen = (updateId: string) =>
  post<{ acknowledged: boolean }>('/api/updates', { action: 'acknowledge', updateId });
export const loadServerSeason = () => post<SeasonPassSnapshot>('/api/season', { action: 'list' });
export const createServerSeasonInvoice = () => post<SeasonInvoiceResponse>('/api/season', { action: 'invoice' });
export const claimServerSeasonReward = (level: number, track: 'free' | 'premium') =>
  post<SeasonRewardClaimResponse>('/api/season', { action: 'claim', level, track });
export const claimServerSeasonContract = (contractId: string) =>
  post<SeasonRewardClaimResponse>('/api/season', { action: 'claim-contract', contractId });

export const openTelegramInvoice = (url: string): Promise<'paid' | 'cancelled' | 'failed' | undefined> => {
  const openInvoice = typeof window === 'undefined' ? undefined : window.Telegram?.WebApp?.openInvoice;
  if (!openInvoice) return Promise.resolve(undefined);
  return new Promise((resolve) => openInvoice(url, resolve));
};
