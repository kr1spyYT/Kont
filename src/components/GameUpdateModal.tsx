import { Megaphone } from 'lucide-react';
import { motion } from 'framer-motion';
import type { GameUpdate } from '../types/server';

interface GameUpdateModalProps {
  update: GameUpdate;
  busy: boolean;
  error: string;
  onAcknowledge: () => void;
}

export default function GameUpdateModal({ update, busy, error, onAcknowledge }: GameUpdateModalProps) {
  const publishedDate = new Date(update.publishedAt);
  const dateLabel = Number.isNaN(publishedDate.getTime())
    ? ''
    : publishedDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="fixed inset-0 z-[130] grid place-items-center bg-black/75 p-4 backdrop-blur-sm">
      <motion.section
        role="dialog"
        aria-modal="true"
        aria-labelledby="game-update-title"
        initial={{ opacity: 0, y: 14, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="w-full max-w-sm overflow-hidden rounded-3xl border border-amber-300/30 bg-[#202326] shadow-2xl shadow-black/60"
      >
        <div className="border-b border-amber-300/15 bg-amber-300/[0.08] px-5 py-5">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-amber-200">
            <Megaphone size={15} /> Обновление игры
          </div>
          <h2 id="game-update-title" className="mt-3 text-xl font-black leading-tight text-white">{update.title}</h2>
          {dateLabel && <p className="mt-1.5 text-[10px] text-zinc-500">{dateLabel}</p>}
        </div>
        <div className="max-h-[48vh] overflow-y-auto whitespace-pre-wrap px-5 py-4 text-sm leading-relaxed text-zinc-200">
          {update.body}
        </div>
        <div className="px-5 pb-5">
          {error && <p role="alert" className="mb-3 rounded-xl border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-xs text-rose-200">{error}</p>}
          <button
            type="button"
            disabled={busy}
            onClick={onAcknowledge}
            className="w-full rounded-xl bg-amber-400 px-4 py-3 text-sm font-black text-[#151719] transition hover:bg-amber-300 disabled:cursor-wait disabled:opacity-60"
          >
            {busy ? 'Сохраняем отметку…' : 'Понятно, продолжить'}
          </button>
          <p className="mt-2 text-center text-[9px] text-zinc-600">Это сообщение больше не появится после закрытия.</p>
        </div>
      </motion.section>
    </div>
  );
}
