import { ArrowUp, Coins, RefreshCw, Star, Trophy, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { LeaderboardEntry, LeaderboardMetric } from '../types/server';
import { formatRubles } from '../utils/currency';
import { loadServerLeaderboard } from '../api/client';
import RankBadge from './RankBadge';
import PlayerAvatar from './PlayerAvatar';

const metrics: { id: LeaderboardMetric; label: string; value: (entry: LeaderboardEntry) => string }[] = [
  { id: 'xp', label: 'По XP', value: (entry) => `${entry.xp.toLocaleString('ru-RU')} XP` },
  { id: 'respect', label: 'По респекту', value: (entry) => `${entry.respect.toLocaleString('ru-RU')} респекта` },
  { id: 'collection', label: 'По стоимости коллекции', value: (entry) => formatRubles(entry.collectionValue) },
];

export const formatItemCount = (count: number): string => {
  const form = new Intl.PluralRules('ru-RU').select(count);
  const noun = form === 'one' ? 'предмет' : form === 'few' ? 'предмета' : 'предметов';
  return `${count} ${noun}`;
};

interface LeaderboardModalProps {
  isServerGame: boolean;
  demoEntry: LeaderboardEntry;
  onClose: () => void;
  onOpenProfile: (telegramId: string) => void;
}

const positionStyle = (position: number) => position === 1
  ? 'border-amber-300/40 bg-amber-300/10 text-amber-200'
  : position === 2
    ? 'border-zinc-300/30 bg-zinc-300/5 text-zinc-200'
    : position === 3
      ? 'border-orange-500/30 bg-orange-500/5 text-orange-300'
      : 'border-zinc-800 bg-black/20 text-zinc-500';

export default function LeaderboardModal({ isServerGame, demoEntry, onClose, onOpenProfile }: LeaderboardModalProps) {
  const [metric, setMetric] = useState<LeaderboardMetric>('xp');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([demoEntry]);
  const [currentPosition, setCurrentPosition] = useState(demoEntry.position);
  const [loading, setLoading] = useState(isServerGame);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!isServerGame) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    void loadServerLeaderboard(metric).then((result) => {
      if (cancelled) return;
      setEntries(result.entries);
      setCurrentPosition(result.currentPosition);
    }).catch((failure: unknown) => {
      if (!cancelled) setError(failure instanceof Error ? failure.message : 'Не удалось загрузить рейтинг.');
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [isServerGame, metric, refreshKey]);

  useEffect(() => {
    if (isServerGame) return;
    setEntries([{ ...demoEntry, position: 1 }]);
    setCurrentPosition(1);
    setLoading(false);
    setError('');
  }, [demoEntry, isServerGame]);

  const selectedMetric = metrics.find((entry) => entry.id === metric) ?? metrics[0];
  const podiumEntries = [2, 1, 3]
    .map((position) => entries.find((entry) => entry.position === position))
    .filter((entry): entry is LeaderboardEntry => Boolean(entry));
  const remainingEntries = entries.filter((entry) => entry.position > 3);

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="leaderboard-title" className="flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-[#34383C] bg-[#151719] shadow-2xl sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl border border-amber-300/20 bg-amber-300/10 text-amber-200"><Trophy size={19} /></div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.22em] text-amber-300">Игроки LootLand</p>
              <h2 id="leaderboard-title" className="text-lg font-black text-white">Рейтинг игроков</h2>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {isServerGame && (
              <button
                type="button"
                onClick={() => setRefreshKey((current) => current + 1)}
                disabled={loading}
                aria-label="Обновить рейтинг"
                title="Обновить рейтинг"
                className="grid h-9 w-9 place-items-center rounded-xl border border-zinc-800 text-zinc-400 transition hover:border-amber-300/30 hover:text-amber-200 disabled:cursor-wait disabled:opacity-50"
              >
                <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
              </button>
            )}
            <button type="button" onClick={onClose} aria-label="Закрыть рейтинг" className="grid h-9 w-9 place-items-center rounded-xl border border-zinc-800 text-zinc-400 hover:text-white"><X size={17} /></button>
          </div>
        </div>

        <div className="px-4 pt-4">
          <div className="grid grid-cols-3 gap-1 rounded-xl border border-zinc-800 bg-black/30 p-1">
            {metrics.map((option) => (
              <button key={option.id} type="button" onClick={() => setMetric(option.id)} className={`rounded-lg border px-1 py-2 text-[9px] leading-tight transition ${metric === option.id ? 'bg-gradient-to-r from-[#8c6d2c] via-[#cfa84c] to-[#9a7730] text-black/95 font-extrabold border border-[#f3d47c]/50 shadow-lg' : 'border-transparent font-black text-zinc-400 hover:text-white'}`}>
                {option.label}
              </button>
            ))}
          </div>
          {!isServerGame && <p className="mt-2 text-[9px] text-zinc-600">Демо-рейтинг показывает только текущий локальный профиль.</p>}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {error && <p role="alert" className="mb-3 rounded-xl border border-rose-400/20 bg-rose-400/5 p-3 text-xs text-rose-200">{error}</p>}
          {loading ? <p className="py-10 text-center text-xs text-zinc-500">Загружаем рейтинг…</p> : entries.length ? (
            <>
              {podiumEntries.length > 0 && (
                <section className="rounded-2xl border border-amber-300/20 bg-[radial-gradient(ellipse_at_top,rgba(245,158,11,0.09),transparent_65%)] p-2.5">
                  <p className="px-1 text-[9px] font-black uppercase tracking-[0.18em] text-amber-200">Форбс синдиката · топ-3</p>
                  <div className="mt-2 grid grid-cols-3 items-end gap-1.5">
                    {podiumEntries.map((entry) => {
                      const place = entry.position;
                      const mine = entry.telegramId === demoEntry.telegramId;
                      const column = place === 1 ? 'col-start-2' : place === 2 ? 'col-start-1' : 'col-start-3';
                      const accent = place === 1
                        ? 'border-amber-300/35 bg-amber-300/[0.07]'
                        : place === 2
                          ? 'border-zinc-300/25 bg-zinc-300/[0.04]'
                          : 'border-orange-400/25 bg-orange-400/[0.04]';
                      return (
                        <button
                          key={entry.telegramId}
                          type="button"
                          onClick={() => onOpenProfile(entry.telegramId)}
                          aria-label={`Открыть профиль ${entry.displayName}, место ${place}`}
                          className={`col-span-1 flex min-w-0 flex-col items-center rounded-xl border px-1.5 pb-2 pt-2 text-center transition hover:border-amber-300/45 ${accent} ${column} ${place === 1 ? '-translate-y-1' : ''}`}
                        >
                          <span className={`flex items-end justify-center ${place === 1 ? 'h-[76px] w-16' : 'h-16 w-8'} `}>
                            {place === 1 ? (
                              <img src="/assets/season/genesis/rewards/trophy-gold.webp" alt="Золотой кубок" aria-hidden="true" loading="lazy" className="h-full w-full object-contain drop-shadow-[0_5px_10px_rgba(245,158,11,0.28)]" />
                            ) : (
                              <span className="relative h-16 w-8 overflow-hidden">
                                <img
                                  src="/assets/season/genesis/rewards/trophies-silver-bronze.webp"
                                  alt={place === 2 ? 'Серебряный кубок' : 'Бронзовый кубок'}
                                  aria-hidden="true"
                                  loading="lazy"
                                  className={`absolute top-0 h-16 w-16 max-w-none object-fill ${place === 2 ? 'left-0' : 'left-[-2rem]'}`}
                                />
                              </span>
                            )}
                          </span>
                          <span className="mt-1 flex max-w-full items-center gap-1">
                            <PlayerAvatar photoUrl={entry.avatarUrl} name={entry.username ? `@${entry.username}` : entry.displayName} className="h-6 w-6 shrink-0 text-[9px]" />
                            <span className="min-w-0 truncate text-[9px] font-black text-white">{entry.username ? `@${entry.username}` : entry.displayName}</span>
                          </span>
                          <span className={`mt-1 rounded-full border px-1.5 py-0.5 text-[7px] font-black ${positionStyle(place)}`}>#{place}{mine ? ' · ТЫ' : ''}</span>
                          <span className="mt-1 max-w-full truncate text-[8px] font-bold tabular-nums text-amber-100">{selectedMetric.value(entry)}</span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}
              {remainingEntries.length > 0 && (
                <div className="mt-3 space-y-2">
                  {remainingEntries.map((entry) => {
                    const mine = entry.telegramId === demoEntry.telegramId;
                    return (
                      <button key={entry.telegramId} type="button" onClick={() => onOpenProfile(entry.telegramId)} className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition hover:border-amber-300/30 ${mine ? 'border-amber-300/25 bg-amber-300/5' : 'border-[#34383C] bg-[#202326]'}`}>
                        <span className={`grid h-9 w-10 shrink-0 place-items-center rounded-xl border text-xs font-black ${positionStyle(entry.position)}`}>#{entry.position}</span>
                        <PlayerAvatar photoUrl={entry.avatarUrl} name={entry.username ? `@${entry.username}` : entry.displayName} className="h-10 w-10 text-sm" />
                        <span className="min-w-0 flex-1">
                          <span className="flex min-w-0 items-center gap-1.5">
                            <span className="truncate text-xs font-black text-white">{entry.username ? `@${entry.username}` : entry.displayName}</span>
                            {mine && <span className="shrink-0 rounded-full border border-amber-300/20 px-1.5 py-0.5 text-[7px] font-black text-amber-200">ТЫ</span>}
                          </span>
                          <span className="mt-1 block"><RankBadge title={entry.rankTitle} compact /></span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className="flex items-center justify-end gap-1 text-[10px] font-black tabular-nums text-amber-200">
                            {metric === 'xp' ? <ArrowUp size={11} /> : metric === 'respect' ? <Star size={11} fill="currentColor" /> : <Coins size={11} />}
                            {selectedMetric.value(entry)}
                          </span>
                          <span className="mt-1 block text-[8px] text-zinc-600">{formatItemCount(entry.collectionCount)}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          ) : <p className="py-10 text-center text-xs text-zinc-500">Игроков в рейтинге пока нет.</p>}
        </div>

        <div className="border-t border-zinc-800 bg-[#202326] px-4 py-3">
          <div className="flex items-center justify-between rounded-xl border border-amber-300/20 bg-amber-300/5 px-3 py-2.5">
            <span className="text-[10px] font-bold text-zinc-400">Твоё место · {selectedMetric.label.toLowerCase()}</span>
            <strong className="text-sm font-black text-amber-200">{currentPosition ? `#${currentPosition}` : 'Вне рейтинга'}</strong>
          </div>
        </div>
      </section>
    </div>
  );
}
