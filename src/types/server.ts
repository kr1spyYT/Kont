import type { AuctionListing, CarItem, ClothingItem, ClothingSlot, Container, DailyMissionId, InventoryItem, LicensePlateItem, LicensePlateSaleFilter, PlayerState, SaleCategory } from './game.js';

import type { SeasonTier } from '../game/seasonPass';

export type GameAction =
  | { type: 'open-container'; containerId: string; free: boolean; useKey?: boolean; requestId: string }
  | { type: 'open-season-case'; containerId: string; requestId: string }
  | { type: 'sell-item'; itemId: string; requestId: string }
  | { type: 'quick-sell-item'; itemId: string; requestId: string }
  | { type: 'quick-sell-junk'; requestId: string }
  | { type: 'spin-license-plate'; requestId: string }
  | { type: 'sell-license-plate'; plateId: string; requestId: string }
  | { type: 'sell-license-plates'; rarity: LicensePlateSaleFilter; requestId: string }
  | { type: 'set-license-plate-favorite'; plateId: string; favorite: boolean; requestId: string }
  | { type: 'equip-clothing'; itemId: string; slot: ClothingSlot; requestId: string }
  | { type: 'equip-license-plate-frame'; frameId: string | null; requestId: string }
  | { type: 'set-active-car'; carId?: string; requestId: string }
  | { type: 'set-car-plate'; carId: string; plateId?: string; requestId: string }
  | { type: 'workshop'; itemId: string; operation: 'detail' | 'legit' | 'mileage'; skillScore?: number; free?: boolean; requestId: string }
  | { type: 'list-item'; itemId: string; askingPrice: number; requestId: string }
  | { type: 'list-license-plate'; plateId: string; askingPrice: number; requestId: string }
  | { type: 'cancel-listing'; listingId: string; requestId: string }
  | { type: 'buy-listing'; listingId: string; requestId: string }
  | { type: 'premium-list-item'; itemId: string; startingPrice: number; durationHours: number; requestId: string }
  | { type: 'premium-list-license-plate'; plateId: string; startingPrice: number; durationHours: number; requestId: string }
  | { type: 'premium-bid'; lotId: string; amount: number; requestId: string }
  | { type: 'premium-cancel-lot'; lotId: string; requestId: string }
  | { type: 'claim-daily-mission'; missionId: DailyMissionId; requestId: string }
  | { type: 'top-up-owner'; requestId: string }
  | { type: 'set-avatar'; avatarEmoji: string; requestId: string };

export interface AuthenticatedPlayer {
  id: string;
  firstName: string;
  lastName?: string;
  username?: string;
  photoUrl?: string;
}

export interface PlayerSnapshot {
  player: PlayerState;
  xp: number;
  rankTitle: string;
  isOwner: boolean;
  isPremiumPass: boolean;
  freeCaseAvailableAt?: string;
  containerCooldowns?: Record<string, string>;
  telegramUser: AuthenticatedPlayer;
}

export interface SeasonContractSnapshot {
  id: string;
  title: string;
  cadence: 'daily' | 'weekly';
  targetCount: number;
  progress: number;
  xpReward: number;
  periodKey: string;
  completed: boolean;
  claimed: boolean;
}

export interface SeasonPassSnapshot {
  season: null | {
    id: string;
    name: string;
    endsAt?: string;
    premiumPriceStars: number;
    limitedContainerId?: string;
    limitedContainerName?: string;
    isActive: boolean;
  };
  seasonXp: number;
  level: number;
  isPremiumPass: boolean;
  claimedRewards: string[];
  contracts: SeasonContractSnapshot[];
  tiers: SeasonTier[];
}

export interface SeasonRewardClaimResponse {
  snapshot: SeasonPassSnapshot;
  message: string;
}

export interface SeasonInvoiceResponse {
  invoiceUrl: string;
  seasonName: string;
  stars: number;
}

export interface GameUpdate {
  id: string;
  title: string;
  body: string;
  publishedAt: string;
}

export interface ActionResponse {
  snapshot: PlayerSnapshot;
  result?: {
    item?: InventoryItem;
    plate?: string;
    success?: boolean;
    reward?: number;
    soldCount?: number;
    seasonXpEarned?: number;
    message?: string;
  };
}

export interface MarketListing extends AuctionListing {
  sellerTitle?: string;
  sellerId?: string;
  isMine?: boolean;
  sellerAvatarUrl?: string;
  licensePlateFrameIds?: string[];
}

export interface MarketSaleNotification {
  listingId: string;
  itemName: string;
  askingPrice: number;
  soldAt: string;
}

export interface PremiumAuctionLot {
  id: string;
  seller: string;
  sellerId: string;
  sellerTitle?: string;
  sellerAvatarUrl?: string;
  item: AuctionListing['item'];
  saleCategory: Exclude<SaleCategory, 'common'>;
  startingPrice: number;
  currentBid?: number;
  endsAt: string;
  listedAt: string;
  isMine: boolean;
  isHighestBidder: boolean;
  licensePlateFrameIds?: string[];
}

export interface MarketSnapshot {
  listings: MarketListing[];
  premiumLots: PremiumAuctionLot[];
  sales: MarketSaleNotification[];
}

export type ContainerCatalog = Container[];

export type LeaderboardMetric = 'xp' | 'respect' | 'collection';

export interface LeaderboardEntry {
  telegramId: string;
  displayName: string;
  username?: string;
  avatarUrl?: string;
  xp: number;
  respect: number;
  collectionValue: number;
  collectionCount: number;
  rankTitle: string;
  position: number;
}

export interface PublicPlayerProfile {
  telegramId: string;
  displayName: string;
  username?: string;
  avatarUrl?: string;
  xp: number;
  respect: number;
  collectionValue: number;
  collectionCount: number;
  rankTitle: string;
  rankPosition: number;
  isPremiumPass: boolean;
  equippedClothing: ClothingItem[];
  activeCar?: CarItem;
  licensePlates: LicensePlateItem[];
  licensePlateFrames: string[];
  activeListings: MarketListing[];
}

export interface ApiEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: string;
}
