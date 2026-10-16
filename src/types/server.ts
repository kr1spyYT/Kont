import type { AuctionListing, ClothingSlot, InventoryItem, PlayerState } from './game';

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
  | { type: 'set-avatar'; avatarEmoji: string; requestId: string }
  | { type: 'start-new-game'; requestId: string };

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
  ownerImportPending: boolean;
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
}

export interface ApiEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: string;
}
