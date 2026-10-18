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

async function post<T>(path: string, body: Record<string, unknown> = {}): Promise<T> {
  const initData = getTelegramInitData();
  if (!initData) throw new Error('Не получены проверяемые данные Telegram. Открой игру из бота.');
  const response = await fetch(path, {
    method: 'POST',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, initData }),
  });
  const payload = await response.json() as ApiEnvelope<T>;
  if (!response.ok || !payload.ok || payload.data === undefined) throw new Error(payload.error ?? 'Серверная игра временно недоступна.');
  return payload.data;
}

export const loadServerPlayer = () => post<PlayerSnapshot>('/api/player');
export const loadServerContainers = () => post<ContainerCatalog>('/api/containers');
export const sendServerAction = (action: GameAction) => post<ActionResponse>('/api/action', { action });
export const loadServerMarket = () => post<MarketSnapshot>('/api/market');
export const loadServerLeaderboard = (metric: LeaderboardMetric) =>
  post<{ entries: LeaderboardEntry[]; currentPosition: number }>('/api/leaderboard', { metric });
export const loadServerPublicProfile = (telegramId: string) =>
  post<PublicPlayerProfile>('/api/profile', { telegramId });
export const loadUnseenGameUpdates = () => post<GameUpdate[]>('/api/updates', { action: 'list' });
export const markGameUpdateSeen = (updateId: string) =>
  post<{ acknowledged: boolean }>('/api/updates', { action: 'acknowledge', updateId });
export const publishGameUpdate = (title: string, body: string) =>
  post<GameUpdate>('/api/updates', { action: 'publish', title, body });
export const loadServerSeason = () => post<SeasonPassSnapshot>('/api/season', { action: 'list' });
export const createServerSeasonInvoice = () => post<SeasonInvoiceResponse>('/api/season', { action: 'invoice' });
export const claimServerSeasonReward = (level: number, track: 'free' | 'premium') =>
  post<SeasonRewardClaimResponse>('/api/season', { action: 'claim', level, track });

export const openTelegramInvoice = (url: string): Promise<'paid' | 'cancelled' | 'failed' | undefined> => {
  const openInvoice = typeof window === 'undefined' ? undefined : window.Telegram?.WebApp?.openInvoice;
  if (!openInvoice) return Promise.resolve(undefined);
  return new Promise((resolve) => openInvoice(url, resolve));
};
