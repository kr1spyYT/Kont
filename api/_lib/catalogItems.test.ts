import type { PoolClient } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { saveCatalogItem } from './catalogItems.js';

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
