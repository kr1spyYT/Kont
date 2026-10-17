import { performAction } from './_lib/game.js';
import { bodyRecord, methodNotAllowed, type ApiRequest, type ApiResponse } from './_lib/http.js';
import { authenticateRequest, handleRouteError } from './_lib/route.js';
import type { GameAction } from '../src/types/server.js';

export default async function handler(request: ApiRequest, response: ApiResponse) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'POST') return methodNotAllowed(response, 'POST');
  try {
    const body = bodyRecord(request.body);
    const user = authenticateRequest(request);
    if (!body || typeof body.action !== 'object' || body.action === null) {
      return response.status(400).json({ ok: false, error: 'Игровое действие имеет неверный формат.' });
    }
    const result = await performAction(user, body.action as GameAction);
    return response.status(200).json({ ok: true, data: result });
  } catch (failure) {
    return handleRouteError(response, failure);
  }
}
