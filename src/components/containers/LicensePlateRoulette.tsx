import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { BadgeCheck, CarFront, RotateCw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  createLicensePlateItem,
  createRandomLicensePlate,
  LICENSE_PLATE_LETTERS,
  LICENSE_PLATE_SPIN_PRICE,
  getLicensePlateValuation,
} from '../../game/licensePlates';
import type { LicensePlateItem, PlayerState } from '../../types/game';
import { formatRubles } from '../../utils/currency';
import { impact, notification } from '../../utils/haptics';
import { playClick, playError, playWin } from '../../utils/sound';

interface LicensePlateRouletteProps {
  player: PlayerState;
  onPlayerChange: (player: PlayerState) => void;
}

const randomCharacter = (characters: string) => characters[Math.floor(Math.random() * characters.length)];

function PlateCharacter({ value, characters, rolling, frame, index, compact = false }: {
  value: string;
  characters: string;
  rolling: boolean;
  frame: number;
  index: number;
  compact?: boolean;
}) {
  const display = rolling ? randomCharacter(characters) : value;
  return (
    <motion.span
      key={`${index}-${display}-${frame}`}
      initial={rolling ? { y: -15, opacity: 0.45 } : false}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.12, ease: 'easeOut', delay: (index % 4) * 0.012 }}
      className={`inline-flex w-full items-center justify-center overflow-hidden font-[Arial_Narrow,Arial,sans-serif] font-black leading-none text-[#16191B] tabular-nums ${compact ? 'h-5 text-[15px] sm:h-6 sm:text-base' : 'h-9 text-[27px] tracking-[0.01em] sm:h-10 sm:text-3xl'}`}
      aria-hidden="true"
    >
      {display}
    </motion.span>
  );
}

function PlateSign({ plate, rolling, frame }: { plate: string; rolling: boolean; frame: number }) {
  const match = plate.match(/^([АВЕКМНОРСТУХ])(\d{3})([АВЕКМНОРСТУХ]{2})\s(\d{2,3})$/);
  const letters = match?.[1] ?? 'А';
  const digits = match?.[2] ?? '000';
  const ending = match?.[3] ?? 'АА';
  const region = match?.[4] ?? '77';
  const regionCells = rolling ? '000' : region;
  const cells = [...letters, ...digits, ...ending, ...regionCells];

  return (
    <div className="mx-auto w-full max-w-[390px] rounded-[10px] border-[5px] border-[#92989A] bg-[#ECEDE9] p-1 shadow-[0_8px_20px_rgba(0,0,0,0.32)]">
      <div className="relative flex h-[56px] items-stretch rounded-[3px] border border-[#D6D6D0] bg-white px-1.5 sm:h-[64px] sm:px-2.5">
        <div className="grid min-w-0 flex-1 grid-cols-6 items-center">
          {cells.slice(0, 6).map((value, index) => (
            <PlateCharacter
              key={index}
              value={value}
              characters={index === 0 || index >= 4 ? LICENSE_PLATE_LETTERS : '0123456789'}
              rolling={rolling}
              frame={frame}
              index={index}
            />
          ))}
        </div>
        <div className="ml-1 flex w-[48px] shrink-0 flex-col items-center justify-center border-l-2 border-[#232629] sm:ml-2 sm:w-[58px]">
          <div className="mb-0.5 flex h-[7px] w-5 overflow-hidden rounded-[1px] border border-black/10 sm:h-2 sm:w-6">
            <span className="h-full flex-1 bg-white" /><span className="h-full flex-1 bg-[#3155A4]" /><span className="h-full flex-1 bg-[#C53C40]" />
          </div>
          <div className="flex h-6 items-center justify-center gap-0.5 sm:h-7">
            {Array.from({ length: rolling ? 3 : region.length }, (_, index) => (
              <PlateCharacter
                key={`region-${index}`}
                value={regionCells[index] ?? '0'}
                characters="0123456789"
                rolling={rolling}
                frame={frame}
                index={index + 6}
                compact
              />
            ))}
          </div>
          <span className="text-[7px] font-bold leading-none tracking-[0.14em] text-[#16191B] sm:text-[8px]">RUS</span>
        </div>
        <span aria-hidden="true" className="absolute left-[3px] top-[3px] h-[3px] w-[3px] rounded-full bg-[#A4A6A2] shadow-[inset_0_1px_1px_rgba(0,0,0,0.5)]" />
        <span aria-hidden="true" className="absolute bottom-[3px] left-[3px] h-[3px] w-[3px] rounded-full bg-[#A4A6A2] shadow-[inset_0_1px_1px_rgba(0,0,0,0.5)]" />
        <span aria-hidden="true" className="absolute right-[3px] top-[3px] h-[3px] w-[3px] rounded-full bg-[#A4A6A2] shadow-[inset_0_1px_1px_rgba(0,0,0,0.5)]" />
        <span aria-hidden="true" className="absolute bottom-[3px] right-[3px] h-[3px] w-[3px] rounded-full bg-[#A4A6A2] shadow-[inset_0_1px_1px_rgba(0,0,0,0.5)]" />
      </div>
    </div>
  );
}

function PlateInfo({ plate }: { plate: LicensePlateItem }) {
  const value = getLicensePlateValuation(plate.plate);
  const info = value.seriesInfo;
  const badge = value.specialAmr97
    ? 'Особая серия'
    : info?.certainty === 'federal'
      ? 'Федеральная история'
      : info?.certainty === 'regional'
        ? 'Региональная история'
        : info?.certainty === 'folklore'
          ? 'Легенда'
          : 'Обычная серия';

  return (
    <div className="mt-3 space-y-1 text-center">
      <p className="text-[10px] font-bold text-amber-200">Серия {value.series} · {badge} · ×{value.multiplier}</p>
      <p className="text-[11px] leading-relaxed text-zinc-300">
        {info?.meaning ?? 'У этой буквенной серии нет известной подтверждённой исторической трактовки.'}
      </p>
      {info && (
        <>
          <p className="text-[9px] leading-relaxed text-zinc-500">{info.context}</p>
          {info.certainty === 'folklore' && <p className="text-[9px] font-bold text-amber-300">Трактовка не подтверждена однозначно — легенда.</p>}
          <a href="https://nomer.club/specserii" target="_blank" rel="noreferrer" className="inline-block text-[8px] text-zinc-500 underline decoration-zinc-700 underline-offset-2 hover:text-amber-200">
            Источник: {info.source}
          </a>
        </>
      )}
      <p className="text-[9px] text-zinc-500">Коллекционная оценка: <strong className="text-amber-200">{formatRubles(plate.price)}</strong></p>
      <p className="text-[8px] leading-relaxed text-zinc-600">Это историческая репутация серии, не сведения о нынешнем владельце.</p>
    </div>
  );
}

export default function LicensePlateRoulette({ player, onPlayerChange }: LicensePlateRouletteProps) {
  const shouldReduceMotion = useReducedMotion();
  const [rolling, setRolling] = useState(false);
  const [frame, setFrame] = useState(0);
  const [winningPlate, setWinningPlate] = useState('А000АА 77');
  const [result, setResult] = useState<LicensePlateItem>();
  const [notice, setNotice] = useState('');
  const playerRef = useRef(player);
  const onPlayerChangeRef = useRef(onPlayerChange);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const intervalRef = useRef<ReturnType<typeof setInterval>>();
  const [randomFrame, setRandomFrame] = useState('А000АА 77');

  useEffect(() => { playerRef.current = player; }, [player]);
  useEffect(() => { onPlayerChangeRef.current = onPlayerChange; }, [onPlayerChange]);
  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  const rollingPlate = randomFrame;

  const spin = () => {
    if (rolling) return;
    if (player.balance < LICENSE_PLATE_SPIN_PRICE) {
      setNotice(`Не хватает ${formatRubles(LICENSE_PLATE_SPIN_PRICE - player.balance)} для прокрутки.`);
      notification('error');
      playError();
      return;
    }

    const winner = createRandomLicensePlate();
    const duration = shouldReduceMotion ? 160 : 4_200;
    setNotice('');
    setResult(undefined);
    setWinningPlate(winner);
    setRandomFrame(createRandomLicensePlate());
    setRolling(true);
    impact('medium');
    playClick();
    onPlayerChange({ ...player, balance: player.balance - LICENSE_PLATE_SPIN_PRICE });
    intervalRef.current = setInterval(() => {
      setRandomFrame(createRandomLicensePlate());
      setFrame((current) => current + 1);
    }, shouldReduceMotion ? 70 : 72);

    timeoutRef.current = setTimeout(() => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = undefined;
      const wonItem = createLicensePlateItem(winner);
      setRolling(false);
      setResult(wonItem);
      const latestPlayer = playerRef.current;
      onPlayerChangeRef.current({ ...latestPlayer, licensePlates: [...latestPlayer.licensePlates, wonItem] });
      setNotice('Номер добавлен в инвентарь. Его можно поставить на машину или продать.');
      notification('success');
      playWin();
    }, duration);
  };

  return (
    <section className="space-y-4 rounded-2xl border border-[#34383C] bg-[#202326] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-300">Коллекция номерных знаков</p>
          <h2 className="mt-1 text-xl font-black text-white">Номерная рулетка</h2>
          <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">Российский формат · 12 букв · коды регионов</p>
        </div>
        <span className="shrink-0 rounded-lg border border-zinc-700 bg-black/20 px-2 py-1.5 text-[9px] font-black text-zinc-400">{player.licensePlates.length} шт.</span>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-[#17191B] px-3 pb-4 pt-5">
        <PlateSign plate={rolling ? rollingPlate : result?.plate ?? winningPlate} rolling={rolling} frame={frame} />
        <div className="mt-4 flex items-center justify-center gap-2 text-[10px] text-zinc-500">
          {rolling ? <><RotateCw size={13} className="animate-spin text-amber-300" /> Буквы и цифры листаются…</> : <><CarFront size={14} className="text-amber-300" /> Знак останется на месте</>}
        </div>
      </div>

      {notice && <p role="status" className="rounded-xl border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-[10px] leading-relaxed text-amber-100">{notice}</p>}

      <AnimatePresence mode="wait">
        {result && !rolling && (
          <motion.div key={result.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <PlateInfo plate={result} />
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={spin}
        disabled={rolling}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 px-3 py-3.5 text-sm font-black text-[#151719] transition hover:bg-amber-300 disabled:cursor-wait disabled:opacity-60"
      >
        <RotateCw size={16} className={rolling ? 'animate-spin' : ''} />
        {rolling ? 'Крутим номер…' : `Крутить за ${formatRubles(LICENSE_PLATE_SPIN_PRICE)}`}
      </button>
      <p className="flex items-start gap-2 text-[9px] leading-relaxed text-zinc-600">
        <BadgeCheck size={13} className="mt-0.5 shrink-0 text-zinc-500" />
        Шанс выпадения комбинаций равный, повторы возможны. Красивые цифры и известные серии меняют только коллекционную стоимость.
      </p>
      <p className="text-center text-[8px] text-zinc-600">
        Формат по <a href="https://legalacts.ru/doc/gost-r-50577-2018-natsionalnyi-standart-rossiiskoi-federatsii-znaki-gosudarstvennye/" target="_blank" rel="noreferrer" className="underline decoration-zinc-700 underline-offset-2 hover:text-amber-200">ГОСТ Р 50577-2018</a>
        {' · '}коды регионов — <a href="https://pdd.ru/region-codes" target="_blank" rel="noreferrer" className="underline decoration-zinc-700 underline-offset-2 hover:text-amber-200">справочник 2026</a>
      </p>
    </section>
  );
}
