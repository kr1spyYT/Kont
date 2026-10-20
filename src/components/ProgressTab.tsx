import { Music2, Music4, Sparkles, Trophy } from 'lucide-react';
import type { PlayerState } from '../types/game';
import type { ActionResponse, GameAction, SeasonPassSnapshot } from '../types/server';
import type { SeasonTrack } from '../game/seasonPass';
import DailyMissions from './DailyMissions';
import SeasonTab from './SeasonTab';

export type ProgressView = 'overview' | 'season';

export default function ProgressTab({
  player,
  onAction,
  view,
  onViewChange,
  isServerGame,
  season,
  loading,
  onSeasonChange,
  onClaim,
  onRefreshPlayer,
  onOpenLeaderboard,
  musicEnabled,
  onToggleMusic,
}: {
  player: PlayerState;
  onAction: (action: GameAction) => Promise<ActionResponse | undefined>;
  view: ProgressView;
  onViewChange: (view: ProgressView) => void;
  isServerGame: boolean;
  season?: SeasonPassSnapshot;
  loading: boolean;
  onSeasonChange: (season: SeasonPassSnapshot) => void;
  onClaim: (level: number, track: SeasonTrack) => Promise<string>;
  onRefreshPlayer: () => Promise<void>;
  onOpenLeaderboard: () => void;
  musicEnabled: boolean;
  onToggleMusic: () => void;
}) {
  return (
    <section className="space-y-4">
      <header>
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-300">Цели, награды и настройки</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-white">Прогресс</h1>
      </header>

      <div role="group" aria-label="Раздел прогресса" className="grid grid-cols-2 gap-1 rounded-xl border border-amber-300/15 bg-[#111116] p-1">
        {([
          ['overview', 'Обзор', Sparkles],
          ['season', 'Сезон', Trophy],
        ] as const).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            aria-pressed={view === id}
            onClick={() => onViewChange(id)}
            className={`flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-1.5 py-2 text-[10px] font-black transition sm:text-xs ${view === id ? 'border border-amber-300/25 bg-amber-300/10 text-amber-100' : 'text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-200'}`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {view === 'overview' && (
        <>
          <DailyMissions player={player} onAction={onAction} />
          <button
            type="button"
            onClick={() => onViewChange('season')}
            className="flex w-full items-center gap-3 rounded-2xl border border-amber-300/20 bg-gradient-to-r from-[#25251f] to-[#202326] p-4 text-left transition hover:border-amber-300/45"
          >
            <Sparkles size={19} className="shrink-0 text-amber-200" />
            <span className="min-w-0 flex-1">
              <strong className="block text-sm text-white">Сезонный пропуск</strong>
              <span className="mt-0.5 block text-[10px] text-zinc-500">Уровни, контракты и награды</span>
            </span>
            <span className="text-xs font-black text-amber-200">Открыть →</span>
          </button>
          <button
            type="button"
            onClick={onOpenLeaderboard}
            className="flex w-full items-center gap-3 rounded-2xl border border-zinc-800 bg-[#17171b] p-4 text-left transition hover:border-amber-300/30"
          >
            <Trophy size={19} className="shrink-0 text-amber-200" />
            <span className="min-w-0 flex-1">
              <strong className="block text-sm text-white">Рейтинг игроков</strong>
              <span className="mt-0.5 block text-[10px] text-zinc-500">Сравни свой респект с другими</span>
            </span>
            <span className="text-xs font-black text-amber-200">ТОП →</span>
          </button>
          <button
            type="button"
            onClick={onToggleMusic}
            aria-pressed={musicEnabled}
            className="flex w-full items-center justify-between rounded-xl border border-zinc-800 bg-[#17171b] px-3 py-2.5 text-left transition hover:border-amber-300/30"
          >
            <span className="flex items-center gap-2 text-[10px] font-bold text-zinc-300">
              {musicEnabled ? <Music2 size={14} className="text-amber-200" /> : <Music4 size={14} className="text-zinc-500" />}
              Фоновая музыка
            </span>
            <span className={`rounded-full border px-2 py-1 text-[8px] font-black ${musicEnabled ? 'border-amber-300/30 bg-amber-300/10 text-amber-200' : 'border-zinc-700 bg-zinc-900 text-zinc-500'}`}>
              {musicEnabled ? 'Вкл' : 'Выкл'}
            </span>
          </button>
        </>
      )}

      {view === 'season' && (
        <SeasonTab
          isServerGame={isServerGame}
          season={season}
          loading={loading}
          onSeasonChange={onSeasonChange}
          onClaim={onClaim}
          onRefreshPlayer={onRefreshPlayer}
        />
      )}

    </section>
  );
}
