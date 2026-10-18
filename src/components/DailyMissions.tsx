import { Check, Gift, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { DAILY_MISSIONS, canClaimDailyMission, getDailyMissionProgress, normalizeDailyMissionState } from '../game/dailyMissions';
import type { PlayerState } from '../types/game';
import type { ActionResponse, GameAction } from '../types/server';
import { formatRubles } from '../utils/currency';
import { createId } from '../utils/id';

export default function DailyMissions({ player, onAction }: {
  player: PlayerState;
  onAction: (action: GameAction) => Promise<ActionResponse | undefined>;
}) {
  const [notice, setNotice] = useState('');
  const [pendingId, setPendingId] = useState('');
  const missions = normalizeDailyMissionState(player.dailyMissions);

  const claim = async (missionId: (typeof DAILY_MISSIONS)[number]['id']) => {
    if (pendingId) return;
    setPendingId(missionId);
    setNotice('');
    try {
      const response = await onAction({ type: 'claim-daily-mission', missionId, requestId: createId('daily-mission') });
      setNotice(response?.result?.message ?? 'Не удалось получить награду. Обнови игру и попробуй ещё раз.');
    } finally {
      setPendingId('');
    }
  };

  return (
    <section className="space-y-3 rounded-2xl border border-amber-300/25 bg-gradient-to-br from-[#27251e] to-[#202326] p-4" aria-labelledby="daily-missions-title">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-amber-300/20 bg-amber-300/10 text-amber-200"><Sparkles size={19} /></div>
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-300">Обновляются каждый день · Владивосток</p>
          <h2 id="daily-missions-title" className="mt-0.5 text-base font-black text-white">Ежедневные задания</h2>
          <p className="mt-0.5 text-[10px] text-zinc-500">Выполни цель и забери рубли кнопкой справа.</p>
        </div>
      </div>

      <div className="space-y-2">
        {DAILY_MISSIONS.map((mission) => {
          const progress = getDailyMissionProgress(missions, mission.id);
          const completed = progress >= mission.goal;
          const claimed = missions.claimed.includes(mission.id);
          const pending = pendingId === mission.id;
          return (
            <article key={mission.id} className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-black/20 p-3">
              <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${claimed ? 'bg-emerald-400/10 text-emerald-200' : completed ? 'bg-amber-300/10 text-amber-200' : 'bg-zinc-800 text-zinc-500'}`}>
                {claimed ? <Check size={16} /> : <Gift size={15} />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-black text-white">{mission.title}</p>
                <p className="mt-0.5 text-[9px] text-zinc-500">{mission.description} · {progress}/{mission.goal}</p>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-zinc-800">
                  <div className={`h-full rounded-full transition-all ${completed ? 'bg-amber-300' : 'bg-zinc-500'}`} style={{ width: `${Math.round(progress / mission.goal * 100)}%` }} />
                </div>
              </div>
              <button
                type="button"
                disabled={!canClaimDailyMission(missions, mission) || Boolean(pendingId)}
                onClick={() => void claim(mission.id)}
                className="min-h-10 shrink-0 rounded-lg border border-amber-300/20 bg-amber-300/10 px-2.5 py-2 text-[9px] font-black text-amber-100 disabled:cursor-not-allowed disabled:border-zinc-800 disabled:bg-zinc-900 disabled:text-zinc-600"
              >
                {pending ? '…' : claimed ? 'Получено' : completed ? `${formatRubles(mission.reward)} · Забрать` : formatRubles(mission.reward)}
              </button>
            </article>
          );
        })}
      </div>
      {notice && <p role="status" className="rounded-lg border border-emerald-300/20 bg-emerald-300/5 px-3 py-2 text-[10px] text-emerald-100">{notice}</p>}
    </section>
  );
}
