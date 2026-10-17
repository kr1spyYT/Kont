import { loadPublicProfile } from './_lib/game.js';
import { bodyRecord, methodNotAllowed, type ApiRequest, type ApiResponse, sendError } from './_lib/http.js';
import { authenticateRequest, handleRouteError } from './_lib/route.js';

export default async function handler(request: ApiRequest, response: ApiResponse) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'POST') return methodNotAllowed(response, 'POST');
  try {
    const viewer = authenticateRequest(request);
    const telegramId = bodyRecord(request.body)?.telegramId;
    if (typeof telegramId !== 'string' || !/^\d{1,20}$/.test(telegramId)) {
      return sendError(response, 400, 'Не удалось определить профиль игрока.');
    }
    const profile = await loadPublicProfile(telegramId, viewer.id);
    if (!profile) return sendError(response, 404, 'Профиль игрока не найден.');
    return response.status(200).json({ ok: true, data: profile });
  } catch (failure) {
    return handleRouteError(response, failure);
  }
}
