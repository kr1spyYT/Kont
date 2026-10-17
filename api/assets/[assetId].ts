import { getPool } from '../_lib/db.js';
import { type ApiRequest, type ApiResponse } from '../_lib/http.js';

interface AssetRequest extends ApiRequest {
  query?: { assetId?: string | string[] };
}

export default async function handler(request: AssetRequest, response: ApiResponse) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).end();
  }
  const rawId = request.query?.assetId;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  if (!id || !/^[a-zA-Z0-9_-]{8,100}$/.test(id)) return response.status(404).end();
  try {
    const { rows } = await getPool().query<{ content_type: string; image_data: Buffer }>(
      'SELECT content_type, image_data FROM game_assets WHERE id = $1',
      [id],
    );
    const asset = rows[0];
    if (!asset) return response.status(404).end();
    response.setHeader('Content-Type', asset.content_type);
    response.setHeader('Content-Length', asset.image_data.length);
    response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return response.status(200).end(asset.image_data);
  } catch (failure) {
    console.error('LootLand image asset lookup failed.', failure);
    return response.status(500).end();
  }
}
