import { AuctionListing, CarItem, ClothingItem } from '../types/game';
import { getItemImage } from './items';

const listingItem = {
  rarity: 'epic' as const,
  serial: '#077/500',
  wear: 92.5,
  createdAt: '2026-10-01T12:00:00.000Z',
  respect: 230,
};

const botCars: AuctionListing[] = [
  {
    id: 'market-m5',
    seller: '@dealer_777',
    askingPrice: 14_200_000,
    listedAt: '2026-10-14T19:20:00.000Z',
    isPlayerListing: false,
    item: {
      ...listingItem,
      id: 'market-item-m5',
      name: 'BMW M5 F90 Competition',
      type: 'car',
      slot: 'car',
      icon: '🏎️',
      image: getItemImage('BMW M5 F90 Competition'),
      price: 14_200_000,
      basePrice: 12_500_000,
      rarity: 'legendary',
      mileage: 38_400,
      licensePlate: 'А777АА',
      containerId: 'dubai-transit',
    } satisfies CarItem,
  },
  {
    id: 'market-silvia',
    seller: '@sanya_swap',
    askingPrice: 2_700_000,
    listedAt: '2026-10-14T20:05:00.000Z',
    isPlayerListing: false,
    item: {
      ...listingItem,
      id: 'market-item-silvia',
      name: 'Nissan Silvia S15',
      type: 'car',
      slot: 'car',
      icon: '🏁',
      image: getItemImage('Nissan Silvia S15'),
      price: 2_700_000,
      basePrice: 2_350_000,
      rarity: 'epic',
      mileage: 71_200,
      licensePlate: 'Е001КХ',
      containerId: 'japanese-auction',
    } satisfies CarItem,
  },
];

const botClothing: AuctionListing[] = [
  {
    id: 'market-rick-owens',
    seller: '@tokyo_boy',
    askingPrice: 245_000,
    listedAt: '2026-10-14T18:40:00.000Z',
    isPlayerListing: false,
    item: {
      ...listingItem,
      id: 'market-item-rick-owens',
      name: 'Кеды Rick Owens Geobasket',
      type: 'clothing',
      slot: 'shoes',
      icon: '🥾',
      image: getItemImage('Кеды Rick Owens Geobasket'),
      price: 245_000,
      basePrice: 165_000,
      rarity: 'legendary',
      authenticity: 'original',
      containerId: 'tokyo-archive',
    } satisfies ClothingItem,
  },
  {
    id: 'market-goyard',
    seller: '@dealer_777',
    askingPrice: 68_000,
    listedAt: '2026-10-14T17:30:00.000Z',
    isPlayerListing: false,
    item: {
      ...listingItem,
      id: 'market-item-goyard',
      name: 'Сумка Goyard',
      type: 'clothing',
      slot: 'accessory',
      icon: '👜',
      image: getItemImage('Сумка Goyard'),
      price: 68_000,
      basePrice: 52_000,
      rarity: 'rare',
      authenticity: 'unverified',
      containerId: 'hype-box',
    } satisfies ClothingItem,
  },
];

export const MARKET_SEED: AuctionListing[] = [...botCars, ...botClothing];
