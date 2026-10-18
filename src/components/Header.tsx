import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDownToLine, Flame, Wallet } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { PlayerState } from '../types/game';
import { formatRubles } from '../utils/currency';
import { impact } from '../utils/haptics';
import { playClick } from '../utils/sound';
import RankBadge from './RankBadge';

interface HeaderProps {
  player: PlayerState;
  onTopUp: () => void;
  onProfileClick: () => void;
  profileOpen: boolean;
  rankTitle: string;
  playerName: string;
  canTopUp: boolean;
  loading?: boolean;
}

interface BalanceNotice {
  id: number;
  delta: number;
}

export default function Header({ player, onTopUp, onProfileClick, profileOpen, rankTitle, playerName, canTopUp, loading = false }: HeaderProps) {
  const [balancePulse, setBalancePulse] = useState(false);
  const [balanceNotice, setBalanceNotice] = useState<BalanceNotice>();
  const [photoFailed, setPhotoFailed] = useState(false);
  const previousBalance = useRef(player.balance);
  const hasLoadedBalance = useRef(!loading);
  const noticeId = useRef(0);
  const telegramUser = typeof window === 'undefined' ? undefined : window.Telegram?.WebApp?.initDataUnsafe?.user;
  const photoUrl = telegramUser?.photo_url;
  const telegramName = [telegramUser?.first_name, telegramUser?.last_name].filter(Boolean).join(' ').trim();
  const displayName = playerName || telegramName || (telegramUser?.username ? `@${telegramUser.username}` : 'Игрок');

  useEffect(() => {
    setBalancePulse(true);
    const timeout = window.setTimeout(() => setBalancePulse(false), 650);
    return () => window.clearTimeout(timeout);
  }, [player.balance]);

  useEffect(() => {
    const delta = player.balance - previousBalance.current;
    previousBalance.current = player.balance;
    if (loading) {
      hasLoadedBalance.current = false;
      return;
    }
    if (!hasLoadedBalance.current) {
      hasLoadedBalance.current = true;
      return;
    }
    if (delta === 0) return;

    const currentNoticeId = ++noticeId.current;
    setBalanceNotice({ id: currentNoticeId, delta });
    const timeout = window.setTimeout(() => {
      setBalanceNotice((current) => current?.id === currentNoticeId ? undefined : current);
    }, 1050);
    return () => window.clearTimeout(timeout);
  }, [player.balance, loading]);

  useEffect(() => {
    setPhotoFailed(false);
  }, [photoUrl]);

  return (
    <header className="pt-4">
      <div className="relative grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(96px,1fr)_minmax(52px,auto)] items-center gap-2 rounded-2xl border border-amber-300/20 bg-[#0c0c10]/95 p-3 shadow-[0_14px_30px_rgba(0,0,0,0.36),inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-xl max-[360px]:gap-1.5 max-[360px]:p-2.5">
        <span aria-hidden="true" className="pointer-events-none absolute left-7 right-7 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/55 to-transparent" />
        <button
          type="button"
          onClick={() => {
            impact('light');
            playClick();
            onProfileClick();
          }}
          aria-label="Открыть профиль игрока"
          aria-current={profileOpen ? 'page' : undefined}
          className={`flex min-w-0 items-center gap-2 rounded-xl border border-transparent p-1 text-left transition hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-amber-300 max-[360px]:gap-1.5 ${profileOpen ? 'border-amber-300/35 bg-amber-300/10' : ''}`}
        >
          <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full border border-amber-300/25 bg-amber-400/10 text-2xl max-[360px]:h-9 max-[360px]:w-9">
            {photoUrl && !photoFailed ? (
              <img
                src={photoUrl}
                alt={`Фото профиля: ${displayName}`}
                onError={() => setPhotoFailed(true)}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="font-black text-amber-100">{displayName.trim().charAt(0).toLocaleUpperCase('ru-RU') || 'И'}</span>
            )}
          </div>
          <div className="min-w-0 flex-1 text-left" title={`${rankTitle} ${displayName}`}>
            <RankBadge title={rankTitle} compact />
            <span className="mt-1 block truncate text-sm font-black leading-tight text-[#F6F2E8] max-[360px]:text-xs">{displayName}</span>
          </div>
        </button>

        <div className="min-w-0 text-center">
          <div className="flex items-center justify-center gap-1 text-[9px] font-bold uppercase tracking-wider text-zinc-500">
            <Wallet size={11} className="shrink-0 text-amber-300" />
            <span>Баланс</span>
            {canTopUp && <button
              type="button"
              onClick={() => {
                impact('light');
                playClick();
                onTopUp();
              }}
              className="flex shrink-0 items-center gap-0.5 rounded-md border border-amber-300/30 bg-amber-400/10 px-1 py-0.5 text-[8px] font-bold text-amber-200 transition hover:border-amber-300/60 hover:bg-amber-400/20 focus:outline-none focus:ring-2 focus:ring-amber-300"
              aria-label="Пополнить баланс на 1 000 000 рублей — только для владельца"
              title="Пополнить на 1 000 000 ₽"
            >
              <ArrowDownToLine size={10} />
              <span>+1M</span>
            </button>}
          </div>
          <div className="relative">
            <p
              className={`truncate text-[13px] font-black tabular-nums text-[#F6F2E8] transition-transform duration-300 max-[360px]:text-xs ${balancePulse ? 'scale-105 text-amber-100' : ''}`}
              title={formatRubles(player.balance)}
            >
              {loading ? '—' : player.balance >= 10_000_000
                ? `${Number((player.balance / 1_000_000).toFixed(1))}M`
                : formatRubles(player.balance)}
            </p>
            <AnimatePresence initial={false}>
              {balanceNotice && (
                <motion.span
                  key={balanceNotice.id}
                  role="status"
                  aria-live="polite"
                  initial={{ opacity: 0, y: 10, x: '-50%' }}
                  animate={{ opacity: 1, y: -10, x: '-50%' }}
                  exit={{ opacity: 0, y: -24, x: '-50%' }}
                  transition={{ duration: 0.75, ease: 'easeOut' }}
                  className={`pointer-events-none absolute left-1/2 top-full z-20 mt-0.5 whitespace-nowrap rounded-md bg-[#0b0b0d]/95 px-1.5 py-0.5 text-[10px] font-black shadow-lg ${balanceNotice.delta > 0 ? 'text-[#83B88A]' : 'text-rose-300'}`}
                >
                  {balanceNotice.delta > 0 ? '+' : '−'}{formatRubles(Math.abs(balanceNotice.delta))}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="min-w-0 text-right">
          <div className="flex items-center justify-end gap-1 text-[9px] font-bold uppercase tracking-wide text-zinc-500">
            <Flame size={11} className="shrink-0 text-amber-300" />
            <span className="truncate">Респект</span>
          </div>
          <p className="truncate text-xs font-black tabular-nums text-amber-100">
            {loading ? '—' : player.respect.toLocaleString('ru-RU')}
          </p>
        </div>
      </div>
    </header>
  );
}
