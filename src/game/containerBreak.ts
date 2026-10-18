export type ContainerBreakPhase = 'idle' | 'hit1' | 'hit2' | 'hit3' | 'revealing' | 'result';

export function nextContainerBreakPhase(phase: ContainerBreakPhase): ContainerBreakPhase | undefined {
  switch (phase) {
    case 'idle':
      return 'hit1';
    case 'hit1':
      return 'hit2';
    case 'hit2':
      return 'hit3';
    default:
      return undefined;
  }
}
