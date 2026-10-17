import { AnimatePresence, motion } from 'framer-motion';
import { LockKeyhole } from 'lucide-react';
import { formatRubles } from '../../utils/currency';
import type { Container } from '../../types/game';
import { containerLooks } from './containerConfig';

interface ContainerSelectionModalProps {
  container?: Container;
  adCountdown?: string;
  notice: string;
  freeAvailableAt?: string;
  shouldReduceMotion: boolean;
  onClose: () => void;
  onPaidOpen: (container: Container) => void;
  onFreeOpen: (container: Container) => void;
}

export default function ContainerSelectionModal({
  container,
  adCountdown,
  notice,
  freeAvailableAt,
  shouldReduceMotion,
  onClose,
  onPaidOpen,
  onFreeOpen,
}: ContainerSelectionModalProps) {
  const look = container
    ? containerLooks[container.id] ?? {
      tier: `TIER ${container.tier}`,
      tierNumber: container.tier,
      art: container.icon,
      fallback: 'from-amber-300/20 via-zinc-700/20 to-zinc-950/70',
      badge: 'border-amber-300/30 bg-amber-300/10 text-amber-100',
      icon: 'border-amber-300/25 from-amber-500/20 to-zinc-900 text-amber-100',
      button: 'from-amber-400 to-amber-500 text-zinc-950',
      secret: container.description,
    }
    : undefined;

  return (
    <AnimatePresence>
      {container && look && (
        <motion.div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 px-4 py-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={(event) => {
            if (event.target === event.currentTarget && !adCountdown) onClose();
          }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="mystery-box-title"
            className="w-full max-w-sm rounded-3xl border border-zinc-700 bg-zinc-950 p-5 text-center"
            initial={shouldReduceMotion ? undefined : { opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.18 }}
          >
            <div className="flex items-center justify-between">
              <span className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-wider ${look.badge}`}>
                {look.tier}
              </span>
              <button
                type="button"
                aria-label="Закрыть"
                disabled={Boolean(adCountdown)}
                onClick={onClose}
                className="rounded-lg px-2 py-1 text-xl leading-none text-zinc-500 hover:text-white disabled:opacity-40"
              >
                ×
              </button>
            </div>
            <motion.div
              className={`relative mx-auto mt-5 grid h-36 w-36 place-items-center rounded-3xl border bg-gradient-to-br text-7xl ${look.icon}`}
              animate={shouldReduceMotion ? undefined : { y: [0, -4, 0], rotate: [0, -1, 1, 0] }}
              transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
              aria-hidden="true"
            >
              {look.art}
              <LockKeyhole size={22} className="absolute translate-x-12 translate-y-12 rounded-full border border-zinc-700 bg-zinc-950 p-1 text-zinc-200" />
            </motion.div>
            <h2 id="mystery-box-title" className="mt-5 text-xl font-black text-white">{container.name}</h2>
            <p className="mt-2 text-sm font-bold text-zinc-200">Содержимое засекречено 🔒</p>
            <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-zinc-400">{look.secret}</p>
            {notice && (
              <p role="status" className="mt-3 rounded-xl border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-xs text-rose-200">
                {notice}
              </p>
            )}
            <div className="mt-5 space-y-2">
              <motion.button
                type="button"
                disabled={Boolean(adCountdown)}
                onClick={() => onPaidOpen(container)}
                whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
                className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r px-4 py-3 text-sm font-black transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60 ${look.button}`}
              >
                <LockKeyhole size={16} />
                Вскрыть за {formatRubles(container.price)}
              </motion.button>
              {container.id === 'second-hand-bale' && container.category === 'clothing' && (
                <button
                  type="button"
                  disabled={Boolean(adCountdown || freeAvailableAt)}
                  onClick={() => onFreeOpen(container)}
                  className="min-h-11 w-full rounded-xl border border-emerald-300/30 bg-emerald-300/10 px-4 py-2 text-xs font-black text-emerald-100 transition hover:bg-emerald-300/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {adCountdown ? `Реклама · ${adCountdown}…` : freeAvailableAt ? `Бесплатный контейнер: ${new Date(freeAvailableAt).toLocaleString('ru-RU')}` : 'Бесплатно за рекламу 🎬'}
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
