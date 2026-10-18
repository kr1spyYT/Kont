import { useState } from 'react';
import { Gift, LockKeyhole, Sparkles, Star, Trophy } from 'lucide-react';
import type { SeasonPassSnapshot } from '../types/server';
import type { SeasonTrack } from '../game/seasonPass';
import { createServerSeasonInvoice, loadServerSeason, openTelegramInvoice } from '../api/client';
import { getSeasonXpForLevel } from '../game/seasonPass';

interface SeasonTabProps {
  isServerGame: boolean;
  season?: SeasonPassSnapshot;
  loading?: boolean;
  onSeasonChange: (season: SeasonPassSnapshot) => void;
  onClaim: (level: number, track: SeasonTrack) => Promise<string>;
  onRefreshPlayer: () => Promise<void>;
}

const claimKey = (level: number, track: SeasonTrack) => `${level}:${track}`;
const dateLabel = (value?: string) => value
  ? new Date(value).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Moscow' })
  : 'по объявлению';

export default function SeasonTab({ isServerGame, season, loading = false, onSeasonChange, onClaim, onRefreshPlayer }: SeasonTabProps) {
  const [pendingKey, setPendingKey] = useState('');
  const [purchasePending, setPurchasePending] = useState(false);
  const [invoiceLink, setInvoiceLink] = useState('');
  const [notice, setNotice] = useState('');
  const currentLevel = season?.level ?? 1;
  const nextLevelXp = currentLevel < 30 ? getSeasonXpForLevel(currentLevel + 1) : season?.seasonXp ?? 0;
  const currentLevelXp = getSeasonXpForLevel(currentLevel);
  const progressPercent = currentLevel >= 30 ? 100 : Math.min(100, Math.round(((season?.seasonXp ?? 0) - currentLevelXp) / Math.max(1, nextLevelXp - currentLevelXp) * 100));

  const claim = async (level: number, track: SeasonTrack) => {
    const key = claimKey(level, track);
    if (pendingKey || !season) return;
    setPendingKey(key);
    setNotice('');
    try {
      setNotice(await onClaim(level, track));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Не удалось получить награду. Попробуй ещё раз.');
    } finally {
      setPendingKey('');
    }
  };

  const buyPremium = async () => {
    if (purchasePending || !season?.season?.isActive) return;
    setPurchasePending(true);
    setInvoiceLink('');
    setNotice('Готовим защищённый счёт Telegram Stars…');
    try {
      const invoice = await createServerSeasonInvoice();
      const status = await openTelegramInvoice(invoice.invoiceUrl);
      if (status === 'paid') {
        setNotice('Оплата прошла. Подтверждаем Premium Pass в игре…');
        for (let attempt = 0; attempt < 8; attempt += 1) {
          const updated = await loadServerSeason();
          onSeasonChange(updated);
          if (updated.isPremiumPass) {
            setNotice('⭐ Premium Pass активирован. Награды доступны на всех открытых уровнях.');
            await onRefreshPlayer();
            return;
          }
          await new Promise((resolve) => window.setTimeout(resolve, 900));
        }
        setNotice('Платёж получен. Пропуск появится после подтверждения Telegram, обнови вкладку через пару секунд.');
      } else if (status === 'cancelled') {
        setNotice('Оплата отменена, списания не было.');
      } else if (status === 'failed') {
        setNotice('Telegram не завершил оплату. Попробуй ещё раз.');
      } else {
        setInvoiceLink(invoice.invoiceUrl);
        setNotice('Счёт создан. Открой его в Telegram, чтобы оплатить пропуск.');
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Не удалось создать счёт Telegram Stars.');
    } finally {
      setPurchasePending(false);
    }
  };

  return (
    <section className="space-y-5 pb-4">
      <header className="overflow-hidden rounded-3xl border border-amber-300/25 bg-[radial-gradient(circle_at_80%_0%,rgba(251,191,36,0.22),transparent_45%),linear-gradient(140deg,#262116,#161719_65%)] p-5 shadow-xl shadow-black/20">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.24em] text-amber-200"><Sparkles size={13} /> Season 1 · Genesis</p>
            <h1 className="mt-2 text-2xl font-black text-white">Сезонный пропуск</h1>
          </div>
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-amber-200/30 bg-black/25 text-xl font-black text-amber-100">S1</div>
        </div>
        {isServerGame && season ? (
          <>
            <div className="mt-5 flex items-end justify-between gap-3">
              <div><p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Текущий уровень</p><p className="mt-0.5 text-3xl font-black tabular-nums text-amber-100">{season.level}<span className="text-sm text-zinc-500"> / 30</span></p></div>
              <div className="text-right"><p className="text-[10px] font-bold text-zinc-400">Сезонный опыт</p><p className="mt-1 text-sm font-black tabular-nums text-white">{season.seasonXp.toLocaleString('ru-RU')} XP</p></div>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/40"><div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-200 transition-all" style={{ width: `${progressPercent}%` }} /></div>
            <p className="mt-2 text-[10px] text-zinc-400">{season.level >= 30 ? 'Максимальный уровень открыт' : `${Math.max(0, nextLevelXp - season.seasonXp)} XP до уровня ${season.level + 1}`} · до {dateLabel(season.season?.endsAt)}</p>
            <p className="mt-3 text-[10px] leading-relaxed text-zinc-400">Открытие контейнера даёт <b className="text-amber-100">+25 XP</b>, быстрая продажа — <b className="text-amber-100">+10 XP</b> за предмет.</p>
          </>
        ) : (
          <p className="mt-4 text-xs leading-relaxed text-zinc-300">30 уровней, бесплатная дорожка и премиальные награды. Сезонный прогресс хранится на сервере игры.</p>
        )}
      </header>

      {!isServerGame ? (
        <div className="rounded-2xl border border-zinc-700 bg-zinc-900/70 p-4 text-center text-xs leading-relaxed text-zinc-400">Season Pass и Telegram Stars доступны в серверной версии LootLand, открытой через Telegram-бота.</div>
      ) : loading || !season ? (
        <p role="status" className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 text-center text-xs text-zinc-400">Загружаем сезон и награды…</p>
      ) : (
        <>
          {season.season && !season.isPremiumPass && (
            <div className="rounded-2xl border border-yellow-300/25 bg-yellow-300/[0.06] p-4">
              <div className="flex items-start gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-yellow-300/10 text-yellow-200"><Star size={20} fill="currentColor" /></div><div className="min-w-0 flex-1"><h2 className="text-sm font-black text-white">Открой Premium Pass</h2><p className="mt-1 text-[10px] leading-relaxed text-zinc-400">Забери премиальные награды на всех уже пройденных уровнях. Платёж обрабатывается Telegram Stars.</p></div></div>
              <button type="button" disabled={purchasePending || !season.season.isActive} onClick={() => void buyPremium()} className="mt-3 w-full rounded-xl bg-gradient-to-r from-amber-300 to-yellow-200 px-3 py-3 text-xs font-black text-[#17140c] disabled:cursor-not-allowed disabled:opacity-50">{purchasePending ? 'Подготавливаем оплату…' : `⭐ Открыть за ${season.season.premiumPriceStars} Stars`}</button>
              {invoiceLink && <a href={invoiceLink} target="_blank" rel="noreferrer" className="mt-2 block rounded-xl border border-amber-200/30 px-3 py-2.5 text-center text-xs font-bold text-amber-100">Открыть счёт Telegram</a>}
            </div>
          )}
          {season.isPremiumPass && <div className="flex items-center gap-2 rounded-xl border border-yellow-300/25 bg-yellow-300/[0.07] px-3 py-2 text-xs font-bold text-yellow-100"><Star size={15} fill="currentColor" /> Premium Pass активен</div>}
          {notice && <p role="status" aria-live="polite" className="rounded-xl border border-amber-300/20 bg-amber-300/[0.06] px-3 py-2.5 text-xs text-amber-100">{notice}</p>}
          <div className="flex items-center justify-between px-1"><div><h2 className="text-sm font-black text-white">Дорожка наград</h2><p className="mt-0.5 text-[10px] text-zinc-500">Получай уровни, забирай каждую награду отдельно</p></div><Trophy size={19} className="text-amber-200" /></div>
          <div className="relative space-y-3 before:absolute before:bottom-5 before:left-[20px] before:top-5 before:w-px before:bg-gradient-to-b before:from-amber-300/60 before:via-zinc-700 before:to-transparent">
            {season.tiers.map((tier) => {
              const unlocked = season.level >= tier.level;
              const freeKey = claimKey(tier.level, 'free');
              const premiumKey = claimKey(tier.level, 'premium');
              const freeClaimed = season.claimedRewards.includes(freeKey);
              const premiumClaimed = season.claimedRewards.includes(premiumKey);
              return (
                <article key={tier.level} className={`relative rounded-2xl border p-3 pl-12 ${unlocked ? 'border-amber-300/20 bg-[#202326]' : 'border-zinc-800 bg-zinc-900/50 opacity-75'}`}>
                  <div className={`absolute left-2.5 top-3 grid h-8 w-8 place-items-center rounded-full border text-[10px] font-black ${unlocked ? 'border-amber-200/50 bg-amber-300 text-[#17140c]' : 'border-zinc-700 bg-zinc-800 text-zinc-400'}`}>{tier.level}</div>
                  <div className="mb-2 flex items-center justify-between gap-2"><p className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Уровень {tier.level}</p><p className="text-[9px] font-bold tabular-nums text-zinc-600">{tier.xpRequired.toLocaleString('ru-RU')} XP</p></div>
                  <div className="grid grid-cols-2 gap-2">
                    <RewardCard label="Бесплатно" title={tier.free.title} unlocked={unlocked} claimed={freeClaimed} busy={pendingKey === freeKey} locked={!unlocked} onClick={() => void claim(tier.level, 'free')} />
                    <RewardCard label="Premium" title={tier.premium.title} unlocked={unlocked && season.isPremiumPass} claimed={premiumClaimed} busy={pendingKey === premiumKey} locked={!season.isPremiumPass} special={tier.level === 20 || tier.level === 30} onClick={() => void claim(tier.level, 'premium')} />
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}

function RewardCard({ label, title, unlocked, claimed, busy, locked, special = false, onClick }: {
  label: string; title: string; unlocked: boolean; claimed: boolean; busy: boolean; locked: boolean; special?: boolean; onClick: () => void;
}) {
  const canClaim = unlocked && !claimed && !locked && !busy;
  return (
    <div className={`min-w-0 rounded-xl border p-2 ${special ? 'border-yellow-200/25 bg-yellow-300/[0.06]' : 'border-white/5 bg-black/20'}`}>
      <p className={`flex items-center gap-1 text-[8px] font-black uppercase tracking-wide ${special ? 'text-yellow-100' : 'text-zinc-500'}`}>{locked ? <LockKeyhole size={10} /> : <Gift size={10} />}{label}</p>
      <p className="mt-1 min-h-8 text-[9px] font-bold leading-relaxed text-zinc-200">{title}</p>
      {canClaim ? <button type="button" onClick={onClick} className="mt-1.5 w-full rounded-lg bg-amber-300 px-1.5 py-2 text-[9px] font-black text-[#17140c]">{busy ? 'Выдаём…' : 'Забрать'}</button>
        : <p className="mt-1.5 w-full rounded-lg bg-white/[0.035] px-1.5 py-2 text-center text-[8px] font-black text-zinc-500">{claimed ? 'Получено' : locked ? 'Заблокировано' : 'Закрыто'}</p>}
    </div>
  );
}
