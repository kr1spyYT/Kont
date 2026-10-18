import { useEffect, useRef, useState } from 'react';
import type { Container, InventoryItem } from '../../types/game';
import { impact, notification } from '../../utils/haptics';
import { playMetalHit, playWin } from '../../utils/sound';
import { nextContainerBreakPhase, type ContainerBreakPhase } from '../../game/containerBreak';

export interface OpeningState {
  container: Container;
  item: InventoryItem;
  phase: ContainerBreakPhase;
  sequenceId: number;
  isHitAnimating: boolean;
}

const HIT_LOCK_MS = { 1: 420, 2: 520, 3: 780 } as const;
const REVEAL_START_MS = 840;
const FLASH_DURATION_MS = 520;

type Timer = ReturnType<typeof setTimeout>;

export function useContainerOpening(reducedMotion = false) {
  const [opening, setOpening] = useState<OpeningState>();
  const openingRef = useRef<OpeningState>();
  const sequenceIdRef = useRef(0);
  const hitLockedRef = useRef(false);
  const timersRef = useRef(new Set<Timer>());

  const clearTimers = () => {
    timersRef.current.forEach((timer) => clearTimeout(timer));
    timersRef.current.clear();
  };

  const schedule = (sequenceId: number, delay: number, callback: () => void) => {
    const timer = setTimeout(() => {
      timersRef.current.delete(timer);
      if (sequenceIdRef.current !== sequenceId) return;
      callback();
    }, delay);
    timersRef.current.add(timer);
  };

  useEffect(() => () => {
    sequenceIdRef.current += 1;
    hitLockedRef.current = false;
    openingRef.current = undefined;
    clearTimers();
  }, []);

  const reveal = (container: Container, item: InventoryItem) => {
    clearTimers();
    hitLockedRef.current = false;
    const next: OpeningState = {
      container,
      item,
      phase: 'idle',
      sequenceId: ++sequenceIdRef.current,
      isHitAnimating: false,
    };
    openingRef.current = next;
    setOpening(next);
  };

  const hit = () => {
    const current = openingRef.current;
    if (!current || hitLockedRef.current) return;

    const nextPhase = nextContainerBreakPhase(current.phase);
    if (!nextPhase) return;

    const hitNumber = nextPhase === 'hit1' ? 1 : nextPhase === 'hit2' ? 2 : 3;
    hitLockedRef.current = true;
    const next: OpeningState = { ...current, phase: nextPhase, isHitAnimating: true };
    openingRef.current = next;
    setOpening(next);

    impact(hitNumber === 1 ? 'light' : hitNumber === 2 ? 'medium' : 'heavy');
    playMetalHit(hitNumber);

    schedule(current.sequenceId, reducedMotion ? 90 : HIT_LOCK_MS[hitNumber], () => {
      const active = openingRef.current;
      if (!active || active.sequenceId !== current.sequenceId || active.phase !== nextPhase) return;
      hitLockedRef.current = false;
      const unlocked = { ...active, isHitAnimating: false };
      openingRef.current = unlocked;
      setOpening(unlocked);
    });

    if (hitNumber !== 3) return;

    schedule(current.sequenceId, reducedMotion ? 100 : REVEAL_START_MS, () => {
      const active = openingRef.current;
      if (!active || active.sequenceId !== current.sequenceId || active.phase !== 'hit3') return;
      const revealing: OpeningState = { ...active, phase: 'revealing', isHitAnimating: false };
      openingRef.current = revealing;
      setOpening(revealing);

      schedule(current.sequenceId, reducedMotion ? 90 : FLASH_DURATION_MS, () => {
        const ready = openingRef.current;
        if (!ready || ready.sequenceId !== current.sequenceId || ready.phase !== 'revealing') return;
        const result: OpeningState = { ...ready, phase: 'result', isHitAnimating: false };
        openingRef.current = result;
        setOpening(result);
        hitLockedRef.current = false;

        playWin();
        notification('success');
      });
    });
  };

  const closeOpening = () => {
    clearTimers();
    sequenceIdRef.current += 1;
    hitLockedRef.current = false;
    openingRef.current = undefined;
    setOpening(undefined);
  };

  return { opening, reveal, hit, closeOpening };
}
