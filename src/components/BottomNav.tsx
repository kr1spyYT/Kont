import { CarFront, CircleEllipsis, Gavel, PackageOpen, Shirt, Sparkles } from 'lucide-react';
import { impact } from '../utils/haptics';
import { playClick } from '../utils/sound';

export type Tab = 'containers' | 'inventory' | 'garage' | 'auction' | 'season' | 'more';
export type AppSection = Tab | 'profile';

interface BottomNavProps {
  active: AppSection;
  onChange: (tab: Tab) => void;
}

const tabs = [
  { id: 'containers', label: 'Контейнеры', Icon: PackageOpen },
  { id: 'inventory', label: 'Инвентарь', Icon: Shirt },
  { id: 'garage', label: 'Гараж', Icon: CarFront },
  { id: 'auction', label: 'Аукцион', Icon: Gavel },
  { id: 'season', label: 'Сезон', Icon: Sparkles },
  { id: 'more', label: 'Ещё', Icon: CircleEllipsis },
] as const;

export default function BottomNav({ active, onChange }: BottomNavProps) {
  return (
    <nav
      aria-label="Основная навигация"
      className="fixed inset-x-0 bottom-0 z-30 px-2 pt-3 pb-[max(0.65rem,env(safe-area-inset-bottom))] sm:px-4"
    >
      <div className="relative mx-auto flex w-full max-w-md items-center gap-1 rounded-[24px] border border-amber-500/25 bg-[#0c0c10]/95 p-2 shadow-[0_-10px_30px_rgba(0,0,0,0.85),0_12px_32px_rgba(0,0,0,0.35)] backdrop-blur-xl">
        <span aria-hidden="true" className="pointer-events-none absolute -top-px left-8 right-8 h-px bg-gradient-to-r from-transparent via-amber-300/60 to-transparent" />
        {tabs.map(({ id, label, Icon }) => {
          const selected = active === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => {
                impact('light');
                playClick();
                onChange(id);
              }}
              aria-current={selected ? 'page' : undefined}
              className={`relative flex min-h-[54px] min-w-0 flex-1 -translate-y-0 flex-col items-center justify-center gap-1 rounded-xl border px-0.5 py-1.5 text-[8px] font-bold leading-tight transition duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 max-[360px]:text-[7px] ${selected
                ? '-translate-y-0.5 border-amber-500/35 bg-gradient-to-b from-amber-500/20 to-transparent text-amber-100 shadow-[inset_0_1px_0_rgba(255,225,163,0.12),0_5px_15px_rgba(0,0,0,0.25)]'
                : 'border-transparent bg-transparent text-zinc-500 hover:border-white/5 hover:bg-white/[0.03] hover:text-zinc-100'
              }`}
            >
              <span
                aria-hidden="true"
                className={`absolute -top-[9px] left-1/2 h-0.5 w-8 -translate-x-1/2 bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_12px_#f59e0b] transition-opacity ${selected ? 'opacity-100' : 'opacity-0'}`}
              />
              <Icon size={19} strokeWidth={selected ? 2.4 : 1.7} className={selected ? 'text-amber-300' : ''} />
              <span className="max-w-full truncate">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
