import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { getSeasonTiers } from '../game/seasonPass';
import type { SeasonPassSnapshot } from '../types/server';
import SeasonTab from './SeasonTab';

const snapshot: SeasonPassSnapshot = {
  season: {
    id: 'season-1-genesis',
    name: 'Season 1: Genesis',
    endsAt: '2027-01-01T20:59:59.000Z',
    premiumPriceStars: 250,
    limitedContainerId: 'tokyo-archive',
    limitedContainerName: 'Tokyo Archive',
    isActive: true,
  },
  seasonXp: 1_900,
  level: 20,
  isPremiumPass: false,
  claimedRewards: [],
  contracts: [{ id: 'daily-open-two', title: 'Открой любые 2 контейнера', cadence: 'daily', targetCount: 2, progress: 1, xpReward: 50, periodKey: '2026-10-19', completed: false, claimed: false }],
  tiers: getSeasonTiers('Tokyo Archive'),
};

describe('Genesis Season Pass presentation', () => {
  it('renders the real mockup assets, both synchronized tracks, and the two milestones', () => {
    const markup = renderToStaticMarkup(createElement(SeasonTab, {
      isServerGame: true,
      season: snapshot,
      onSeasonChange: () => undefined,
      onClaim: async () => 'ok',
      onRefreshPlayer: async () => undefined,
      onQuickSell: async () => 'ok',
    }));

    expect(markup).not.toContain('/assets/season/genesis/hero-genesis-case.webp');
    expect(markup).toContain('/assets/season/genesis/free-pass-crest.webp');
    expect(markup).not.toContain('/assets/season/genesis/vip-pass-crest.webp');
    expect(markup).toContain('/assets/season/genesis/genesis-vip-plate.webp');
    expect(markup).toContain('/assets/season/genesis/vip-briefcase.webp');
    expect(markup).toContain('/assets/season/genesis/currency-key-bundle.webp');
    expect(markup).toContain('/assets/season/genesis/genesis-archive-chest.webp');
    expect(markup).not.toContain('/assets/season/genesis/final-genesis-case.webp');
    expect(markup).toContain('Free Pass');
    expect(markup).toContain('VIP Pass');
    expect(markup).toContain('SEASON 01 // VIP');
    expect(markup).toContain('Genesis Archive Case');
    expect(markup).toContain('Контракты');
    expect(markup).toContain('Открой любые 2 контейнера');
    expect(markup).toContain('1/2');
    expect(markup).toContain('100% базовой цены');
    expect(markup).not.toContain('80%');
    expect(markup).not.toContain('500 $');
  });
});
