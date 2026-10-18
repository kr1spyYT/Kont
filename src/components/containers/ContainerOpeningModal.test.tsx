import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Container, InventoryItem } from '../../types/game';
import type { OpeningState } from './useContainerOpening';
import ContainerOpeningModal from './ContainerOpeningModal';

const container: Container = {
  id: 'test-case',
  order: 1,
  tier: 1,
  name: 'Тестовый контейнер',
  category: 'clothing',
  price: 1_500,
  description: 'Тестовый предмет',
  icon: '📦',
  image: '/assets/test-case.webp',
  contents: [],
};

const item: InventoryItem = {
  id: 'test-item',
  name: 'Тестовое худи',
  type: 'clothing',
  rarity: 'legendary',
  icon: '👕',
  price: 1_200,
  basePrice: 1_500,
  respect: 5,
  serial: '#001/500',
  wear: 82.5,
  createdAt: '2026-10-18T00:00:00.000Z',
  containerId: container.id,
  slot: 'torso',
  authenticity: '***',
};

const makeOpening = (phase: OpeningState['phase']): OpeningState => ({
  container,
  item,
  phase,
  sequenceId: 1,
  isHitAnimating: false,
});

const renderModal = (phase: OpeningState['phase']) => renderToStaticMarkup(createElement(ContainerOpeningModal, {
  opening: makeOpening(phase),
  shouldReduceMotion: false,
  onHit: () => undefined,
  onClose: () => undefined,
  onKeep: () => undefined,
  onSell: () => undefined,
}));

describe('Container Break reveal modal', () => {
  it('shows the existing case artwork and the first-hit prompt before the reward', () => {
    const markup = renderModal('idle');

    expect(markup).toContain('data-phase="idle"');
    expect(markup).toContain('src="/assets/test-case.webp"');
    expect(markup).toContain('Нажми, чтобы ударить');
    expect(markup).not.toContain('Твой дроп!');
  });

  it('shows the server-awarded item and existing keep/sell actions after the reveal', () => {
    const markup = renderModal('result');

    expect(markup).toContain('data-phase="result"');
    expect(markup).toContain('Тестовое худи');
    expect(markup).toContain('Legendary');
    expect(markup).toContain('В инвентарь');
    expect(markup).toContain('Продать сразу');
    expect(markup).toContain('sticky bottom-0');
  });
});
