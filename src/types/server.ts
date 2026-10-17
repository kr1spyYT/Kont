import type { AuctionListing, CarItem, ClothingItem, ClothingSlot, InventoryItem, LicensePlateItem, PlayerState } from './game.js';

export type GameAction =
  | { type: 'open-container'; containerId: string; free: boolean; requestId: string }
  | { type: 'sell-item'; itemId: string; requestId: string }
  | { type: 'spin-license-plate'; requestId: string }
  | { type: 'sell-license-plate'; plateId: string; requestId: string }
  | { type: 'equip-clothing'; itemId: string; slot: ClothingSlot; requestId: string }
  | { type: 'set-active-car'; carId?: string; requestId: string }
  | { type: 'set-car-plate'; carId: string; plateId?: string; requestId: string }
  | { type: 'workshop'; itemId: string; operation: 'detail' | 'legit' | 'mileage'; skillScore?: number; requestId: string }
  | { type: 'list-item'; itemId: string; askingPrice: number; requestId: string }
  | { type: 'cancel-listing'; listingId: string; requestId: string }
  | { type: 'buy-listing'; listingId: string; requestId: string }
  | { type: 'buy-bot-listing'; listingId: string; requestId: string }
  | { type: 'top-up-owner'; requestId: string }
  | { type: 'set-avatar'; avatarEmoji: string; requestId: string };

export interface AuthenticatedPlayer {
  id: string;
  firstName: string;
  lastName?: string;
  username?: string;
}

export interface PlayerSnapshot {
  player: PlayerState;
  xp: number;
  rankTitle: string;
  isOwner: boolean;
  freeCaseAvailableAt?: string;
  telegramUser: AuthenticatedPlayer;
}

export interface ActionResponse {
  snapshot: PlayerSnapshot;
  result?: {
    item?: InventoryItem;
    plate?: string;
    success?: boolean;
    message?: string;
  };
}

export interface MarketListing extends AuctionListing {
  sellerTitle?: string;
  sellerId?: string;
  isMine?: boolean;
  sellerAvatar?: string;
}

export type LeaderboardMetric = 'xp' | 'respect' | 'collection';

export interface LeaderboardEntry {
  telegramId: string;
  displayName: string;
  username?: string;
  avatarEmoji: string;
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
  avatarEmoji: string;
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
