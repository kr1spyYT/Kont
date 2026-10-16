import { AuthenticationError, verifyTelegramInitData } from './auth';
import { databaseSetupHint } from './db';
import { bodyRecord, sendError, type ApiRequest, type ApiResponse } from './http';

export const authenticateRequest = (request: ApiRequest) => {
  const body = bodyRecord(request.body);
  const initData = body?.initData;
  if (typeof initData !== 'string') throw new AuthenticationError('Открой игру через Telegram, чтобы войти.');
  return verifyTelegramInitData(initData);
};

export const handleRouteError = (response: ApiResponse, failure: unknown) => {
  if (failure instanceof AuthenticationError) return sendError(response, 401, failure.message);
  const statusCode = typeof failure === 'object' && failure !== null && 'statusCode' in failure
    ? Number((failure as { statusCode?: unknown }).statusCode)
    : 500;
  const errorCode = typeof failure === 'object' && failure !== null && 'code' in failure
    ? String((failure as { code?: unknown }).code)
    : '';
  if (errorCode === '42P01' || errorCode === '3F000') {
    return sendError(response, 503, `База не подготовлена. ${databaseSetupHint}`);
  }
  const message = failure instanceof Error ? failure.message : 'Серверная ошибка. Попробуй позже.';
  if (statusCode >= 400 && statusCode < 500) return sendError(response, statusCode, message);
  if (message.includes('DATABASE_URL') || message.includes('TELEGRAM_BOT_TOKEN')) return sendError(response, 503, message);
  console.error('KONT API error:', failure);
  return sendError(response, 500, 'Серверная игра временно недоступна. Проверь настройки Vercel и Neon.');
};
