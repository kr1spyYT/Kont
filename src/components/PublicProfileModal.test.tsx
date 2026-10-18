import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { PublicPlayerProfile } from '../types/server';
import PublicProfileModal from './PublicProfileModal';

describe('PublicProfileModal artwork', () => {
  it('renders equipped item and car images in bounded slots', () => {
    const profile: PublicPlayerProfile = {
      telegramId: '1234567890',
      displayName: 'Игрок',
      xp: 0,
      respect: 0,
      collectionValue: 0,
      collectionCount: 2,
      rankTitle: 'Новичок',
      rankPosition: 1,
      equippedClothing: [{
        id: 'player_item_123',
        name: 'Худи Vetements',
        type: 'clothing',
        slot: 'torso',
        rarity: 'rare',
        icon: '🧥',
        image: '/items/vetements-hoodie.png',
        price: 16_000,
        basePrice: 18_000,
        respect: 25,
        serial: '#001/500',
        wear: 90,
        createdAt: '2026-10-18T00:00:00.000Z',
        containerId: 'custom-container',
        authenticity: 'unverified',
      }],
      activeCar: {
        id: 'player_car_123',
        name: 'Lamborghini Urus',
        type: 'car',
        slot: 'car',
        rarity: 'legendary',
        icon: '🚘',
        image: '/items/lamborghini-urus.png',
        price: 19_500_000,
        basePrice: 19_500_000,
        respect: 2_350,
        serial: '#001/500',
        wear: 100,
        createdAt: '2026-10-18T00:00:00.000Z',
        containerId: 'dubai-transit',
        mileage: 15_000,
        licensePlate: 'А777АА 77',
      },
      licensePlates: [],
      licensePlateFrames: ['season-01-vip'],
      activeListings: [],
    };
    const markup = renderToStaticMarkup(createElement(PublicProfileModal, {
      profile,
      loading: false,
      error: '',
      balance: 0,
      onClose: () => undefined,
      onBuy: async () => undefined,
    }));

    expect(markup).toContain('src="/items/vetements-hoodie.png"');
    expect(markup).toContain('src="/items/lamborghini-urus.png"');
    expect(markup).toContain('Витрина экипировки');
    expect(markup).toContain('src="/assets/profile/pedestal_base.webp"');
    expect(markup).toContain('src="/assets/profile/empty_car_podium.webp"');
    expect(markup).toContain('h-[78%] w-full object-contain');
    expect(markup).toContain('h-[118px] w-full object-contain');
    expect(markup).toContain('aria-label="Госномер А777АА 77, рамка SEASON 01 // VIP"');
    expect(markup).toContain('data-frame-id="season-01-vip"');
    expect(markup).toContain('overflow-hidden');
    expect(markup).toContain('Главная машина');
    expect(markup).not.toContain('🧥');
    expect(markup).not.toContain('h-28 w-28');
  });
});
