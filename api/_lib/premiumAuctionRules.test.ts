import { describe, expect, it } from 'vitest';
import {
  canCancelPremiumAuction,
  getMinimumPremiumBid,
  getPremiumBidBalanceDelta,
  isValidPremiumAuctionTerms,
  PREMIUM_AUCTION_MAX_DURATION_HOURS,
  PREMIUM_AUCTION_MAX_PRICE,
} from './premiumAuctionRules.js';

describe('premium auction rules', () => {
  it('accepts valid price and duration bounds and rejects invalid values', () => {
    expect(isValidPremiumAuctionTerms(1, 1)).toBe(true);
    expect(isValidPremiumAuctionTerms(PREMIUM_AUCTION_MAX_PRICE, PREMIUM_AUCTION_MAX_DURATION_HOURS)).toBe(true);
    expect(isValidPremiumAuctionTerms(0, 24)).toBe(false);
    expect(isValidPremiumAuctionTerms(PREMIUM_AUCTION_MAX_PRICE + 1, 24)).toBe(false);
    expect(isValidPremiumAuctionTerms(1.5, 24)).toBe(false);
    expect(isValidPremiumAuctionTerms(1, 0)).toBe(false);
    expect(isValidPremiumAuctionTerms(1, PREMIUM_AUCTION_MAX_DURATION_HOURS + 1)).toBe(false);
  });

  it('sets the minimum bid to the start price or one ruble above current bid', () => {
    expect(getMinimumPremiumBid(15_000, null)).toBe(15_000);
    expect(getMinimumPremiumBid(15_000, 18_000)).toBe(18_001);
    expect(getMinimumPremiumBid(20_000, 18_000)).toBe(20_000);
  });

  it('accounts for escrow when the current leader raises their own bid', () => {
    expect(getPremiumBidBalanceDelta(25_000, 18_000, true)).toBe(-7_000);
    expect(getPremiumBidBalanceDelta(25_000, 18_000, false)).toBe(-25_000);
  });

  it('allows cancellation only before the first bid', () => {
    expect(canCancelPremiumAuction(null)).toBe(true);
    expect(canCancelPremiumAuction(1)).toBe(false);
  });
});
