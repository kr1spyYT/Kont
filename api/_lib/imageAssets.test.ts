import type { PoolClient } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { isSupportedImageSource, materializeImageSources } from './imageAssets.js';

const assetPath = '/api/assets/asset_test_123';
const bytes = Buffer.from('processed-webp');
const dataUrl = `data:image/webp;base64,${bytes.toString('base64')}`;

describe('catalog image storage', () => {
  it('accepts data URLs and existing same-origin image paths', () => {
    expect(isSupportedImageSource(dataUrl)).toBe(true);
    expect(isSupportedImageSource(assetPath)).toBe(true);
    expect(isSupportedImageSource('containers/custom.png')).toBe(true);
    expect(isSupportedImageSource('https://example.test/image.png')).toBe(false);
    expect(isSupportedImageSource('javascript:alert(1)')).toBe(false);
  });

  it('materializes stored WebP asset paths as database-ready data URLs', async () => {
    const query = vi.fn(async () => ({
      rows: [{ id: 'asset_test_123', content_type: 'image/webp', image_data: bytes }],
      rowCount: 1,
    }));
    const client = { query } as unknown as PoolClient;

    const resolved = await materializeImageSources(client, [assetPath, 'items/static.webp']);

    expect(resolved).toEqual([dataUrl, 'items/static.webp']);
    expect(query).toHaveBeenCalledWith(
      'SELECT id, content_type, image_data FROM game_assets WHERE id = ANY($1::text[])',
      [['asset_test_123']],
    );
  });

  it('fails clearly if a temporary upload has expired', async () => {
    const client = { query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }) } as unknown as PoolClient;

    await expect(materializeImageSources(client, [assetPath])).rejects.toThrow('изображение не найдено');
  });
});
