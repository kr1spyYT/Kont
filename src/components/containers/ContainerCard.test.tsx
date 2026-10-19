import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { CONTAINERS } from '../../data/items';
import { formatRubles } from '../../utils/currency';
import ContainerCard from './ContainerCard';

const container = CONTAINERS[0];
const markup = renderToStaticMarkup(createElement(ContainerCard, {
  container,
  selected: true,
  disabled: false,
  shouldReduceMotion: true,
  seasonTokens: 2,
  onSelect: vi.fn(),
  onQuickOpen: vi.fn(),
  onSeasonOpen: vi.fn(),
}));

describe('compact container card', () => {
  it('uses the existing large artwork and shows category, tier, price, and season tickets', () => {
    expect(markup).toContain('src="containers/second.png"');
    expect(markup).toContain('ОДЕЖДА');
    expect(markup).toContain('Тир 1');
    expect(markup).toContain(formatRubles(container.price));
    expect(markup).toContain('Сезонный билет · 2');
  });
});
