import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import LicensePlateDisplay from './LicensePlateDisplay';

describe('LicensePlateDisplay', () => {
  it('renders official plate groups, reflective metal, region, flag and RUS mark', () => {
    const markup = renderToStaticMarkup(createElement(LicensePlateDisplay, { plate: 'А124МР 77', size: 'large' }));

    expect(markup).toContain('data-plate-part="first-letter"');
    expect(markup).toContain('data-plate-part="digits"');
    expect(markup).toContain('data-plate-part="ending-letters"');
    expect(markup).toContain('>А</span>');
    expect(markup).toContain('>124</span>');
    expect(markup).toContain('>МР</span>');
    expect(markup).toContain('77');
    expect(markup).toContain('aria-label="Флаг России"');
    expect(markup).toContain('RUS');
    expect(markup).toContain('bg-gradient-to-b from-[#f9f9f9]');
    expect(markup).toContain('license-plate-typeface');
  });

  it('normalizes unspaced Latin plate input into readable official groups', () => {
    const markup = renderToStaticMarkup(createElement(LicensePlateDisplay, { plate: 'A124MP77', size: 'compact' }));

    expect(markup).toContain('data-plate-part="first-letter"');
    expect(markup).toContain('А');
    expect(markup).toContain('124');
    expect(markup).toContain('МР');
    expect(markup).toContain('77');
  });

  it('overlays the season VIP frame without hiding the real number or region', () => {
    const markup = renderToStaticMarkup(createElement(LicensePlateDisplay, {
      plate: 'А777АА 77',
      frameIds: ['season-01-vip'],
      size: 'large',
    }));

    expect(markup).toContain('aria-label="Госномер А777АА 77, рамка SEASON 01 // VIP"');
    expect(markup).toContain('src="/assets/season/genesis/vip-license-frame.webp"');
    expect(markup).toContain('>А</span>');
    expect(markup).toContain('>777</span>');
    expect(markup).toContain('>АА</span>');
    expect(markup).toContain('77');
    expect(markup).toContain('SEASON 01 // VIP');
    expect(markup).toContain('data-frame-id="season-01-vip"');
    expect(markup).toContain('drop-shadow-[0_5px_10px_rgba(0,0,0,0.62)]');
  });

  it('shows a clear fallback when no number is assigned', () => {
    const markup = renderToStaticMarkup(createElement(LicensePlateDisplay, { plate: 'Без номера' }));

    expect(markup).toContain('Без номера');
    expect(markup).not.toContain('SEASON 01 // VIP');
  });
});
