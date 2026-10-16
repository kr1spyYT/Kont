import { importOwnerSave } from './_lib/game.js';
import { bodyRecord, methodNotAllowed, type ApiRequest, type ApiResponse } from './_lib/http.js';
import { authenticateRequest, handleRouteError } from './_lib/route.js';

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== 'POST') return methodNotAllowed(response, 'POST');
  try {
    const body = bodyRecord(request.body);
    const user = authenticateRequest(request);
    if (!body || !('save' in body)) return response.status(400).json({ ok: false, error: 'Файл сохранения не передан.' });
    const snapshot = await importOwnerSave(user, body.save);
    return response.status(200).json({ ok: true, data: snapshot });
  } catch (failure) {
    return handleRouteError(response, failure);
  }
}
