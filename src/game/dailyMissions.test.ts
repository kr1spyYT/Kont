import { describe, expect, it } from 'vitest';
import {
  claimDailyMissionReward,
  getMissionDay,
  normalizeDailyMissionState,
  recordDailyMissionProgress,
} from './dailyMissions';

describe('daily missions', () => {
  it('tracks progress and grants a reward only once', () => {
    const day = new Date('2026-10-17T01:00:00.000Z');
    const started = normalizeDailyMissionState(undefined, day);
    const completed = recordDailyMissionProgress(started, 'open-container', 1, day);
    const claimed = claimDailyMissionReward(completed, 'open-container', day);

    expect(claimed.reward).toBe(2_000);
    expect(claimed.state.claimed).toEqual(['open-container']);
    expect(() => claimDailyMissionReward(claimed.state, 'open-container', day)).toThrow('уже получена');
  });

  it('resets progress at the Vladivostok calendar day boundary', () => {
    const yesterday = new Date('2026-10-16T13:00:00.000Z');
    const today = new Date('2026-10-16T15:00:00.000Z');
    const yesterdayState = recordDailyMissionProgress(undefined, 'spin-license-plate', 1, yesterday);
    const reset = normalizeDailyMissionState(yesterdayState, today);

    expect(getMissionDay(yesterday)).not.toBe(getMissionDay(today));
    expect(reset).toMatchObject({ day: getMissionDay(today), progress: {}, claimed: [] });
  });

  it('caps counts at the mission goal and ignores invalid amounts', () => {
    const progress = recordDailyMissionProgress(undefined, 'sell-license-plate', 30);
    expect(progress.progress['sell-license-plate']).toBe(1);
    expect(recordDailyMissionProgress(progress, 'sell-license-plate', 0)).toEqual(progress);
  });
});
