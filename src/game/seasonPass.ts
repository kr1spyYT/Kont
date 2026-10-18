export const SEASON_PASS_LEVELS = 30;
export const SEASON_PASS_XP_PER_LEVEL = 100;
export const SEASON_PASS_ID = 'season-1-genesis';
export const SEASON_PASS_PRICE_STARS = 250;

export type SeasonTrack = 'free' | 'premium';
export type SeasonBonusKind = 'license-plate-frame' | 'limited-case';

export interface SeasonReward {
  coins: number;
  title: string;
  bonus?: { kind: SeasonBonusKind; id: string; title: string };
}

export interface SeasonTier {
  level: number;
  xpRequired: number;
  free: SeasonReward;
  premium: SeasonReward;
}

export const getSeasonLevel = (seasonXp: number): number =>
  Math.min(SEASON_PASS_LEVELS, Math.max(1, Math.floor(Math.max(0, seasonXp) / SEASON_PASS_XP_PER_LEVEL) + 1));

export const getSeasonXpForLevel = (level: number): number =>
  (Math.max(1, Math.min(SEASON_PASS_LEVELS, Math.floor(level))) - 1) * SEASON_PASS_XP_PER_LEVEL;

export const getSeasonTiers = (limitedCaseTitle = 'Лимитированный кейс Genesis'): SeasonTier[] =>
  Array.from({ length: SEASON_PASS_LEVELS }, (_, index) => {
    const level = index + 1;
    const premium: SeasonReward = {
      coins: 1_000 + level * 250,
      title: `Премиум-награда · ${(1_000 + level * 250).toLocaleString('ru-RU')} ₽`,
    };
    if (level === 20) {
      premium.bonus = { kind: 'license-plate-frame', id: 'season-01-vip', title: 'SEASON 01 // VIP · рамка номера' };
      premium.title = 'SEASON 01 // VIP · рамка номера + награда';
    }
    if (level === 30) {
      premium.bonus = { kind: 'limited-case', id: 'season-01-limited-case', title: limitedCaseTitle };
      premium.title = `${limitedCaseTitle} + награда`;
    }
    return {
      level,
      xpRequired: getSeasonXpForLevel(level),
      free: {
        coins: 300 + level * 100,
        title: `Награда · ${(300 + level * 100).toLocaleString('ru-RU')} ₽`,
      },
      premium,
    };
  });

export const isSeasonRewardUnlocked = (seasonXp: number, level: number): boolean =>
  getSeasonLevel(seasonXp) >= level;
