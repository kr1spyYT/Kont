import type { PoolClient } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { hydrateMissingInventoryImages, saveCatalogItem } from './catalogItems.js';

const imageBytes = Buffer.from('processed-item-webp');
const imageDataUrl = `data:image/webp;base64,${imageBytes.toString('base64')}`;

describe('saveCatalogItem', () => {
  it('persists uploaded item artwork as a data URL in the TEXT image field', async () => {
    const query = vi.fn(async (sql: string, _params?: unknown[]) => {
      if (sql.includes('SELECT id, content_type, image_data FROM game_assets')) {
        return { rows: [{ id: 'asset_item_123', content_type: 'image/webp', image_data: imageBytes }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });
    const client = { query } as unknown as PoolClient;

    await saveCatalogItem(client, {
      id: 'catalog_item_123',
      type: 'clothing',
      name: 'Кастомная куртка',
      icon: '🧥',
      image: '/api/assets/asset_item_123',
      rarity: 'rare',
      basePrice: 25_000,
      respect: 45,
      slot: 'torso',
    });

    const insertCall = query.mock.calls.find(([sql]) => sql.includes('INSERT INTO game_items'));
    expect(insertCall).toBeDefined();
    expect(insertCall?.[1]?.[4]).toBe(imageDataUrl);
  });
});

describe('hydrateMissingInventoryImages', () => {
  it('restores custom clothing artwork by its catalog name', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('FROM game_items')) {
        return {
          rows: [{
            id: 'catalog_item_123',
            type: 'clothing',
            name: 'Худи Vetements',
            icon: '🧥',
            image: imageDataUrl,
            rarity: 'rare',
            base_price: 18_000,
            respect: 25,
            slot: 'torso',
          }],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    });
    const client = { query } as unknown as PoolClient;

    const [item] = await hydrateMissingInventoryImages(client, [{
      id: 'player_item_123',
      name: 'Худи Vetements',
      type: 'clothing',
      slot: 'torso',
      rarity: 'rare',
      icon: '🧥',
      image: '🧥',
      price: 16_000,
      basePrice: 18_000,
      respect: 25,
      serial: '#001/500',
      wear: 90,
      createdAt: '2026-10-18T00:00:00.000Z',
      containerId: 'custom-container',
      authenticity: 'unverified',
    }]);

    expect(item.image).toBe(imageDataUrl);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('FROM game_items'), [['Худи Vetements'], []]);
  });
});
