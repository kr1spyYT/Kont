import { loadPlayer } from './_lib/game';
import { methodNotAllowed, type ApiRequest, type ApiResponse } from './_lib/http';
import { authenticateRequest, handleRouteError } from './_lib/route';

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== 'POST') return methodNotAllowed(response, 'POST');
  try {
    const user = authenticateRequest(request);
    const snapshot = await loadPlayer(user);
    return response.status(200).json({ ok: true, data: snapshot });
  } catch (failure) {
    return handleRouteError(response, failure);
  }
}
