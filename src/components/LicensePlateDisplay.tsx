import type { ReactNode } from 'react';

interface LicensePlateDisplayProps {
  plate?: string;
  frameIds?: readonly string[];
  size?: 'tiny' | 'compact' | 'large';
  className?: string;
}

const sizeClasses = {
  tiny: {
    plate: 'min-w-[82px] h-[24px] gap-0.5 px-1 py-0.5',
    region: 'min-w-0 px-0.5',
    number: 'text-[7px]',
    details: 'text-[5px]',
    flag: 'h-[5px] w-[9px]',
    framed: 'w-[88px] aspect-[2.15/1]',
    framedNumber: 'text-[8px]',
    framedRegion: 'text-[7px]',
    framedFlag: 'h-[4px] w-[6px]',
    framedDetails: 'text-[4px]',
  },
  compact: {
    plate: 'min-w-[104px] h-[31px] gap-1 px-1.5 py-0.5',
    region: 'min-w-0 px-1',
    number: 'text-[9px] sm:text-[10px]',
    details: 'text-[6px]',
    flag: 'h-[6px] w-[12px]',
    framed: 'w-[116px] aspect-[2.15/1]',
    framedNumber: 'text-[11px]',
    framedRegion: 'text-[10px]',
    framedFlag: 'h-[6px] w-[9px]',
    framedDetails: 'text-[5px]',
  },
  large: {
    plate: 'min-w-[124px] h-[38px] gap-1.5 px-2 py-1',
    region: 'min-w-0 px-1.5',
    number: 'text-[11px] sm:text-xs',
    details: 'text-[7px]',
    flag: 'h-[8px] w-[16px]',
    framed: 'w-[152px] aspect-[2.15/1]',
    framedNumber: 'text-[14px]',
    framedRegion: 'text-[12px]',
    framedFlag: 'h-[7px] w-[12px]',
    framedDetails: 'text-[7px]',
  },
} as const;

const latinToCyrillic: Record<string, string> = {
  A: 'А', B: 'В', E: 'Е', K: 'К', M: 'М', H: 'Н', O: 'О', P: 'Р', C: 'С', T: 'Т', Y: 'У', X: 'Х',
};

function getPlateParts(value: string) {
  const normalized = value
    .toLocaleUpperCase('ru-RU')
    .replace(/\s+/gu, '')
    .replace(/[ABEKMHOPCTYX]/g, (letter) => latinToCyrillic[letter] ?? letter);
  const official = normalized.match(/^([АВЕКМНОРСТУХ])(\d{3})([АВЕКМНОРСТУХ]{2})(\d{2,3})?$/u);

  if (official) {
    return { main: [official[1], official[2], official[3]], region: official[4] };
  }

  const withRegion = value.match(/^(.+?)\s+(\d{2,3})$/u);
  return { main: [withRegion?.[1] ?? value], region: withRegion?.[2] };
}

function PlateNumber({ main, region, size, framed = false }: {
  main: string[];
  region?: string;
  size: typeof sizeClasses[keyof typeof sizeClasses];
  framed?: boolean;
}) {
  return (
    <>
      <span data-plate-main="true" data-plate-zone={framed ? 'main' : undefined} className={`license-plate-typeface flex min-w-0 items-center justify-center whitespace-nowrap leading-none ${framed ? 'absolute left-[9%] top-[30%] z-10 h-[42%] w-[59%]' : ''} ${framed ? size.framedNumber : size.number}`}>
        {main.map((part, index) => (
          <span key={`${index}-${part}`} data-plate-part={index === 0 ? 'first-letter' : index === 1 ? 'digits' : index === 2 ? 'ending-letters' : 'text'} className={index > 0 ? 'ml-[0.12em]' : undefined}>
            {part}
          </span>
        ))}
      </span>
      {region && (
        <span data-plate-zone={framed ? 'region' : undefined} className={`flex min-w-0 flex-col items-center justify-center leading-none ${framed ? 'absolute left-[70%] top-[28%] z-10 h-[45%] w-[21%] justify-between' : `h-full border-l-2 border-black/20 ${size.region}`}`}>
          <span className={`license-plate-typeface ${framed ? 'font-extrabold text-[#111111]' : ''} ${framed ? size.framedRegion : size.number}`}>{region}</span>
          <span className={`mt-[1px] flex items-center ${framed ? 'gap-[1px]' : 'flex-col'}`}>
            <span role="img" aria-label="Флаг России" className={`inline-flex shrink-0 flex-col overflow-hidden rounded-[1px] border border-black/20 shadow-[0_1px_1px_rgba(0,0,0,0.3)] ${framed ? size.framedFlag : size.flag}`}>
              <span className="min-h-0 flex-1 bg-white" />
              <span className="min-h-0 flex-1 bg-[#2454a4]" />
              <span className="min-h-0 flex-1 bg-[#d52b2b]" />
            </span>
            <span className={`${framed ? 'font-extrabold text-[#111111]' : 'font-bold'} tracking-[0.04em] ${framed ? size.framedDetails : size.details}`}>RUS</span>
          </span>
        </span>
      )}
    </>
  );
}

export function SeasonVipFrame({ children, className = '', accessibleLabel }: {
  children: ReactNode;
  className?: string;
  accessibleLabel: string;
}) {
  return (
    <span
      role="img"
      aria-label={accessibleLabel}
      data-frame-id="season-01-vip"
      data-testid="season-vip-license-frame"
      className={`relative inline-block aspect-[2.15/1] select-none ${className}`}
    >
      <img
        src="/assets/season/genesis/vip-frame-empty.webp"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full object-fill"
      />
      {children}
    </span>
  );
}

export default function LicensePlateDisplay({ plate, frameIds = [], size = 'compact', className = '' }: LicensePlateDisplayProps) {
  const value = plate?.trim() ?? '';
  const hasPlate = Boolean(value && value !== '—' && value.toLocaleLowerCase('ru-RU') !== 'без номера');
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

  const { main, region } = getPlateParts(value);
  const accessibleLabel = `Госномер ${value}${frameId ? `, рамка ${frameLabel}` : ''}`;

  if (frameId === 'season-01-vip') {
    return (
      <span className={`relative inline-flex max-w-full align-middle drop-shadow-[0_5px_10px_rgba(0,0,0,0.62)] ${className}`} data-testid="license-plate-display" data-frame-id={frameId}>
        <SeasonVipFrame accessibleLabel={accessibleLabel} className={`shrink-0 ${classes.framed}`}>
          <PlateNumber main={main} region={region} size={classes} framed />
        </SeasonVipFrame>
      </span>
    );
  }

  return (
    <span className={`relative inline-flex max-w-full align-middle ${className}`} data-testid="license-plate-display" data-frame-id={frameId}>
      <span
        role="img"
        aria-label={accessibleLabel}
        className={`relative inline-grid grid-cols-[minmax(0,1fr)_22%] items-center overflow-hidden rounded-[4px] border border-[#7f8385] bg-gradient-to-b from-[#f9f9f9] via-[#f4f4f1] to-[#e7e8e5] font-black leading-none text-[#111111] shadow-[inset_0_1px_0_rgba(255,255,255,0.95),inset_0_-1px_2px_rgba(0,0,0,0.12),0_2px_5px_rgba(0,0,0,0.42)] ${classes.plate}`}
      >
        <PlateNumber main={main} region={region} size={classes} />
        <span aria-hidden="true" className="pointer-events-none absolute left-[3px] top-[3px] h-[2px] w-[2px] rounded-full bg-[#a4a6a2] shadow-[inset_0_1px_1px_rgba(0,0,0,0.55)]" />
        <span aria-hidden="true" className="pointer-events-none absolute bottom-[3px] left-[3px] h-[2px] w-[2px] rounded-full bg-[#a4a6a2] shadow-[inset_0_1px_1px_rgba(0,0,0,0.55)]" />
        <span aria-hidden="true" className="pointer-events-none absolute right-[3px] top-[3px] h-[2px] w-[2px] rounded-full bg-[#a4a6a2] shadow-[inset_0_1px_1px_rgba(0,0,0,0.55)]" />
        <span aria-hidden="true" className="pointer-events-none absolute bottom-[3px] right-[3px] h-[2px] w-[2px] rounded-full bg-[#a4a6a2] shadow-[inset_0_1px_1px_rgba(0,0,0,0.55)]" />
      </span>
      {frameId && (
        <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 bottom-0 z-20 rounded-[5px] border-2 border-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.42)]">
          <span className={`absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-sm border border-amber-300/80 bg-[#15110a] px-1.5 py-[1px] font-black leading-none tracking-[0.08em] text-amber-100 shadow-[0_1px_5px_rgba(0,0,0,0.8)] ${size === 'tiny' ? 'text-[5px]' : size === 'compact' ? 'text-[6px]' : 'text-[7px]'}`}>
            {frameLabel}
          </span>
        </span>
      )}
    </span>
  );
}
