import { loadLeaderboard } from './_lib/game.js';
import { bodyRecord, methodNotAllowed, type ApiRequest, type ApiResponse, sendError } from './_lib/http.js';
import { authenticateRequest, handleRouteError } from './_lib/route.js';
import type { LeaderboardMetric } from '../src/types/server.js';

const metrics: LeaderboardMetric[] = ['xp', 'respect', 'collection'];

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== 'POST') return methodNotAllowed(response, 'POST');
  try {
    const user = authenticateRequest(request);
    const rawMetric = bodyRecord(request.body)?.metric;
    const metric = metrics.find((entry) => entry === rawMetric);
    if (!metric) {
      return sendError(response, 400, 'Выбери доступный рейтинг.');
    }
    const leaderboard = await loadLeaderboard(user, metric);
    return response.status(200).json({ ok: true, data: leaderboard });
  } catch (failure) {
    return handleRouteError(response, failure);
  }
}
