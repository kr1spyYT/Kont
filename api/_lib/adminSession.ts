import type { PoolClient } from 'pg';

interface CreateSourceSession {
  mode: string;
  step?: string;
  itemSource?: 'grid' | 'single';
}

export function isRepeatedCreateSourceChoice(
  session: CreateSourceSession | undefined,
  source: 'grid' | 'single',
): boolean {
  return session?.mode === 'create' && session.step !== 'item-source' && session.itemSource === source;
}

export async function transitionAdminSessionStep(
  client: PoolClient,
  telegramId: string,
  expectedMode: string,
  expectedStep: string,
  nextState: object,
): Promise<boolean> {
  const result = await client.query(
    `UPDATE telegram_admin_sessions
     SET state = $4::jsonb, updated_at = NOW()
     WHERE telegram_id = $1 AND state->>'mode' = $2 AND state->>'step' = $3`,
    [telegramId, expectedMode, expectedStep, JSON.stringify(nextState)],
  );
  return result.rowCount === 1;
}