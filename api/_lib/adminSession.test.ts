import type { PoolClient } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { isRepeatedCreateSourceChoice, transitionAdminSessionStep } from './adminSession.js';

describe('container source callback transitions', () => {
  it('recognizes a repeated tap after the selected source advanced the step', () => {
    expect(isRepeatedCreateSourceChoice({ mode: 'create', step: 'grid-count', itemSource: 'grid' }, 'grid')).toBe(true);
    expect(isRepeatedCreateSourceChoice({ mode: 'create', step: 'item-photo', itemSource: 'single' }, 'single')).toBe(true);
  });

  it('does not treat a current or competing selection as a repeat', () => {
    expect(isRepeatedCreateSourceChoice({ mode: 'create', step: 'item-source' }, 'grid')).toBe(false);
    expect(isRepeatedCreateSourceChoice({ mode: 'create', step: 'grid-count', itemSource: 'grid' }, 'single')).toBe(false);
    expect(isRepeatedCreateSourceChoice(undefined, 'single')).toBe(false);
  });

  it('uses an atomic compare-and-transition query and reports stale callbacks', async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 0 });
    const client = { query } as unknown as PoolClient;
    const nextState = { mode: 'create', step: 'grid-count', itemSource: 'grid' };

    const transitioned = await transitionAdminSessionStep(client, '12345', 'create', 'item-source', nextState);

    expect(transitioned).toBe(false);
    expect(query).toHaveBeenCalledWith(expect.stringContaining("state->>'step' = $3"), [
      '12345', 'create', 'item-source', JSON.stringify(nextState),
    ]);
  });
});
