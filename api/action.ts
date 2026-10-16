import { performAction } from './_lib/game';
import { bodyRecord, methodNotAllowed, type ApiRequest, type ApiResponse } from './_lib/http';
import { authenticateRequest, handleRouteError } from './_lib/route';
import type { GameAction } from '../src/types/server';

export default async function handler(request: ApiRequest, response: ApiResponse) {
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
