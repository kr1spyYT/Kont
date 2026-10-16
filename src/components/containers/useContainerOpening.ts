import confetti from 'canvas-confetti';
import { useLayoutEffect, useRef, useState } from 'react';
import { pickDrop } from '../../data/items';
import type { Container, ContainerDrop, InventoryItem, Rarity } from '../../types/game';
import { impact, notification } from '../../utils/haptics';
import { playSpin, playWin } from '../../utils/sound';

interface TapeCard {
  drop: ContainerDrop;
  isWinner: boolean;
}

export interface OpeningState {
  container: Container;
  item: InventoryItem;
  tape: TapeCard[];
  phase: 'spinning' | 'stopped' | 'revealed';
  spinId: number;
}

const TAPE_LENGTH = 48;
const WIN_INDEX = 41;
const CARD_WIDTH = 116;
const CARD_MARGIN = 4;
const CARD_STEP = CARD_WIDTH + CARD_MARGIN * 2;
const SPIN_DURATION = 5_200;

const makeTape = (container: Container, winningDrop: ContainerDrop): TapeCard[] =>
  Array.from({ length: TAPE_LENGTH }, (_, index) => ({
    drop: index === WIN_INDEX ? winningDrop : pickDrop(container),
    isWinner: index === WIN_INDEX,
  }));

const makeItem = (container: Container, drop: ContainerDrop): InventoryItem => {
  const wear = Math.round((Math.random() * 80 + 20) * 100) / 100;
  const itemValue = Math.round(drop.basePrice * (0.55 + (wear / 100) * 0.45));
  const common = {
    id: crypto.randomUUID(),
    name: drop.name,
    type: container.category,
    rarity: drop.rarity,
    icon: drop.icon,
    image: drop.image,
    price: itemValue,
    basePrice: drop.basePrice,
    respect: drop.respect,
    serial: `#${String(Math.floor(Math.random() * 500) + 1).padStart(3, '0')}/500`,
    wear,
    createdAt: new Date().toISOString(),
    containerId: container.id,
  };

  if (container.category === 'clothing') {
    return {
      ...common,
      type: 'clothing',
      slot: drop.slot ?? 'accessory',
      authenticity: 'unverified',
    };
  }

  const mileage = Math.floor(Math.random() * (380_000 - 15_000 + 1)) + 15_000;
  return { ...common, type: 'car', slot: 'car', mileage };
};

export function useContainerOpening() {
  const [opening, setOpening] = useState<OpeningState>();
  const viewportRef = useRef<HTMLDivElement>(null);
  const tapeRef = useRef<HTMLDivElement>(null);
  const spinIdRef = useRef(0);

  useLayoutEffect(() => {
    if (!opening) return undefined;

    const { item, spinId } = opening;
    const viewport = viewportRef.current;
    const tape = tapeRef.current;
    if (!viewport || !tape) return undefined;

    const viewportWidth = viewport.clientWidth;
    const cardCenter = CARD_MARGIN + CARD_WIDTH / 2;
    const centerX = viewportWidth / 2;
    const startX = centerX - cardCenter;
    const landingOffset = Math.random() * 70 - 35;
    const targetX = centerX - (cardCenter + CARD_STEP * WIN_INDEX) + landingOffset;

    tape.style.transition = 'none';
    tape.style.transform = `translate3d(${startX}px, 0, 0)`;
    tape.getBoundingClientRect();

    let frameId: number | undefined;
    let finishTimeout: ReturnType<typeof setTimeout> | undefined;
    let revealTimeout: ReturnType<typeof setTimeout> | undefined;
    let lastCrossedIndex = 0;

    const finishSpin = () => {
      if (frameId !== undefined) cancelAnimationFrame(frameId);
      frameId = undefined;
      setOpening((current) =>
        current?.spinId === spinId ? { ...current, phase: 'stopped' } : current,
      );
      playWin();

      if (item.rarity !== 'common') {
        notification('success');
        const particleCount = item.rarity === 'legendary' ? 140 : item.rarity === 'epic' ? 100 : 60;
        confetti({
          particleCount,
          spread: 75,
          origin: { y: 0.65 },
          colors: item.rarity === 'legendary'
            ? ['#fbbf24', '#f472b6', '#22d3ee']
            : ['#d946ef', '#22d3ee', '#a78bfa'],
        });
      } else {
        impact('soft');
      }

      revealTimeout = setTimeout(() => {
        setOpening((current) =>
          current?.spinId === spinId ? { ...current, phase: 'revealed' } : current,
        );
      }, 600);
    };

    const startAnimation = () => {
      tape.style.transition = `transform ${SPIN_DURATION}ms cubic-bezier(0.12, 0.8, 0.18, 1)`;
      tape.style.transform = `translate3d(${targetX}px, 0, 0)`;
      const startedAt = performance.now();

      const trackCrossings = () => {
        const transform = window.getComputedStyle(tape).transform;
        const translateX = transform === 'none' ? 0 : new DOMMatrixReadOnly(transform).m41;
        const crossedIndex = Math.min(
          TAPE_LENGTH - 1,
          Math.max(0, Math.floor((centerX - (translateX + cardCenter)) / CARD_STEP)),
        );

        while (lastCrossedIndex < crossedIndex) {
          lastCrossedIndex += 1;
          playSpin();
          impact('light');
        }

        if (performance.now() - startedAt < SPIN_DURATION) {
          frameId = requestAnimationFrame(trackCrossings);
        }
      };

      frameId = requestAnimationFrame(trackCrossings);
      finishTimeout = setTimeout(finishSpin, SPIN_DURATION);
    };

    frameId = requestAnimationFrame(() => {
      frameId = requestAnimationFrame(startAnimation);
    });

    return () => {
      if (frameId !== undefined) cancelAnimationFrame(frameId);
      if (finishTimeout) clearTimeout(finishTimeout);
      if (revealTimeout) clearTimeout(revealTimeout);
    };
  }, [opening?.spinId]);

  const reveal = (container: Container) => {
    const winningDrop = pickDrop(container);
    setOpening({
      container,
      item: makeItem(container, winningDrop),
      tape: makeTape(container, winningDrop),
      phase: 'spinning',
      spinId: ++spinIdRef.current,
    });
  };

  const closeOpening = () => setOpening(undefined);

  return { opening, viewportRef, tapeRef, reveal, closeOpening };
}
