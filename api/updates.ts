import { loadPlayer } from './_lib/game.js';
import { getPool } from './_lib/db.js';
import { bodyRecord, methodNotAllowed, sendError, type ApiRequest, type ApiResponse } from './_lib/http.js';
import { authenticateRequest, handleRouteError } from './_lib/route.js';
import {
  ensureGameUpdateTables,
  listUnseenGameUpdates,
  markGameUpdateSeen,
  publishGameUpdate,
  requireGameUpdatePublisher,
  validateGameUpdateDraft,
} from './_lib/gameUpdates.js';

export default async function handler(request: ApiRequest, response: ApiResponse) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'POST') return methodNotAllowed(response, 'POST');

  try {
    const user = authenticateRequest(request);
    const body = bodyRecord(request.body);
    const action = body?.action;
    if (action !== 'list' && action !== 'acknowledge' && action !== 'publish') {
      return sendError(response, 400, 'Неизвестное действие с обновлением.');
    }

    if (action === 'publish') requireGameUpdatePublisher(user.id);
    const draft = action === 'publish' ? validateGameUpdateDraft(body?.title, body?.body) : undefined;
    const updateId = action === 'acknowledge' ? body?.updateId : undefined;
    if (action === 'acknowledge' && (typeof updateId !== 'string' || !updateId.trim() || updateId.length > 100)) {
      return sendError(response, 400, 'Не удалось определить обновление.');
    }

    await loadPlayer(user);
    const client = await getPool().connect();
    try {
      await ensureGameUpdateTables(client);
      if (action === 'list') {
        return response.status(200).json({ ok: true, data: await listUnseenGameUpdates(client, user.id) });
      }
      if (action === 'publish') {
        return response.status(200).json({ ok: true, data: await publishGameUpdate(client, user.id, draft!) });
      }
      const acknowledged = await markGameUpdateSeen(client, user.id, updateId as string);
      return response.status(200).json({ ok: true, data: { acknowledged } });
    } finally {
      client.release();
    }
  } catch (failure) {
    return handleRouteError(response, failure);
  }
}
