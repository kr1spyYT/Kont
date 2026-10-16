export type ItemType = 'clothing' | 'car';
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
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

export interface AuctionListing {
  id: string;
  seller: string;
  item: InventoryItem;
  askingPrice: number;
  listedAt: string;
  isPlayerListing: boolean;
}

export interface Container {
  id: string;
  order: number;
  name: string;
  category: ItemType;
  price: number;
  description: string;
  icon: string;
  image: string;
  contents: ContainerDrop[];
}

export interface ContainerDrop {
  name: string;
  icon: string;
  image: string;
  rarity: Rarity;
  basePrice: number;
  respect: number;
  slot?: ClothingSlot;
}

export interface PlayerState {
  balance: number;
  respect: number;
  xp?: number;
  inventory: InventoryItem[];
  licensePlates: LicensePlateItem[];
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
