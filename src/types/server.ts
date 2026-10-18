import type { AuctionListing, CarItem, ClothingItem, ClothingSlot, Container, DailyMissionId, InventoryItem, LicensePlateItem, LicensePlateSaleFilter, PlayerState } from './game.js';

import type { SeasonTier } from '../game/seasonPass';

export type GameAction =
  | { type: 'open-container'; containerId: string; free: boolean; requestId: string }
  | { type: 'open-season-case'; containerId: string; requestId: string }
  | { type: 'sell-item'; itemId: string; requestId: string }
  | { type: 'quick-sell-item'; itemId: string; requestId: string }
  | { type: 'quick-sell-junk'; requestId: string }
  | { type: 'spin-license-plate'; requestId: string }
  | { type: 'sell-license-plate'; plateId: string; requestId: string }
  | { type: 'sell-license-plates'; rarity: LicensePlateSaleFilter; requestId: string }
  | { type: 'set-license-plate-favorite'; plateId: string; favorite: boolean; requestId: string }
  | { type: 'equip-clothing'; itemId: string; slot: ClothingSlot; requestId: string }
  | { type: 'set-active-car'; carId?: string; requestId: string }
  | { type: 'set-car-plate'; carId: string; plateId?: string; requestId: string }
  | { type: 'workshop'; itemId: string; operation: 'detail' | 'legit' | 'mileage'; skillScore?: number; free?: boolean; requestId: string }
  | { type: 'list-item'; itemId: string; askingPrice: number; requestId: string }
  | { type: 'list-license-plate'; plateId: string; askingPrice: number; requestId: string }
  | { type: 'cancel-listing'; listingId: string; requestId: string }
  | { type: 'buy-listing'; listingId: string; requestId: string }
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
  freeCaseAvailableAt?: string;
  containerCooldowns?: Record<string, string>;
  telegramUser: AuthenticatedPlayer;
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
}

export interface MarketSaleNotification {
  listingId: string;
  itemName: string;
  askingPrice: number;
  soldAt: string;
}

export interface MarketSnapshot {
  listings: MarketListing[];
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
  equippedClothing: ClothingItem[];
  activeCar?: CarItem;
  licensePlates: LicensePlateItem[];
  activeListings: MarketListing[];
}

export interface ApiEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: string;
}
