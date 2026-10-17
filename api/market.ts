import { loadMarket } from './_lib/game.js';
import { methodNotAllowed, type ApiRequest, type ApiResponse } from './_lib/http.js';
import { authenticateRequest, handleRouteError } from './_lib/route.js';

export default async function handler(request: ApiRequest, response: ApiResponse) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'POST') return methodNotAllowed(response, 'POST');
  try {
    const user = authenticateRequest(request);
    const market = await loadMarket(user);
    return response.status(200).json({ ok: true, data: market });
  } catch (failure) {
    return handleRouteError(response, failure);
  }
}
