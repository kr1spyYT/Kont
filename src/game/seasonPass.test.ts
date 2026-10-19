import { describe, expect, it } from 'vitest';
import { getSeasonLevel, getSeasonTiers, getSeasonXpForLevel, isSeasonRewardUnlocked, SEASON_PASS_LEVELS } from './seasonPass';

describe('season pass progression', () => {
  it('starts at level one and applies a progressively increasing XP curve', () => {
    expect(getSeasonLevel(0)).toBe(1);
    expect(getSeasonLevel(99)).toBe(1);
    expect(getSeasonLevel(100)).toBe(2);
    expect(getSeasonLevel(209)).toBe(2);
    expect(getSeasonLevel(210)).toBe(3);
    expect(getSeasonLevel(6_960)).toBe(SEASON_PASS_LEVELS);
    expect(getSeasonLevel(20_000)).toBe(SEASON_PASS_LEVELS);
    expect(getSeasonLevel(-20)).toBe(1);
  });

  it('requires 6,960 XP for level thirty and supports a configurable flat curve', () => {
    expect(getSeasonXpForLevel(1)).toBe(0);
    expect(getSeasonXpForLevel(20)).toBe(3_610);
    expect(getSeasonXpForLevel(30)).toBe(6_960);
    expect(getSeasonXpForLevel(30, 100, 0)).toBe(2_900);
    expect(isSeasonRewardUnlocked(3_609, 20)).toBe(false);
    expect(isSeasonRewardUnlocked(3_610, 20)).toBe(true);
  });

  it('provides thirty persistent-ready free and VIP rewards with the milestone prizes', () => {
    const tiers = getSeasonTiers('Genesis Case');
    expect(tiers).toHaveLength(30);
    expect(tiers.every((tier) => tier.free.amount > 0 && tier.premium.amount > 0)).toBe(true);
    expect(tiers[0].free).toMatchObject({ type: 'coins', amount: 500 });
    expect(tiers[1].free).toMatchObject({ type: 'keys', amount: 1 });
    expect(tiers[19].premium).toMatchObject({ type: 'frame', refId: 'season-01-vip' });
    expect(tiers[29].premium).toMatchObject({ type: 'container', title: 'Genesis Case' });
  });
});
