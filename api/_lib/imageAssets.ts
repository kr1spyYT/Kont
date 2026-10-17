import type { PoolClient } from 'pg';

const MAX_IMAGE_SOURCE_LENGTH = 2_800_000;
const ASSET_PATH = /^\/api\/assets\/([a-zA-Z0-9_-]{8,100})$/;
const DATA_IMAGE = /^data:image\/(?:webp|png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/;

interface StoredImageAsset {
  id: string;
  content_type: string;
  image_data: Buffer;
}

export function isSupportedImageSource(image: string): boolean {
  if (!image || image.length > MAX_IMAGE_SOURCE_LENGTH) return false;
  if (DATA_IMAGE.test(image)) return true;
  if (ASSET_PATH.test(image)) return true;
  return /^[a-zA-Z0-9_./-]+$/.test(image) && !image.split('/').includes('..');
}

export async function materializeImageSources(client: PoolClient, sources: string[]): Promise<string[]> {
  const assetIds = [...new Set(sources.flatMap((source) => {
    const assetId = ASSET_PATH.exec(source)?.[1];
    return assetId ? [assetId] : [];
  }))];
  if (!assetIds.length) return sources;

  const { rows } = await client.query<StoredImageAsset>(
    'SELECT id, content_type, image_data FROM game_assets WHERE id = ANY($1::text[])',
    [assetIds],
  );
  const assets = new Map(rows.map((asset) => [asset.id, asset]));
  return sources.map((source) => {
    const assetId = ASSET_PATH.exec(source)?.[1];
    if (!assetId) return source;
    const asset = assets.get(assetId);
    if (!asset) throw new Error('Обработанное изображение не найдено в хранилище. Загрузи картинку ещё раз.');
    if (asset.content_type !== 'image/webp') throw new Error('В хранилище найдено изображение неподдерживаемого формата.');
    return `data:${asset.content_type};base64,${Buffer.from(asset.image_data).toString('base64')}`;
  });
}