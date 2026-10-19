export const PREMIUM_AUCTION_MIN_PRICE = 1;
export const PREMIUM_AUCTION_MAX_PRICE = 2_000_000_000;
export const PREMIUM_AUCTION_MAX_DURATION_HOURS = 168;

export const isValidPremiumAuctionTerms = (startingPrice: number, durationHours: number): boolean =>
  Number.isSafeInteger(startingPrice)
  && startingPrice >= PREMIUM_AUCTION_MIN_PRICE
  && startingPrice <= PREMIUM_AUCTION_MAX_PRICE
  && Number.isSafeInteger(durationHours)
  && durationHours >= 1
  && durationHours <= PREMIUM_AUCTION_MAX_DURATION_HOURS;

export const getMinimumPremiumBid = (startingPrice: number, currentBid: number | null): number =>
  currentBid === null ? startingPrice : Math.max(startingPrice, currentBid + 1);

export const getPremiumBidBalanceDelta = (amount: number, currentBid: number, isCurrentLeader: boolean): number =>
  isCurrentLeader ? currentBid - amount : -amount;

export const canCancelPremiumAuction = (currentBid: number | null): boolean => currentBid === null;
