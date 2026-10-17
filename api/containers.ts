import { listContainerCatalog } from './_lib/containers.js';
import { getPool } from './_lib/db.js';
import { methodNotAllowed, type ApiRequest, type ApiResponse } from './_lib/http.js';
import { authenticateRequest, handleRouteError } from './_lib/route.js';

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== 'POST') return methodNotAllowed(response, 'POST');
  let client: import('pg').PoolClient | undefined;
  try {
    authenticateRequest(request);
    client = await getPool().connect();
    const containers = await listContainerCatalog(client);
    return response.status(200).json({ ok: true, data: containers });
  } catch (failure) {
    return handleRouteError(response, failure);
  } finally {
    client?.release();
  }
}
