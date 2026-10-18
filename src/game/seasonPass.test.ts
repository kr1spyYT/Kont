import { describe, expect, it } from 'vitest';
import { getSeasonLevel, getSeasonTiers, getSeasonXpForLevel, isSeasonRewardUnlocked, SEASON_PASS_LEVELS } from './seasonPass';

describe('season pass progression', () => {
  it('starts at level one and caps at level thirty', () => {
    expect(getSeasonLevel(0)).toBe(1);
    expect(getSeasonLevel(99)).toBe(1);
    expect(getSeasonLevel(100)).toBe(2);
    expect(getSeasonLevel(2_900)).toBe(SEASON_PASS_LEVELS);
    expect(getSeasonLevel(20_000)).toBe(SEASON_PASS_LEVELS);
    expect(getSeasonLevel(-20)).toBe(1);
  });

  it('requires 2,900 XP to unlock level thirty', () => {
    expect(getSeasonXpForLevel(1)).toBe(0);
    expect(getSeasonXpForLevel(20)).toBe(1_900);
    expect(getSeasonXpForLevel(30)).toBe(2_900);
    expect(isSeasonRewardUnlocked(1_899, 20)).toBe(false);
    expect(isSeasonRewardUnlocked(1_900, 20)).toBe(true);
  });

  it('provides thirty rewards with the frame and limited case milestones', () => {
    const tiers = getSeasonTiers('Genesis Case');
    expect(tiers).toHaveLength(30);
    expect(tiers[19].premium.bonus).toMatchObject({ kind: 'license-plate-frame', id: 'season-01-vip' });
    expect(tiers[29].premium.bonus).toMatchObject({ kind: 'limited-case', title: 'Genesis Case' });
    expect(tiers.every((tier) => tier.free.coins > 0 && tier.premium.coins > 0)).toBe(true);
  });
});
