import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { processCatalogImage } from './image-processing.js';

describe('processCatalogImage', () => {
  it('removes a uniform edge background and outputs a centered 320px transparent webp', async () => {
    const width = 160;
    const height = 120;
    const input = Buffer.alloc(width * height * 4, 255);
    for (let y = 28; y < 92; y += 1) {
      for (let x = 55; x < 105; x += 1) {
        const offset = (y * width + x) * 4;
        input[offset] = 190;
        input[offset + 1] = 65;
        input[offset + 2] = 35;
        input[offset + 3] = 255;
      }
    }
    const source = await sharp(input, { raw: { width, height, channels: 4 } }).png().toBuffer();
    const output = await processCatalogImage(source);
    const { data, info } = await sharp(output).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

    expect(info.width).toBe(320);
    expect(info.height).toBe(320);
    expect((await sharp(output).metadata()).format).toBe('webp');
    expect(data[3]).toBe(0);
    expect(data[(160 * info.width + 160) * info.channels + 3]).toBeGreaterThan(200);
  });

  it('preserves existing transparency around an image', async () => {
    const width = 64;
    const height = 64;
    const input = Buffer.alloc(width * height * 4);
    for (let y = 16; y < 48; y += 1) {
      for (let x = 16; x < 48; x += 1) {
        const offset = (y * width + x) * 4;
        input[offset] = 240;
        input[offset + 1] = 200;
        input[offset + 2] = 50;
        input[offset + 3] = 255;
      }
    }
    const source = await sharp(input, { raw: { width, height, channels: 4 } }).png().toBuffer();
    const output = await processCatalogImage(source);
    const { data, info } = await sharp(output).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

    expect(info.width).toBe(320);
    expect(info.height).toBe(320);
    expect(data[3]).toBe(0);
    expect(data[(160 * info.width + 160) * info.channels + 3]).toBe(255);
  });

  it('normalizes grayscale sources before removing their edge background', async () => {
    const width = 80;
    const height = 60;
    const input = Buffer.alloc(width * height, 230);
    for (let y = 18; y < 42; y += 1) {
      for (let x = 28; x < 52; x += 1) input[y * width + x] = 35;
    }
    const source = await sharp(input, { raw: { width, height, channels: 1 } }).png().toBuffer();
    const output = await processCatalogImage(source);
    const { data, info } = await sharp(output).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

    expect(info.width).toBe(320);
    expect(info.height).toBe(320);
    expect(info.channels).toBe(4);
    expect(data[3]).toBe(0);
    expect(data[(160 * info.width + 160) * info.channels + 3]).toBeGreaterThan(200);
  });
});
