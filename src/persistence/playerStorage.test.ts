import { describe, expect, it } from 'vitest';
import { normalizePlayerState } from './playerStorage';

describe('normalizePlayerState inventory artwork', () => {
  it('uses a valid imageUrl when legacy inventory has no usable image', () => {
    const imageUrl = 'data:image/webp;base64,AQID';
    const state = normalizePlayerState({
      economyVersion: 4,
      inventory: [{
        id: 'player_item_123',
        name: 'Худи Vetements',
        type: 'clothing',
        slot: 'torso',
        rarity: 'rare',
        icon: '🧥',
        image: '🧥',
        imageUrl,
        price: 16_000,
        basePrice: 18_000,
        respect: 25,
        serial: '#001/500',
        wear: 90,
        createdAt: '2026-10-18T00:00:00.000Z',
        containerId: 'custom-container',
        authenticity: 'unverified',
      }],
      equippedClothing: { torso: 'player_item_123' },
    });

    expect(state.inventory[0]?.image).toBe(imageUrl);
    expect(state.equippedClothing.torso).toBe('player_item_123');
  });
});
