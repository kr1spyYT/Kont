import { useEffect, useState } from 'react';
import { ArrowRight, Check, Clock3, Gift, LockKeyhole, Zap } from 'lucide-react';
import type { SeasonPassSnapshot } from '../types/server';
import type { SeasonReward, SeasonTrack } from '../game/seasonPass';
import { createServerSeasonInvoice, loadServerSeason, openTelegramInvoice } from '../api/client';
import { getSeasonXpForLevel, seasonRewardAsset, seasonRewardSummary } from '../game/seasonPass';

interface SeasonTabProps {
  isServerGame: boolean;
  season?: SeasonPassSnapshot;
  loading?: boolean;
  onSeasonChange: (season: SeasonPassSnapshot) => void;
  onClaim: (level: number, track: SeasonTrack) => Promise<string>;
  onRefreshPlayer: () => Promise<void>;
  onQuickSell: () => Promise<string>;
}

const claimKey = (level: number, track: SeasonTrack) => `${level}:${track}`;
const dateLabel = (value?: string) => value
  ? new Date(value).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Moscow' })
  : 'по объявлению';

const countdown = (value?: string, now = Date.now()) => {
  if (!value) return 'Без даты окончания';
  const remaining = Math.max(0, new Date(value).getTime() - now);
  const days = Math.floor(remaining / 86_400_000);
  const hours = Math.floor((remaining % 86_400_000) / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  return `${days} д. ${hours} ч. ${minutes} м.`;
};

const rewardTone: Record<SeasonTrack, string> = {
  free: 'border-slate-400/20 bg-[#11161a] text-slate-100',
  premium: 'border-amber-300/25 bg-[linear-gradient(120deg,rgba(48,36,14,.68),rgba(12,14,16,.94)_45%)] text-amber-50',
};

export default function SeasonTab({ isServerGame, season, loading = false, onSeasonChange, onClaim, onRefreshPlayer, onQuickSell }: SeasonTabProps) {
  const [pendingKey, setPendingKey] = useState('');
  const [purchasePending, setPurchasePending] = useState(false);
  const [invoiceLink, setInvoiceLink] = useState('');
  const [notice, setNotice] = useState('');
  const [sellDialog, setSellDialog] = useState(false);
  const [selling, setSelling] = useState(false);
  const [now, setNow] = useState(Date.now());
  const currentLevel = season?.level ?? 1;
  const nextLevelXp = currentLevel < 30 ? getSeasonXpForLevel(currentLevel + 1) : season?.seasonXp ?? 0;
  const currentLevelXp = getSeasonXpForLevel(currentLevel);
  const progressPercent = currentLevel >= 30 ? 100 : Math.min(100, Math.round(((season?.seasonXp ?? 0) - currentLevelXp) / Math.max(1, nextLevelXp - currentLevelXp) * 100));

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

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

  const quickSell = async () => {
    if (selling) return;
    setSelling(true);
    setNotice('');
    try {
      setNotice(await onQuickSell());
      setSellDialog(false);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Не удалось быстро продать подходящие предметы.');
    } finally {
      setSelling(false);
    }
  };

  return (
    <section className="mx-auto w-full max-w-5xl space-y-4 pb-6 text-white">
      <header className="relative isolate grid min-h-[210px] grid-cols-[1fr_0.8fr] overflow-hidden rounded-[26px] border border-amber-400/35 bg-[#090b0d] shadow-[0_18px_60px_rgba(0,0,0,.4)] sm:min-h-[260px]">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_78%_55%,rgba(214,155,38,.22),transparent_40%),linear-gradient(105deg,#111315,#070809_70%)]" />
        <div className="relative z-10 flex flex-col justify-center p-4 sm:p-7">
          <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[.22em] text-amber-200 sm:text-[11px]"><img src="/assets/season/genesis/season-crown.webp" alt="" className="h-8 w-8 object-contain sm:h-12 sm:w-12" /> Genesis S1</div>
          <h1 className="mt-1 text-xl font-black uppercase leading-none tracking-tight text-white sm:text-4xl">Season Pass</h1>
          <p className="mt-2 max-w-sm text-[10px] leading-relaxed text-slate-300 sm:mt-3 sm:text-sm">Выполняй задания, поднимай уровень и забирай эксклюзивные награды.</p>
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-amber-100/20 bg-black/45 px-2.5 py-2 sm:mt-5 sm:max-w-sm sm:px-3.5 sm:py-3">
            <Clock3 size={19} className="shrink-0 text-amber-300 sm:h-6 sm:w-6" />
            <div className="min-w-0"><p className="text-[8px] text-slate-400 sm:text-[10px]">До конца сезона (МСК)</p><p className="truncate text-[10px] font-black tabular-nums text-amber-200 sm:text-sm">{countdown(season?.season?.endsAt, now)}</p></div>
          </div>
        </div>
        <div className="relative flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-[#090b0d] via-transparent to-amber-700/10" />
          <img src="/assets/season/genesis/hero-genesis-case.webp" alt="Genesis case" className="relative h-[90%] w-full object-contain drop-shadow-[0_12px_30px_rgba(224,164,46,.24)]" loading="eager" />
        </div>
        {isServerGame && season && <div className="absolute bottom-2 right-3 z-20 rounded-full border border-amber-300/20 bg-black/60 px-2.5 py-1 text-[9px] font-black text-amber-100 sm:bottom-4 sm:right-5 sm:text-[11px]">{season.seasonXp.toLocaleString('ru-RU')} XP · УРОВЕНЬ {season.level}/30</div>}
      </header>

      {isServerGame && season && (
        <div className="rounded-2xl border border-white/10 bg-[#111417] px-3 py-3 sm:px-5">
          <div className="flex items-center justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-[.18em] text-slate-400">Сезонный прогресс</p><p className="mt-1 text-[10px] text-slate-300">{season.level >= 30 ? 'Максимальный уровень открыт' : `${Math.max(0, nextLevelXp - season.seasonXp)} XP до уровня ${season.level + 1}`} · до {dateLabel(season.season?.endsAt)}</p></div><p className="shrink-0 font-mono text-xs font-black text-amber-100">{progressPercent}%</p></div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/60"><div className="h-full rounded-full bg-gradient-to-r from-amber-600 via-amber-300 to-yellow-100 transition-all" style={{ width: `${progressPercent}%` }} /></div>
          <p className="mt-2 text-[9px] text-slate-500">Контейнер: +25 XP · быстрая продажа: +10 XP за предмет</p>
        </div>
      )}

      {!isServerGame ? (
        <div className="rounded-2xl border border-zinc-700 bg-zinc-900/70 p-4 text-center text-xs leading-relaxed text-zinc-400">Season Pass и Telegram Stars доступны в серверной версии LootLand, открытой через Telegram-бота.</div>
      ) : loading || !season ? (
        <p role="status" className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 text-center text-xs text-zinc-400">Загружаем сезон и награды…</p>
      ) : (
        <>
          <div className="grid grid-cols-[minmax(0,1fr)_30px_minmax(0,1fr)] gap-1 sm:grid-cols-[minmax(0,1fr)_46px_minmax(0,1fr)] sm:gap-3">
            <div className="flex min-h-[70px] items-center gap-1.5 rounded-t-2xl border border-slate-300/20 bg-[#14191d] px-2 py-2 sm:gap-3 sm:px-4">
              <img src="/assets/season/genesis/free-pass-crest.webp" alt="" className="h-9 w-9 shrink-0 object-contain sm:h-12 sm:w-12" />
              <div className="min-w-0"><h2 className="text-[10px] font-black uppercase tracking-wide text-slate-100 sm:text-lg">Free Pass</h2><p className="text-[8px] leading-tight text-slate-400 sm:text-[10px]">Бесплатная тропа наград</p></div>
            </div>
            <div className="grid place-items-center"><span className="text-[8px] font-black uppercase tracking-widest text-amber-200">S1</span></div>
            <div className="flex min-h-[70px] items-center gap-1.5 rounded-t-2xl border border-amber-300/35 bg-[linear-gradient(130deg,#261e10,#101214_65%)] px-2 py-2 sm:gap-3 sm:px-4">
              <img src="/assets/season/genesis/vip-pass-crest.webp" alt="" className="h-9 w-9 shrink-0 object-contain sm:h-12 sm:w-12" />
              <div className="min-w-0 flex-1"><h2 className="text-[10px] font-black uppercase tracking-wide text-amber-200 sm:text-lg">VIP Pass</h2><p className="text-[8px] leading-tight text-slate-400 sm:text-[10px]">Премиальная тропа</p></div>
              {!season.isPremiumPass && <button type="button" onClick={() => void buyPremium()} disabled={purchasePending || !season.season?.isActive} className="shrink-0 rounded-lg border border-amber-300/50 bg-amber-300 px-1.5 py-2 text-[8px] font-black leading-tight text-[#17140c] disabled:opacity-50 sm:px-3 sm:text-[10px]">{purchasePending ? '…' : `${season.season?.premiumPriceStars ?? 250} ⭐ XTR`}</button>}
              {season.isPremiumPass && <span className="shrink-0 rounded-lg border border-amber-300/30 px-1.5 py-1 text-[7px] font-black text-amber-100 sm:text-[9px]">АКТИВЕН</span>}
            </div>
          </div>

          {notice && <p role="status" aria-live="polite" className="rounded-xl border border-amber-300/20 bg-amber-300/[0.06] px-3 py-2.5 text-xs text-amber-100">{notice}</p>}
          {invoiceLink && <a href={invoiceLink} target="_blank" rel="noreferrer" className="block rounded-xl border border-amber-200/30 px-3 py-2.5 text-center text-xs font-bold text-amber-100">Открыть счёт Telegram</a>}

          <div className="relative space-y-2.5 before:absolute before:bottom-5 before:left-1/2 before:top-0 before:w-px before:-translate-x-1/2 before:bg-gradient-to-b before:from-amber-300/50 before:via-slate-500/35 before:to-amber-300/50">
            {season.tiers.map((tier) => {
              const unlocked = season.level >= tier.level;
              const freeKey = claimKey(tier.level, 'free');
              const premiumKey = claimKey(tier.level, 'premium');
              const freeClaimed = season.claimedRewards.includes(freeKey);
              const premiumClaimed = season.claimedRewards.includes(premiumKey);
              return (
                <div key={tier.level} className="relative">
                  <article className="grid grid-cols-[minmax(0,1fr)_30px_minmax(0,1fr)] items-stretch gap-1 sm:grid-cols-[minmax(0,1fr)_46px_minmax(0,1fr)] sm:gap-3">
                    <RewardCard reward={tier.free} track="free" level={tier.level} unlocked={unlocked} claimed={freeClaimed} busy={pendingKey === freeKey} locked={false} onClaim={() => void claim(tier.level, 'free')} />
                    <div className="z-10 flex items-start justify-center pt-2"><span className={`grid h-7 w-7 rotate-45 place-items-center border text-[9px] font-black sm:h-10 sm:w-10 sm:text-xs ${unlocked ? 'border-amber-200 bg-[#211a0b] text-amber-100 shadow-[0_0_15px_rgba(251,191,36,.25)]' : 'border-slate-500 bg-[#121619] text-slate-300'}`}><span className="-rotate-45">{tier.level}</span></span></div>
                    <RewardCard reward={tier.premium} track="premium" level={tier.level} unlocked={unlocked} claimed={premiumClaimed} busy={pendingKey === premiumKey} locked={!season.isPremiumPass} onClaim={() => void claim(tier.level, 'premium')} />
                  </article>
                  {tier.level === 20 && <div className="relative z-10 mx-auto mt-2 grid max-w-[320px] grid-cols-[1fr_auto_1fr] items-center rounded-xl border border-amber-300/50 bg-[radial-gradient(ellipse_at_center,rgba(251,191,36,.13),rgba(8,10,12,.98)_75%)] px-3 py-2 shadow-[0_0_24px_rgba(251,191,36,.12)]"><span className="h-px bg-amber-300/35"/><div className="px-2 text-center"><img src="/assets/season/genesis/vip-license-frame.webp" alt="Рамка SEASON 01 VIP" className="mx-auto h-10 w-24 object-contain sm:h-14 sm:w-32"/><p className="mt-1 text-[8px] font-black tracking-wide text-amber-100 sm:text-[10px]">SEASON 01 // VIP</p><p className="text-[7px] text-slate-400 sm:text-[9px]">Эксклюзивная рамка номера · уровень 20</p></div><span className="h-px bg-amber-300/35"/></div>}
                  {tier.level === 30 && <div className="relative z-10 mx-auto mt-2 flex max-w-[360px] flex-col items-center overflow-hidden rounded-2xl border border-amber-300/65 bg-[radial-gradient(ellipse_at_50%_25%,rgba(247,183,46,.2),rgba(8,10,12,.98)_70%)] px-4 py-3 text-center shadow-[0_0_30px_rgba(251,191,36,.15)]"><div className="flex items-end justify-center gap-1"><span className="mb-1 text-amber-400">❧</span><img src="/assets/season/genesis/final-genesis-case.webp" alt="Genesis Archive Case" className="h-24 w-44 object-contain sm:h-32 sm:w-56"/><span className="mb-1 rotate-180 text-amber-400">❧</span></div><p className="text-xs font-black uppercase tracking-wide text-amber-100 sm:text-sm">Genesis Archive Case</p><p className="mt-0.5 text-[8px] text-slate-300 sm:text-[10px]">Главный лимитированный приз сезона · уровень 30</p></div>}
                </div>
              );
            })}
          </div>

          <div className="flex flex-col gap-3 rounded-2xl border border-amber-400/35 bg-[linear-gradient(110deg,#1d170c,#0c0f11_55%,#17130b)] p-3 shadow-lg sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-4">
            <div className="flex items-center gap-3"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-amber-300/10 text-amber-300"><Zap size={27} fill="currentColor" /></div><div><p className="text-xs font-black uppercase tracking-wide text-amber-200 sm:text-sm">Быстрая продажа</p><p className="text-[9px] leading-relaxed text-slate-300 sm:text-[11px]">Продай подходящие обычные вещи за 80% цены + сезонный XP</p></div></div>
            <button type="button" onClick={() => setSellDialog(true)} disabled={!isServerGame} className="flex min-h-10 items-center justify-center gap-2 rounded-xl border border-amber-200/70 bg-gradient-to-b from-amber-300 to-amber-600 px-4 py-2 text-xs font-black text-[#17140c] shadow-[0_5px_18px_rgba(196,137,24,.2)] disabled:opacity-50">Продать сейчас <ArrowRight size={15} /></button>
          </div>
        </>
      )}

      {sellDialog && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" role="presentation" onClick={(event) => { if (event.target === event.currentTarget && !selling) setSellDialog(false); }}><div role="dialog" aria-modal="true" aria-labelledby="season-sell-title" className="w-full max-w-sm rounded-2xl border border-amber-300/35 bg-[#111417] p-5 shadow-2xl"><div className="flex items-center gap-2 text-amber-200"><Zap size={20}/><h2 id="season-sell-title" className="text-base font-black">Продать подходящие вещи?</h2></div><p className="mt-2 text-xs leading-relaxed text-slate-300">Будут проданы только обычные и необычные предметы, которые не надеты. Редкие вещи, экипированные предметы и автомобили с номером защищены. Каждая продажа даст сезонный XP.</p><div className="mt-4 grid grid-cols-2 gap-2"><button type="button" disabled={selling} onClick={() => setSellDialog(false)} className="rounded-xl border border-white/10 px-3 py-2.5 text-xs font-bold text-slate-300">Отмена</button><button type="button" disabled={selling} onClick={() => void quickSell()} className="rounded-xl bg-amber-300 px-3 py-2.5 text-xs font-black text-[#17140c] disabled:opacity-60">{selling ? 'Продаём…' : '⚡ Продать сейчас'}</button></div></div></div>}
    </section>
  );
}

function RewardCard({ reward, track, level, unlocked, claimed, busy, locked, onClaim }: {
  reward: SeasonReward; track: SeasonTrack; level: number; unlocked: boolean; claimed: boolean; busy: boolean; locked: boolean; onClaim: () => void;
}) {
  const canClaim = unlocked && !claimed && !locked && !busy;
  const image = reward.image || seasonRewardAsset(reward.type, track);
  return (
    <article className={`min-w-0 overflow-hidden rounded-xl border px-1.5 py-2 sm:rounded-2xl sm:px-3 sm:py-2.5 ${rewardTone[track]} ${!unlocked && !claimed ? 'opacity-65' : ''}`}>
      <div className="flex min-h-[42px] items-center gap-1.5 sm:min-h-[52px] sm:gap-2.5">
        <div className={`grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-lg border bg-black/25 sm:h-12 sm:w-12 ${track === 'premium' ? 'border-amber-300/15' : 'border-slate-300/10'}`}>
          {image ? <img src={image} alt="" className="h-full w-full object-contain p-0.5" loading={level <= 3 ? 'eager' : 'lazy'} /> : <Gift size={18} className="text-slate-400" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className={`truncate text-[8px] font-black leading-tight sm:text-[10px] ${track === 'premium' ? 'text-amber-100' : 'text-slate-100'}`}>{seasonRewardSummary(reward)}</p>
          <p className="mt-0.5 line-clamp-2 text-[7px] leading-tight text-slate-400 sm:text-[9px]">{reward.description}</p>
        </div>
      </div>
      {canClaim ? <button type="button" onClick={onClaim} className={`mt-1.5 flex min-h-7 w-full items-center justify-center gap-1 rounded-lg px-1 text-[8px] font-black sm:mt-2 sm:min-h-8 sm:text-[9px] ${track === 'premium' ? 'bg-amber-300 text-[#17140c]' : 'bg-slate-200 text-[#111519]'}`}><Gift size={11}/>{busy ? 'Выдаём…' : 'Забрать'}</button>
        : <div className="mt-1.5 flex min-h-7 w-full items-center justify-center gap-1 rounded-lg bg-black/20 px-1 text-[7px] font-black text-slate-500 sm:mt-2 sm:min-h-8 sm:text-[8px]">{claimed ? <><Check size={11}/>Получено</> : locked ? <><LockKeyhole size={10}/>VIP</> : <><LockKeyhole size={10}/>{unlocked ? 'Закрыто' : `Ур. ${level}`}</>}</div>}
    </article>
  );
}
