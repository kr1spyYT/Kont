import { ArrowRight, Music2, Music4, TicketPercent, Trophy } from 'lucide-react';
import type { PlayerState } from '../types/game';
import type { ActionResponse, GameAction } from '../types/server';
import DailyMissions from './DailyMissions';

const upcomingFeatures = [
  { title: 'Промокоды', description: 'Бонусы и подарки по кодам', Icon: TicketPercent },
];

export default function MoreTab({
  player,
  onAction,
  onOpenLeaderboard,
  musicEnabled,
  onToggleMusic,
}: {
  player: PlayerState;
  onAction: (action: GameAction) => Promise<ActionResponse | undefined>;
  onOpenLeaderboard: () => void;
  musicEnabled: boolean;
  onToggleMusic: () => void;
}) {
  return (
    <section className="space-y-4">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-300">Развитие игры</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-white">Ещё</h1>
        <p className="mt-1 text-xs text-zinc-500">События, награды и таблица лидеров.</p>
      </div>

      <DailyMissions player={player} onAction={onAction} />

      <button type="button" onClick={onOpenLeaderboard} className="group flex w-full items-center gap-3 rounded-2xl border border-amber-300/25 bg-gradient-to-r from-[#25251f] to-[#202326] p-4 text-left transition hover:border-amber-300/50 hover:bg-amber-300/5">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-amber-300/20 bg-amber-300/10 text-amber-200">
          <Trophy size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-black text-[#F2EFE8]">Рейтинг игроков</h2>
          <p className="mt-0.5 text-[11px] text-zinc-500">Сравнивай свой респект с другими</p>
        </div>
        <span className="flex shrink-0 items-center gap-1 rounded-full border border-amber-300/30 bg-amber-300/10 px-2 py-1 text-[8px] font-black uppercase tracking-wide text-amber-200">
          ТОП <ArrowRight size={11} className="transition-transform group-hover:translate-x-0.5" />
        </span>
      </button>

      <button type="button" onClick={onToggleMusic} aria-pressed={musicEnabled} className="flex w-full items-center gap-3 rounded-2xl border border-[#34383C] bg-[#202326] p-4 text-left transition hover:border-amber-300/30">
        <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl border ${musicEnabled ? 'border-amber-300/30 bg-amber-300/10 text-amber-200' : 'border-zinc-700 bg-zinc-900 text-zinc-400'}`}>
          {musicEnabled ? <Music2 size={20} /> : <Music4 size={20} />}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-black text-[#F2EFE8]">Фоновая музыка</h2>
          <p className="mt-0.5 text-[11px] text-zinc-500">Энергичный электронный бит LootLand</p>
        </div>
        <span className={`rounded-full border px-2 py-1 text-[8px] font-black uppercase tracking-wide ${musicEnabled ? 'border-amber-300/30 bg-amber-300/10 text-amber-200' : 'border-zinc-700 bg-zinc-900 text-zinc-500'}`}>
          {musicEnabled ? 'Вкл' : 'Выкл'}
        </span>
      </button>

      <div className="space-y-2.5">
        {upcomingFeatures.map(({ title, description, Icon }) => (
          <article key={title} className="flex items-center gap-3 rounded-2xl border border-[#34383C] bg-[#202326] p-4">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-amber-300/15 bg-amber-300/5 text-amber-300">
              <Icon size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-black text-[#F2EFE8]">{title}</h2>
              <p className="mt-0.5 text-[11px] text-zinc-500">{description}</p>
            </div>
            <span className="shrink-0 rounded-full border border-zinc-700 bg-zinc-900 px-2 py-1 text-[8px] font-black uppercase tracking-wide text-zinc-500">
              Скоро
            </span>
          </article>
        ))}
      </div>
    </section>
  );
}
