export const SEASON_PASS_LEVELS = 30;
export const SEASON_PASS_XP_PER_LEVEL = 100;
export const SEASON_PASS_ID = 'season-1-genesis';
export const SEASON_PASS_PRICE_STARS = 250;
export const SEASON_PASS_QUICK_SELL_XP = 10;

export type SeasonTrack = 'free' | 'premium';
export type SeasonRewardType = 'coins' | 'container' | 'item' | 'xp' | 'frame' | 'keys';

export interface SeasonReward {
  type: SeasonRewardType;
  amount: number;
  title: string;
  description: string;
  refId?: string;
  image?: string;
  icon?: string;
}

export interface SeasonTier {
  level: number;
  xpRequired: number;
  free: SeasonReward;
  premium: SeasonReward;
}

const reward = (
  type: SeasonRewardType,
  amount: number,
  title: string,
  description: string,
  refId?: string,
): SeasonReward => ({ type, amount, title, description, ...(refId ? { refId } : {}) });

const freeRewardAt = (level: number): SeasonReward => {
  const cycle = Math.floor((level - 1) / 10);
  switch ((level - 1) % 10) {
    case 0: return reward('coins', 500 + cycle * 500, `${(500 + cycle * 500).toLocaleString('ru-RU')} ₽`, 'Игровая валюта');
    case 1: return reward('keys', 1 + cycle, `Ключ ×${1 + cycle}`, 'Для открытия контейнеров');
    case 2: return reward('container', 1, 'Обычный кейс', 'Билет на бесплатное открытие', 'second-hand-bale');
    case 3: return reward('coins', 750 + cycle * 750, `${(750 + cycle * 750).toLocaleString('ru-RU')} ₽`, 'Игровая валюта');
    case 4: return reward('keys', 1 + cycle, `Ключ ×${1 + cycle}`, 'Для открытия контейнеров');
    case 5: return reward('xp', 1_000 + cycle * 500, `${(1_000 + cycle * 500).toLocaleString('ru-RU')} XP`, 'Опыт сезона');
    case 6: return reward('container', 1, 'Редкий кейс', 'Билет на бесплатное открытие', 'hype-box');
    case 7: return reward('coins', 1_000 + cycle * 1_000, `${(1_000 + cycle * 1_000).toLocaleString('ru-RU')} ₽`, 'Игровая валюта');
    case 8: return reward('keys', 2 + cycle, `Ключ ×${2 + cycle}`, 'Для открытия контейнеров');
    default: return reward('xp', 1_500 + cycle * 500, `${(1_500 + cycle * 500).toLocaleString('ru-RU')} XP`, 'Опыт сезона');
  }
};

const premiumRewardAt = (level: number, limitedCaseTitle: string): SeasonReward => {
  if (level === 20) return reward('frame', 1, 'SEASON 01 // VIP', 'Эксклюзивная рамка госномера', 'season-01-vip');
  if (level === 30) return reward('container', 1, limitedCaseTitle, 'Лимитированный кейс сезона');
  const cycle = Math.floor((level - 1) / 10);
  switch ((level - 1) % 10) {
    case 0: return reward('container', 1, 'Премиум кейс', 'Билет на бесплатное открытие', 'tokyo-archive');
    case 1: return reward('keys', 2 + cycle, `Ключ ×${2 + cycle}`, 'Для открытия контейнеров');
    case 2: return reward('coins', 1_000 + cycle * 1_000, `${(1_000 + cycle * 1_000).toLocaleString('ru-RU')} ₽`, 'Игровая валюта');
    case 3: return reward('xp', 2_500 + cycle * 500, `${(2_500 + cycle * 500).toLocaleString('ru-RU')} XP`, 'Опыт сезона');
    case 4: return reward('container', 1, 'Премиум кейс', 'Билет на бесплатное открытие', 'tokyo-archive');
    case 5: return reward('coins', 2_000 + cycle * 1_500, `${(2_000 + cycle * 1_500).toLocaleString('ru-RU')} ₽`, 'Игровая валюта');
    case 6: return reward('keys', 3 + cycle, `Ключ ×${3 + cycle}`, 'Для открытия контейнеров');
    case 7: return reward('xp', 4_000 + cycle * 1_000, `${(4_000 + cycle * 1_000).toLocaleString('ru-RU')} XP`, 'Опыт сезона');
    default: return reward('container', 1, 'Элитный кейс', 'Билет на бесплатное открытие', 'dubai-transit');
  }
};

export const getSeasonLevel = (seasonXp: number): number =>
  Math.min(SEASON_PASS_LEVELS, Math.max(1, Math.floor(Math.max(0, seasonXp) / SEASON_PASS_XP_PER_LEVEL) + 1));

export const getSeasonXpForLevel = (level: number): number =>
  (Math.max(1, Math.min(SEASON_PASS_LEVELS, Math.floor(level))) - 1) * SEASON_PASS_XP_PER_LEVEL;

export const getSeasonTiers = (limitedCaseTitle = 'GENESIS ARCHIVE CASE'): SeasonTier[] =>
  Array.from({ length: SEASON_PASS_LEVELS }, (_, index) => {
    const level = index + 1;
    return {
      level,
      xpRequired: getSeasonXpForLevel(level),
      free: freeRewardAt(level),
      premium: premiumRewardAt(level, limitedCaseTitle),
    };
  });

export const isSeasonRewardUnlocked = (seasonXp: number, level: number): boolean =>
  getSeasonLevel(seasonXp) >= level;

export const SEASON_REWARD_TYPE_LABELS: Record<SeasonRewardType, string> = {
  coins: 'Рубли ₽',
  container: 'Контейнер / кейс',
  item: 'Предмет / машина',
  xp: 'Опыт XP',
  frame: 'Рамка госномера',
  keys: 'Ключи',
};

export const SEASON_REWARD_ASSETS: Record<SeasonRewardType, string> = {
  coins: '/assets/season/genesis/reward-coin-gold.webp',
  container: '/assets/season/genesis/reward-case-gold.webp',
  item: '/assets/season/genesis/reward-case-silver.webp',
  xp: '/assets/season/genesis/reward-xp-gold.webp',
  frame: '/assets/season/genesis/vip-license-frame.webp',
  keys: '/assets/season/genesis/reward-key-gold.webp',
};

export const seasonRewardAsset = (type: SeasonRewardType, track: SeasonTrack): string => {
  const color = track === 'free' ? 'silver' : 'gold';
  switch (type) {
    case 'coins': return `/assets/season/genesis/reward-coin-${color}.webp`;
    case 'container': return `/assets/season/genesis/reward-case-${color}.webp`;
    case 'item': return `/assets/season/genesis/reward-case-${color}.webp`;
    case 'xp': return `/assets/season/genesis/reward-xp-${color}.webp`;
    case 'frame': return '/assets/season/genesis/vip-license-frame.webp';
    case 'keys': return `/assets/season/genesis/reward-key-${color}.webp`;
  }
};

export const seasonRewardSummary = (rewardValue: SeasonReward): string => {
  if (rewardValue.type === 'coins') return `${rewardValue.amount.toLocaleString('ru-RU')} ₽`;
  if (rewardValue.type === 'xp') return `${rewardValue.amount.toLocaleString('ru-RU')} XP`;
  if (rewardValue.type === 'keys') return `Ключ ×${rewardValue.amount}`;
  if (rewardValue.type === 'container' || rewardValue.type === 'item') return rewardValue.amount > 1 ? `${rewardValue.title} ×${rewardValue.amount}` : rewardValue.title;
  return rewardValue.title;
};
