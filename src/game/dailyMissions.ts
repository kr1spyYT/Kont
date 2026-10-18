import type { DailyMissionId, DailyMissionState } from '../types/game.js';

export interface DailyMissionDefinition {
  id: DailyMissionId;
  title: string;
  description: string;
  goal: number;
  reward: number;
}

export const DAILY_MISSIONS: DailyMissionDefinition[] = [
  { id: 'open-container', title: 'Загляни в контейнер', description: 'Открой любой контейнер', goal: 1, reward: 2_000 },
  { id: 'spin-license-plate', title: 'Прокрути рулетку', description: 'Получи новый номер', goal: 1, reward: 1_500 },
  { id: 'sell-license-plate', title: 'Освободи коллекцию', description: 'Продай один номер перекупу', goal: 1, reward: 1_000 },
];

const missionIds = DAILY_MISSIONS.map((mission) => mission.id);
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isMissionId = (value: unknown): value is DailyMissionId =>
  typeof value === 'string' && missionIds.includes(value as DailyMissionId);

export const getMissionDay = (at = new Date()): string => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Vladivostok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(at);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((entry) => entry.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
};

export const normalizeDailyMissionState = (value: unknown, at = new Date()): DailyMissionState => {
  const day = getMissionDay(at);
  if (!isRecord(value) || value.day !== day) return { day, progress: {}, claimed: [] };

  const rawProgress = isRecord(value.progress) ? value.progress : {};
  const progress: DailyMissionState['progress'] = {};
  for (const mission of DAILY_MISSIONS) {
    const amount = rawProgress[mission.id];
    if (typeof amount === 'number' && Number.isFinite(amount) && amount > 0) {
      progress[mission.id] = Math.min(mission.goal, Math.floor(amount));
    }
  }
  const claimed = Array.isArray(value.claimed)
    ? value.claimed.filter((id): id is DailyMissionId => isMissionId(id))
    : [];
  return { day, progress, claimed: [...new Set(claimed)] };
};

export const recordDailyMissionProgress = (
  value: unknown,
  missionId: DailyMissionId,
  amount = 1,
  at = new Date(),
): DailyMissionState => {
  const state = normalizeDailyMissionState(value, at);
  if (!Number.isSafeInteger(amount) || amount < 1) return state;
  const mission = DAILY_MISSIONS.find((entry) => entry.id === missionId)!;
  return {
    ...state,
    progress: { ...state.progress, [missionId]: Math.min(mission.goal, (state.progress[missionId] ?? 0) + amount) },
  };
};

export const claimDailyMissionReward = (
  value: unknown,
  missionId: DailyMissionId,
  at = new Date(),
): { state: DailyMissionState; reward: number } => {
  const state = normalizeDailyMissionState(value, at);
  const mission = DAILY_MISSIONS.find((entry) => entry.id === missionId);
  if (!mission) throw new Error('Ежедневное задание не найдено.');
  if ((state.progress[missionId] ?? 0) < mission.goal) throw new Error('Сначала выполни ежедневное задание.');
  if (state.claimed.includes(missionId)) throw new Error('Награда за это задание уже получена.');
  return { state: { ...state, claimed: [...state.claimed, missionId] }, reward: mission.reward };
};

export const isDailyMissionId = isMissionId;

export const getDailyMissionProgress = (state: DailyMissionState, missionId: DailyMissionId): number =>
  Math.min(DAILY_MISSIONS.find((mission) => mission.id === missionId)?.goal ?? 0, state.progress[missionId] ?? 0);

export const isDailyMissionClaimed = (state: DailyMissionState, missionId: DailyMissionId): boolean =>
  state.claimed.includes(missionId);

export const canClaimDailyMission = (state: DailyMissionState, mission: DailyMissionDefinition): boolean =>
  !state.claimed.includes(mission.id) && getDailyMissionProgress(state, mission.id) >= mission.goal;

export const DAILY_MISSION_IDS: readonly DailyMissionId[] = missionIds;

export const isDailyMissionState = (value: unknown): value is DailyMissionState =>
  isRecord(value) && typeof value.day === 'string' && isRecord(value.progress) && Array.isArray(value.claimed);

export const assertDailyMissionId = (value: unknown): asserts value is DailyMissionId => {
  if (!isMissionId(value)) throw new Error('Ежедневное задание не найдено.');
};
