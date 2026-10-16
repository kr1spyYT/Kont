import { CalendarDays, TicketPercent, Trophy } from 'lucide-react';

const upcomingFeatures = [
  { title: 'Промокоды', description: 'Бонусы и подарки по кодам', Icon: TicketPercent },
  { title: 'Ежедневные награды', description: 'Заглядывай за наградой каждый день', Icon: CalendarDays },
  { title: 'Рейтинг игроков', description: 'Сравнивай свой респект с другими', Icon: Trophy },
];

export default function MoreTab() {
  return (
    <section className="space-y-4">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-300">Развитие игры</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-white">Ещё</h1>
        <p className="mt-1 text-xs text-zinc-500">Новые возможности появятся здесь.</p>
      </div>

      <div className="space-y-2.5">
        {upcomingFeatures.map(({ title, description, Icon }) => (
          <article key={title} className="flex items-center gap-3 rounded-2xl border border-[#34383C] bg-[#202326] p-4">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-amber-300/15 bg-amber-300/5 text-amber-300">
              <Icon size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-black text-[#F2EFE8]">{title}</h2>
              <p className="mt-0.5 text-[11px] text-zinc-500">{description}</p>
            </div>
            <span className="shrink-0 rounded-full border border-zinc-700 bg-zinc-900 px-2 py-1 text-[8px] font-black uppercase tracking-wide text-zinc-500">
              Скоро
            </span>
          </article>
        ))}
      </div>
    </section>
  );
}
