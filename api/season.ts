import { bodyRecord, methodNotAllowed, type ApiRequest, type ApiResponse } from './_lib/http.js';
import { authenticateRequest, handleRouteError } from './_lib/route.js';
import { getPool } from './_lib/db.js';
import { ensureContainerCatalog } from './_lib/containers.js';
import { claimSeasonContract, claimSeasonReward, createSeasonPassInvoice, getSeasonSnapshot } from './_lib/season.js';
import type { SeasonTrack } from '../src/game/seasonPass.js';

export default async function handler(request: ApiRequest, response: ApiResponse) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'POST') return methodNotAllowed(response, 'POST');
  let client: import('pg').PoolClient | undefined;
  try {
    const user = authenticateRequest(request);
    const body = bodyRecord(request.body);
    if (!body || !['list', 'invoice', 'claim', 'claim-contract'].includes(String(body.action))) {
      return response.status(400).json({ ok: false, error: 'Действие сезонного пропуска имеет неверный формат.' });
    }
    client = await getPool().connect();
    await ensureContainerCatalog(client);
    if (body.action === 'list') {
      const data = await getSeasonSnapshot(client, user.id);
      return response.status(200).json({ ok: true, data });
    }
    if (body.action === 'invoice') {
      const data = await createSeasonPassInvoice(client, user);
      return response.status(200).json({ ok: true, data });
    }
    if (body.action === 'claim-contract') {
      const result = await claimSeasonContract(client, user, String(body.contractId ?? ''));
      return response.status(200).json({ ok: true, data: result });
    }
    const result = await claimSeasonReward(
      client,
      user,
      Number(body.level),
      body.track as SeasonTrack,
    );
    return response.status(200).json({ ok: true, data: result });
  } catch (failure) {
    return handleRouteError(response, failure);
  } finally {
    client?.release();
  }
}
