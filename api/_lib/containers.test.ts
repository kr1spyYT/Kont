import type { PoolClient } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { listContainerCatalog, saveContainer } from './containers.js';

const containerBytes = Buffer.from('container-webp');
const itemBytes = Buffer.from('item-webp');
const containerDataUrl = `data:image/webp;base64,${containerBytes.toString('base64')}`;
const itemDataUrl = `data:image/webp;base64,${itemBytes.toString('base64')}`;
const containerAssetPath = '/api/assets/asset_cont_123';
const itemAssetPath = '/api/assets/asset_item_123';
const storedAssets = [
  { id: 'asset_cont_123', content_type: 'image/webp', image_data: containerBytes },
  { id: 'asset_item_123', content_type: 'image/webp', image_data: itemBytes },
];

describe('container image pipeline', () => {
  it('returns old uploaded asset paths as data URLs with linked custom item data', async () => {
    const query = vi.fn(async (sql: string, params?: unknown[]) => {
      if (sql.startsWith('SELECT id, title, type, tier, price, sort_order')) {
        return {
          rows: [{
            id: 'custom-clothes',
            title: 'Кастомный контейнер',
            type: 'clothing',
            tier: 2,
            price: 12_000,
            sort_order: 7,
            description: 'Для теста',
            icon: '📦',
            image: containerAssetPath,
            drops: [{
              catalogItemId: 'catalog_item_123',
              name: 'Старое имя',
              icon: '🧥',
              image: 'items/old.webp',
              rarity: 'common',
              basePrice: 1_000,
              respect: 1,
              weight: 60,
              slot: 'torso',
            }],
            cooldown_seconds: 0,
          }],
          rowCount: 1,
        };
      }
      if (sql.startsWith('SELECT id, type, name, icon, image, rarity, base_price, respect, slot FROM game_items')) {
        return {
          rows: [{
            id: 'catalog_item_123',
            type: 'clothing',
            name: 'Кастомная куртка',
            icon: '🧥',
            image: itemAssetPath,
            rarity: 'rare',
            base_price: 25_000,
            respect: 45,
            slot: 'torso',
          }],
          rowCount: 1,
        };
      }
      if (sql.startsWith('SELECT id, content_type, image_data FROM game_assets')) {
        const requestedIds = params?.[0] as string[];
        return { rows: storedAssets.filter((asset) => requestedIds.includes(asset.id)), rowCount: requestedIds.length };
      }
      return { rows: [], rowCount: 0 };
    });
    const client = { query } as unknown as PoolClient;

    const containers = await listContainerCatalog(client);

    expect(containers).toHaveLength(1);
    expect(containers[0].image).toBe(containerDataUrl);
    expect(containers[0].contents[0]).toMatchObject({
      name: 'Кастомная куртка',
      image: itemDataUrl,
      rarity: 'rare',
      basePrice: 25_000,
      respect: 45,
    });
  });

  it('persists uploaded container and drop images as Data URLs', async () => {
    const query = vi.fn(async (sql: string, params?: unknown[]) => {
      if (sql.startsWith('SELECT id, content_type, image_data FROM game_assets')) {
        const requestedIds = params?.[0] as string[];
        return { rows: storedAssets.filter((asset) => requestedIds.includes(asset.id)), rowCount: requestedIds.length };
      }
      return { rows: [], rowCount: 0 };
    });
    const client = { query } as unknown as PoolClient;

    await saveContainer(client, {
      id: 'custom-box',
      title: 'Кастомный контейнер',
      type: 'clothing',
      tier: 2,
      price: 12_000,
      sortOrder: 7,
      description: 'Для теста',
      icon: '📦',
      image: containerAssetPath,
      drops: [{
        name: 'Кастомная куртка',
        icon: '🧥',
        image: itemAssetPath,
        rarity: 'rare',
        basePrice: 25_000,
        respect: 45,
        weight: 15,
        slot: 'torso',
      }],
      cooldownSeconds: 0,
    });

    const inserts = query.mock.calls.filter(([sql]) => sql.includes('INSERT INTO game_containers'));
    const insertValues = inserts[inserts.length - 1]?.[1] as unknown[] | undefined;
    expect(insertValues?.[8]).toBe(containerDataUrl);
    const savedDrops = JSON.parse(String(insertValues?.[9])) as Array<{ image: string }>;
    expect(savedDrops[0].image).toBe(itemDataUrl);
  });
});

export {};
