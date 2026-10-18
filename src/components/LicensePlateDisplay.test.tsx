import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import LicensePlateDisplay from './LicensePlateDisplay';

describe('LicensePlateDisplay', () => {
  it('shows the complete plate and overlays the season frame around its edge', () => {
    const markup = renderToStaticMarkup(createElement(LicensePlateDisplay, {
      plate: 'А777АА 77',
      frameIds: ['season-01-vip'],
      size: 'large',
    }));

    expect(markup).toContain('aria-label="Госномер А777АА 77, рамка SEASON 01 // VIP"');
    expect(markup).toContain('А777АА');
    expect(markup).toContain('77');
    expect(markup).toContain('SEASON 01 // VIP');
    expect(markup).toContain('data-frame-id="season-01-vip"');
    expect(markup).toContain('pointer-events-none absolute inset-x-0 top-2 bottom-0');
  });

  it('shows a clear fallback when no number is assigned', () => {
    const markup = renderToStaticMarkup(createElement(LicensePlateDisplay, { plate: 'Без номера' }));

    expect(markup).toContain('Без номера');
    expect(markup).not.toContain('SEASON 01 // VIP');
  });
});
