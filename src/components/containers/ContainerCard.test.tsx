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

  it('renders Dubai Transit with transparent art, premium shadow, and a gold glow', () => {
    const dubai = CONTAINERS.find(({ id }) => id === 'dubai-transit');
    if (!dubai) throw new Error('Dubai Transit container fixture is missing');
    const premiumMarkup = renderToStaticMarkup(createElement(ContainerCard, {
      container: dubai,
      selected: false,
      disabled: false,
      shouldReduceMotion: true,
      seasonTokens: 0,
      onSelect: vi.fn(),
      onQuickOpen: vi.fn(),
      onSeasonOpen: vi.fn(),
    }));

    expect(premiumMarkup).toContain('src="containers/dubai.webp"');
    expect(premiumMarkup).toContain('drop-shadow-[0_16px_24px_rgba(0,0,0,0.85)]');
    expect(premiumMarkup).toContain('rgba(245, 158, 11, 0.2)');
  });
});
