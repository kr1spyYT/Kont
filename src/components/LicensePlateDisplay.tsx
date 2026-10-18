interface LicensePlateDisplayProps {
  plate?: string;
  frameIds?: readonly string[];
  size?: 'tiny' | 'compact' | 'large';
  className?: string;
}

const sizeClasses = {
  tiny: {
    plate: 'min-w-[82px] gap-1 px-1.5 py-0.5 text-[7px]',
    region: 'min-w-[20px] px-0.5 text-[6px]',
    frame: 'text-[5px]',
  },
  compact: {
    plate: 'min-w-[104px] gap-1.5 px-2 py-1 text-[9px] sm:text-[10px]',
    region: 'min-w-[24px] px-1 text-[7px]',
    frame: 'text-[6px]',
  },
  large: {
    plate: 'min-w-[124px] gap-2 px-2 py-1.5 text-[11px] sm:text-xs',
    region: 'min-w-[28px] px-1 text-[8px]',
    frame: 'text-[6px]',
  },
} as const;

export default function LicensePlateDisplay({ plate, frameIds = [], size = 'compact', className = '' }: LicensePlateDisplayProps) {
  const value = plate?.trim() ?? '';
  const hasPlate = Boolean(value && value !== '—' && value.toLocaleLowerCase('ru-RU') !== 'без номера');
  const match = hasPlate ? value.match(/^(.+?)\s+(\d{2,3})$/u) : null;
  const mainNumber = match?.[1] ?? value;
  const region = match?.[2];
  const frameId = frameIds.includes('season-01-vip') ? 'season-01-vip' : frameIds[0];
  const frameLabel = frameId === 'season-01-vip' ? 'SEASON 01 // VIP' : 'VIP';
  const classes = sizeClasses[size];

  if (!hasPlate) {
    return (
      <span className={`inline-flex rounded-md border border-white/10 bg-black/35 px-2 py-1 font-mono text-[8px] font-bold text-zinc-500 ${className}`}>
        Без номера
      </span>
    );
  }

  return (
    <span className={`relative inline-flex max-w-full align-middle ${className}`} data-testid="license-plate-display" data-frame-id={frameId}>
      <span
        role="img"
        aria-label={`Госномер ${value}${frameId ? `, рамка ${frameLabel}` : ''}`}
        className={`relative z-10 inline-grid grid-cols-[minmax(0,1fr)_auto] items-center rounded-[4px] border-2 bg-[#f3f2eb] font-mono font-black leading-none text-[#17191b] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_2px_5px_rgba(0,0,0,0.4)] ${frameId ? 'mt-2 border-amber-800' : 'border-zinc-500'} ${classes.plate}`}
      >
        <span className="whitespace-nowrap tracking-[0.04em]">{mainNumber}</span>
        {region && (
          <span className={`ml-1 flex flex-col items-center justify-center gap-0.5 border-l border-black/20 leading-none ${classes.region}`}>
            <span>{region}</span>
            <span aria-hidden="true" className="h-[3px] w-3 rounded-[1px] bg-[linear-gradient(to_bottom,#fff_0_33%,#2563eb_33%_66%,#dc2626_66%)]" />
            <span className="text-[5px] font-black">RUS</span>
          </span>
        )}
      </span>
      {frameId && (
        <>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-2 bottom-0 z-20 rounded-md border-[3px] border-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.42)]"
          />
          <span aria-hidden="true" className={`pointer-events-none absolute left-1/2 top-0 z-30 -translate-x-1/2 whitespace-nowrap rounded-sm border border-amber-300/80 bg-[#15110a] px-1.5 py-[1px] font-black leading-none tracking-[0.08em] text-amber-100 shadow-[0_1px_5px_rgba(0,0,0,0.8)] ${classes.frame}`}>
            {frameLabel}
          </span>
        </>
      )}
    </span>
  );
}
