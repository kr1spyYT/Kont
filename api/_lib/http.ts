import type { IncomingMessage, ServerResponse } from 'node:http';

export interface ApiRequest extends IncomingMessage {
  body?: unknown;
}

export interface ApiResponse extends ServerResponse {
  status(code: number): this;
  json(body: unknown): this;
}

export const bodyRecord = (body: unknown): Record<string, unknown> | undefined =>
  typeof body === 'object' && body !== null && !Array.isArray(body)
    ? body as Record<string, unknown>
    : undefined;

export const sendError = (response: ApiResponse, status: number, message: string) =>
  response.status(status).json({ ok: false, error: message });

export const methodNotAllowed = (response: ApiResponse, allowed: string) => {
  response.setHeader('Allow', allowed);
  return sendError(response, 405, 'Метод запроса не поддерживается.');
};
