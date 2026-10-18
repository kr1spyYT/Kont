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

    expect(markup).toContain('/assets/season/genesis/hero-genesis-case.webp');
    expect(markup).toContain('/assets/season/genesis/free-pass-crest.webp');
    expect(markup).toContain('/assets/season/genesis/vip-pass-crest.webp');
    expect(markup).toContain('/assets/season/genesis/vip-license-frame.webp');
    expect(markup).toContain('/assets/season/genesis/final-genesis-case.webp');
    expect(markup).toContain('Free Pass');
    expect(markup).toContain('VIP Pass');
    expect(markup).toContain('SEASON 01 // VIP');
    expect(markup).toContain('Genesis Archive Case');
    expect(markup).toContain('80%');
    expect(markup).not.toContain('500 $');
  });
});
