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
      className="fixed inset-x-0 bottom-0 z-30 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3"
    >
      <div className="mx-auto flex max-w-md items-center gap-1 rounded-2xl border border-[#34383C] bg-[#151719]/95 p-2 shadow-2xl shadow-black/50">
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
              className={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl border px-0.5 py-2 text-[8px] font-bold leading-tight transition focus:outline-none focus:ring-2 focus:ring-amber-300 ${
                selected
                  ? 'border-amber-300 bg-amber-400 text-[#151719] shadow-lg shadow-amber-400/15'
                  : 'border-[#34383C] bg-[#202326] text-[#A3A39D] hover:border-amber-300/30 hover:bg-[#292D30] hover:text-[#F2EFE8]'
              }`}
            >
              <Icon
                size={19}
                strokeWidth={selected ? 2.5 : 1.8}
                className={selected ? 'text-[#151719]' : ''}
              />
              <span className="truncate">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
