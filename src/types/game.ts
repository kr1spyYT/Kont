export type ItemType = 'clothing' | 'car';
export type ContainerType = ItemType | 'plates';
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';
export type LicensePlateRarity = Rarity | 'secret';
export type LicensePlateSpecialTitle = 'BIG BOSS' | 'ЛУДОМАН' | 'ЛЕГЕНДА';
export type LicensePlateSaleFilter = LicensePlateRarity | 'all';
export type Authenticity = 'unverified' | 'original' | 'fake';
export type ClothingSlot = 'head' | 'torso' | 'legs' | 'shoes' | 'accessory';

export interface Item {
  id: string;
  name: string;
  type: ItemType;
  rarity: Rarity;
  icon: string;
  image?: string;
  price: number;
  basePrice: number;
  respect: number;
  serial: string;
  wear: number;
  createdAt: string;
  containerId: string;
}

export interface ClothingItem extends Item {
  type: 'clothing';
  slot: ClothingSlot;
  authenticity: Authenticity;
}

export interface CarItem extends Item {
  type: 'car';
  slot: 'car';
  mileage: number;
  licensePlate?: string;
  licensePlateId?: string;
  mileageRolledBack?: boolean;
  mileageTampered?: boolean;
}

export type InventoryItem = ClothingItem | CarItem;

export interface LicensePlateItem {
  id: string;
  plate: string;
  price: number;
}

export interface MarketPlateItem {
  id: string;
  type: 'plate';
  name: string;
  plate: string;
  rarity: LicensePlateRarity;
  price: number;
}

export type AuctionItem = InventoryItem | MarketPlateItem;

export type DailyMissionId = 'open-container' | 'spin-license-plate' | 'sell-license-plate';

export interface DailyMissionState {
  day: string;
  progress: Partial<Record<DailyMissionId, number>>;
  claimed: DailyMissionId[];
}

export interface AuctionListing {
  id: string;
  seller: string;
  item: AuctionItem;
  askingPrice: number;
  listedAt: string;
  isPlayerListing: boolean;
}

export interface Container {
  id: string;
  order: number;
  tier: number;
  name: string;
  category: ContainerType;
  price: number;
  description: string;
  icon: string;
  image: string;
  contents: ContainerDrop[];
  cooldownSeconds?: number;
}

export interface ContainerDrop {
  catalogItemId?: string;
  name: string;
  icon: string;
  image: string;
  rarity: Rarity;
  basePrice: number;
  respect: number;
  slot?: ClothingSlot;
  weight?: number;
}

export interface PlayerState {
  balance: number;
  respect: number;
  xp?: number;
  inventory: InventoryItem[];
  licensePlates: LicensePlateItem[];
  favoriteLicensePlateIds: string[];
  licensePlateFrames: string[];
  seasonCaseTokens: Record<string, number>;
  dailyMissions: DailyMissionState;
  equippedClothing: Partial<Record<ClothingSlot, string>>;
  activeCarId?: string;
  auctionListings: AuctionListing[];
  closedMarketListingIds: string[];
  avatarEmoji: string;
  avatarUrl?: string;
  lastSaved?: string;
  freeCaseOpenedAt?: string;
  economyVersion: 4;
}
