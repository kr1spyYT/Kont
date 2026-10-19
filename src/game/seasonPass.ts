export const SEASON_PASS_LEVELS = 30;
export const SEASON_PASS_BASE_XP = 100;
export const SEASON_PASS_LEVEL_STEP_XP = 10;
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

export const getSeasonXpForLevel = (
  level: number,
  baseXp = SEASON_PASS_BASE_XP,
  levelStepXp = SEASON_PASS_LEVEL_STEP_XP,
): number => {
  const completedLevels = Math.max(0, Math.min(SEASON_PASS_LEVELS - 1, Math.floor(level) - 1));
  return completedLevels * baseXp + levelStepXp * completedLevels * (completedLevels - 1) / 2;
};

export const getSeasonLevel = (
  seasonXp: number,
  baseXp = SEASON_PASS_BASE_XP,
  levelStepXp = SEASON_PASS_LEVEL_STEP_XP,
): number => {
  const xp = Math.max(0, seasonXp);
  let level = 1;
  while (level < SEASON_PASS_LEVELS && xp >= getSeasonXpForLevel(level + 1, baseXp, levelStepXp)) level += 1;
  return level;
};

export const getSeasonTiers = (
  limitedCaseTitle = 'GENESIS ARCHIVE CASE',
  baseXp = SEASON_PASS_BASE_XP,
  levelStepXp = SEASON_PASS_LEVEL_STEP_XP,
): SeasonTier[] =>
  Array.from({ length: SEASON_PASS_LEVELS }, (_, index) => {
    const level = index + 1;
    return {
      level,
      xpRequired: getSeasonXpForLevel(level, baseXp, levelStepXp),
      free: freeRewardAt(level),
      premium: premiumRewardAt(level, limitedCaseTitle),
    };
  });

export const isSeasonRewardUnlocked = (
  seasonXp: number,
  level: number,
  baseXp = SEASON_PASS_BASE_XP,
  levelStepXp = SEASON_PASS_LEVEL_STEP_XP,
): boolean => getSeasonLevel(seasonXp, baseXp, levelStepXp) >= level;

export const SEASON_REWARD_TYPE_LABELS: Record<SeasonRewardType, string> = {
  coins: 'Рубли ₽',
  container: 'Контейнер / кейс',
  item: 'Предмет / машина',
  xp: 'Опыт XP',
  frame: 'Рамка госномера',
  keys: 'Ключи',
};

export const SEASON_REWARD_ASSETS: Record<SeasonRewardType, string> = {
  coins: '/assets/season/genesis/currency-key-bundle.webp',
  container: '/assets/season/genesis/reward-case-gold.webp',
  item: '/assets/season/genesis/reward-case-silver.webp',
  xp: '/assets/season/genesis/reward-xp-gold.webp',
  frame: '/assets/season/genesis/genesis-vip-plate.webp',
  keys: '/assets/season/genesis/currency-key-bundle.webp',
};

export const seasonRewardAsset = (type: SeasonRewardType, track: SeasonTrack): string => {
  const color = track === 'free' ? 'silver' : 'gold';
  switch (type) {
    case 'coins': return track === 'premium' ? '/assets/season/genesis/currency-key-bundle.webp' : `/assets/season/genesis/reward-coin-${color}.webp`;
    case 'container': return `/assets/season/genesis/reward-case-${color}.webp`;
    case 'item': return `/assets/season/genesis/reward-case-${color}.webp`;
    case 'xp': return `/assets/season/genesis/reward-xp-${color}.webp`;
    case 'frame': return '/assets/season/genesis/genesis-vip-plate.webp';
    case 'keys': return track === 'premium' ? '/assets/season/genesis/currency-key-bundle.webp' : `/assets/season/genesis/reward-key-${color}.webp`;
  }
};

export const seasonRewardSummary = (rewardValue: SeasonReward): string => {
  if (rewardValue.type === 'coins') return `${rewardValue.amount.toLocaleString('ru-RU')} ₽`;
  if (rewardValue.type === 'xp') return `${rewardValue.amount.toLocaleString('ru-RU')} XP`;
  if (rewardValue.type === 'keys') return `Ключ ×${rewardValue.amount}`;
  if (rewardValue.type === 'container' || rewardValue.type === 'item') return rewardValue.amount > 1 ? `${rewardValue.title} ×${rewardValue.amount}` : rewardValue.title;
  return rewardValue.title;
};
