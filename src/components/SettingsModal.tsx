import { AnimatePresence, motion } from 'framer-motion';
import { Music2, Star, Vibrate, Volume2, VolumeX, X, Zap } from 'lucide-react';
import type { ReactNode } from 'react';

interface SettingsModalProps {
  musicEnabled: boolean;
  musicVolume: number;
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  onMusicChange: (enabled: boolean) => void;
  onMusicVolumeChange: (volume: number) => void;
  onSoundChange: (enabled: boolean) => void;
  onHapticsChange: (enabled: boolean) => void;
  onOpenLeaderboard: () => void;
  onClose: () => void;
}

function SettingToggle({ label, description, enabled, onChange, icon }: {
  label: string;
  description: string;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  icon: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-black/25 p-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-amber-300/15 bg-amber-300/[0.07] text-amber-200">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-black text-white">{label}</span>
        <span className="mt-0.5 block text-[9px] text-zinc-500">{description}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={label}
        onClick={() => onChange(!enabled)}
        className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full p-1 transition-colors duration-200 ${enabled ? 'bg-gradient-to-r from-[#b8923a] to-[#e5c158]' : 'border border-white/15 bg-white/10'}`}
      >
        <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-200 ${enabled ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
    </div>
  );
}

export default function SettingsModal({
  musicEnabled,
  musicVolume,
  soundEnabled,
  hapticsEnabled,
  onMusicChange,
  onMusicVolumeChange,
  onSoundChange,
  onHapticsChange,
  onOpenLeaderboard,
  onClose,
}: SettingsModalProps) {
  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[125] flex items-end justify-center bg-black/80 p-0 backdrop-blur-sm sm:items-center sm:p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
      >
        <motion.section
          role="dialog"
          aria-modal="true"
          aria-labelledby="syndicate-settings-title"
          className="w-full max-w-md rounded-t-3xl border border-amber-300/25 bg-[#111116] p-4 shadow-[0_20px_70px_rgba(0,0,0,.65)] sm:rounded-3xl sm:p-5"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
        >
          <header className="flex items-center justify-between border-b border-white/[0.07] pb-3">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.22em] text-amber-300">LootLand · Syndicate</p>
              <h2 id="syndicate-settings-title" className="mt-1 text-lg font-black text-white">Настройки Синдиката</h2>
            </div>
            <button type="button" onClick={onClose} aria-label="Закрыть настройки" className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 text-zinc-400 hover:text-white"><X size={17} /></button>
          </header>

          <div className="mt-4 space-y-2.5">
            <div className="space-y-2 rounded-xl border border-white/[0.07] bg-black/25 p-3">
              <SettingToggle
                label="Фоновая музыка"
                description={musicEnabled ? 'Музыкальная тема синдиката' : 'Музыка выключена'}
                enabled={musicEnabled}
                onChange={onMusicChange}
                icon={musicEnabled ? <Music2 size={17} /> : <VolumeX size={17} />}
              />
              <label className="block" htmlFor="music-volume">
                <span className="flex items-center justify-between text-[9px] font-bold text-zinc-400">
                  <span className="flex items-center gap-1.5"><Volume2 size={12} /> Громкость музыки</span>
                  <span className="tabular-nums text-amber-100">{Math.round(musicVolume * 100)}%</span>
                </span>
                <input
                  id="music-volume"
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={Math.round(musicVolume * 100)}
                  onChange={(event) => onMusicVolumeChange(Number(event.target.value) / 100)}
                  disabled={!musicEnabled}
                  style={{ background: `linear-gradient(to right, #d4af37 0%, #d4af37 ${Math.round(musicVolume * 100)}%, rgba(255,255,255,0.12) ${Math.round(musicVolume * 100)}%, rgba(255,255,255,0.12) 100%)` }}
                  className="gold-range mt-2 w-full cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                />
              </label>
            </div>

            <SettingToggle
              label="Звуковые эффекты"
              description="Открытие контейнеров и нажатия"
              enabled={soundEnabled}
              onChange={onSoundChange}
              icon={<Zap size={17} />}
            />
            <SettingToggle
              label="Вибрация Telegram"
              description="HapticFeedback на поддерживаемых устройствах"
              enabled={hapticsEnabled}
              onChange={onHapticsChange}
              icon={<Vibrate size={17} strokeWidth={1.8} className="text-[#e5c158]" />}
            />
            <button
              type="button"
              onClick={onOpenLeaderboard}
              className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-amber-300/25 bg-gradient-to-r from-[#241c0e] to-[#141417] px-3 py-2.5 text-left transition hover:border-amber-200/50"
            >
              <Star size={18} fill="currentColor" className="shrink-0 text-amber-300" />
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-black text-white">Рейтинг игроков</span>
                <span className="mt-0.5 block text-[9px] text-zinc-500">Форбс Синдиката</span>
              </span>
              <span className="text-xs font-black text-amber-200">Открыть →</span>
            </button>
          </div>
        </motion.section>
      </motion.div>
    </AnimatePresence>
  );
}
