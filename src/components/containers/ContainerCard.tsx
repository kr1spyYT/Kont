import { motion } from 'framer-motion';
import { useState } from 'react';
import { formatRubles } from '../../utils/currency';
import type { Container } from '../../types/game';
import { containerLooks } from './containerConfig';

function ContainerArtwork({ container, art, fallback }: { container: Container; art: string; fallback: string }) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <div className="relative flex h-[115px] w-[130px] flex-shrink-0 items-center justify-center max-[420px]:h-[92px] max-[420px]:w-[64px] max-[360px]:w-[52px] sm:h-[130px] sm:w-[150px]">
      {!imageLoaded && (
        <div className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
          <div className={`absolute h-16 w-16 rounded-full bg-gradient-to-br blur-xl ${fallback}`} />
          <span className="relative z-10 mb-1 text-5xl drop-shadow-[0_8px_10px_rgba(0,0,0,0.8)]">{art}</span>
        </div>
      )}
      {!imageFailed && (
        <img
          src={container.image}
          alt={container.name}
          onLoad={() => setImageLoaded(true)}
          onError={() => setImageFailed(true)}
          className={`absolute inset-0 h-full w-full object-contain drop-shadow-[0_14px_20px_rgba(0,0,0,0.85)] transition-opacity ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
        />
      )}
    </div>
  );
}

interface ContainerCardProps {
  container: Container;
  disabled: boolean;
  shouldReduceMotion: boolean;
  onSelect: (container: Container) => void;
}

export default function ContainerCard({ container, disabled, shouldReduceMotion, onSelect }: ContainerCardProps) {
  const look = containerLooks[container.id] ?? {
    tier: `TIER ${container.tier}`,
    tierNumber: container.tier,
    art: container.icon,
    fallback: 'from-amber-300/20 via-zinc-700/20 to-zinc-950/70',
  };

  return (
    <motion.article
      whileHover={shouldReduceMotion ? undefined : { scale: 1.01 }}
      transition={{ duration: 0.16 }}
      className="relative flex min-h-[140px] items-center justify-between gap-4 overflow-hidden rounded-[24px] border border-white/5 bg-[#16171d] p-4 transition-all hover:border-white/10 max-[420px]:gap-1.5 max-[420px]:p-3"
    >
      <div className="absolute left-3 top-3 flex w-5 flex-wrap gap-1 opacity-20" aria-hidden="true">
        {Array.from({ length: 12 }, (_, index) => (
          <span key={index} className="h-0.5 w-0.5 rounded-full bg-white" />
        ))}
      </div>
      <div className="absolute right-4 top-3 flex items-center gap-1 opacity-30" aria-hidden="true">
        <span className="h-1 w-6 rounded-full bg-white/60" />
        <span className="h-1.5 w-1.5 rounded-full bg-white" />
      </div>
      <span className="absolute bottom-3 right-4 whitespace-nowrap font-mono text-[9px] opacity-10" aria-hidden="true">
        &gt;&gt;&gt; &gt;&gt;&gt;&gt;&gt;&gt;&gt;&gt; &gt;
      </span>
      <ContainerArtwork container={container} art={look.art} fallback={look.fallback} />
      <div className="relative z-10 flex min-w-0 flex-1 flex-col justify-center gap-2">
        <div className="flex items-start justify-between gap-2 max-[420px]:gap-1">
          <h2 className="min-w-0 max-w-[150px] flex-1 break-normal text-[18px] font-extrabold leading-[1.15] tracking-tight text-[#f3efe6] sm:text-[20px]">
            {container.name}
          </h2>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <span className="whitespace-nowrap rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-zinc-400 max-[420px]:px-1 max-[420px]:text-[8px] max-[420px]:tracking-wide">
              {container.category === 'clothing' ? 'ОДЕЖДА' : container.category === 'car' ? 'ТАЧКИ' : 'НОМЕРА'}
            </span>
            <span className="whitespace-nowrap rounded-full border border-amber-500/40 px-2 py-0.5 text-[10px] text-amber-300/90">
              Тир {container.tier ?? look.tierNumber}
            </span>
          </div>
        </div>
        <span className="mt-1.5 inline-flex w-fit items-center gap-1 rounded-full border border-white/10 bg-zinc-950/80 px-2.5 py-0.5 text-[12px] font-bold text-[#4ade80]">
          {formatRubles(container.price)}
        </span>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onSelect(container)}
          className="mt-auto flex w-full items-center justify-center gap-1.5 rounded-xl border border-amber-300/30 bg-amber-400 px-4 py-2 text-[13px] font-bold text-[#151719] transition-all hover:bg-amber-300 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
        >
          🔒 Открыть
        </button>
      </div>
    </motion.article>
  );
}
