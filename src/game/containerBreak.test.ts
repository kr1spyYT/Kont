import { describe, expect, it } from 'vitest';
import { nextContainerBreakPhase, type ContainerBreakPhase } from './containerBreak';

describe('container break sequence', () => {
  it('advances through exactly three hits', () => {
    const phases: ContainerBreakPhase[] = ['idle'];
    let phase: ContainerBreakPhase = 'idle';

    while (nextContainerBreakPhase(phase)) {
      phase = nextContainerBreakPhase(phase)!;
      phases.push(phase);
    }

    expect(phases).toEqual(['idle', 'hit1', 'hit2', 'hit3']);
  });

  it('does not accept hits while revealing or after the result', () => {
    expect(nextContainerBreakPhase('hit3')).toBeUndefined();
    expect(nextContainerBreakPhase('revealing')).toBeUndefined();
    expect(nextContainerBreakPhase('result')).toBeUndefined();
  });
});
