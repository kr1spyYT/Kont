import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import sharp from 'sharp';
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
    expect(markup).toContain('src="/assets/season/genesis/vip-frame-empty.webp"');
    expect(markup).toContain('object-fill');
    expect(markup).toContain('aspect-[2.15/1]');
    expect(markup).toContain('data-plate-zone="main"');
    expect(markup).toContain('left-[9%] top-[30%] z-10 h-[42%] w-[59%]');
    expect(markup).toContain('data-plate-zone="region"');
    expect(markup).toContain('left-[70%] top-[28%] z-10 h-[45%] w-[21%] justify-between');
    expect(markup).toContain('>А</span>');
    expect(markup).toContain('>777</span>');
    expect(markup).toContain('>АА</span>');
    expect(markup).toContain('77');
    expect(markup).toContain('SEASON 01 // VIP');
    expect(markup).toContain('data-frame-id="season-01-vip"');
    expect(markup).toContain('drop-shadow-[0_5px_10px_rgba(0,0,0,0.62)]');
  });

  it('ships the season VIP frame tightly cropped to visible pixels', async () => {
    const { data, info } = await sharp('public/assets/season/genesis/vip-frame-empty.webp')
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    let left = info.width;
    let top = info.height;
    let right = -1;
    let bottom = -1;

    for (let y = 0; y < info.height; y += 1) {
      for (let x = 0; x < info.width; x += 1) {
        if (data[(y * info.width + x) * 4 + 3] > 0) {
          left = Math.min(left, x);
          top = Math.min(top, y);
          right = Math.max(right, x);
          bottom = Math.max(bottom, y);
        }
      }
    }

    expect({ left, top, right, bottom }).toEqual({
      left: 0,
      top: 0,
      right: info.width - 1,
      bottom: info.height - 1,
    });
  });

  it('shows a clear fallback when no number is assigned', () => {
    const markup = renderToStaticMarkup(createElement(LicensePlateDisplay, { plate: 'Без номера' }));

    expect(markup).toContain('Без номера');
    expect(markup).not.toContain('SEASON 01 // VIP');
  });
});
