import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { processCatalogImage, processCatalogSpriteSheet } from './image-processing.js';

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

  it('removes a dark blue edge-connected gradient without erasing the centered item', async () => {
    const width = 96;
    const height = 96;
    const input = Buffer.alloc(width * height * 4);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const offset = (y * width + x) * 4;
        input[offset] = 8 + Math.round((x / (width - 1)) * 18);
        input[offset + 1] = 13 + Math.round((y / (height - 1)) * 16);
        input[offset + 2] = 28 + Math.round(((x + y) / (width + height - 2)) * 22);
        input[offset + 3] = 255;
      }
    }
    for (let y = 32; y < 64; y += 1) {
      for (let x = 40; x < 56; x += 1) {
        const offset = (y * width + x) * 4;
        input[offset] = 218;
        input[offset + 1] = 174;
        input[offset + 2] = 86;
        input[offset + 3] = 255;
      }
    }

    const source = await sharp(input, { raw: { width, height, channels: 4 } }).png().toBuffer();
    const output = await processCatalogImage(source);
    const { data, info } = await sharp(output).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

    expect(data[(160 * info.width + 40) * info.channels + 3]).toBe(0);
    expect(data[(160 * info.width + 160) * info.channels + 3]).toBeGreaterThan(200);
  });

  it('preserves busy non-uniform edges rather than guessing a background', async () => {
    const width = 80;
    const height = 80;
    const input = Buffer.alloc(width * height * 4);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const offset = (y * width + x) * 4;
        const color = (x + y) % 3 === 0 ? [225, 42, 55] : (x + y) % 3 === 1 ? [25, 188, 92] : [38, 75, 224];
        input[offset] = color[0];
        input[offset + 1] = color[1];
        input[offset + 2] = color[2];
        input[offset + 3] = 255;
      }
    }
    const source = await sharp(input, { raw: { width, height, channels: 4 } }).png().toBuffer();
    const output = await processCatalogImage(source);
    const { data, info } = await sharp(output).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

    expect(data[(40 * info.width + 40) * info.channels + 3]).toBeGreaterThan(200);
  });

  it('can normalize existing catalog files as transparent PNGs', async () => {
    const input = Buffer.alloc(40 * 40 * 4, 255);
    for (let y = 12; y < 28; y += 1) {
      for (let x = 12; x < 28; x += 1) {
        const offset = (y * 40 + x) * 4;
        input[offset] = 40;
        input[offset + 1] = 130;
        input[offset + 2] = 210;
      }
    }
    const source = await sharp(input, { raw: { width: 40, height: 40, channels: 4 } }).png().toBuffer();
    const output = await processCatalogImage(source, 'png');
    const metadata = await sharp(output).metadata();
    const { data, info } = await sharp(output).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

    expect(metadata.format).toBe('png');
    expect(info.width).toBe(320);
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

  it('splits five-column sprite sheets left-to-right then top-to-bottom', async () => {
    const width = 100;
    const height = 40;
    const input = Buffer.alloc(width * height * 4, 255);
    for (let item = 0; item < 7; item += 1) {
      const column = item % 5;
      const row = Math.floor(item / 5);
      const red = 40 + item * 25;
      for (let y = row * 20 + 3; y < row * 20 + 17; y += 1) {
        for (let x = column * 20 + 3; x < column * 20 + 17; x += 1) {
          const offset = (y * width + x) * 4;
          input[offset] = red;
          input[offset + 1] = 45;
          input[offset + 2] = 150;
          input[offset + 3] = 255;
        }
      }
    }
    const sheet = await sharp(input, { raw: { width, height, channels: 4 } }).png().toBuffer();
    const cells = await processCatalogSpriteSheet(sheet, 7);

    expect(cells).toHaveLength(7);
    for (let item = 0; item < cells.length; item += 1) {
      const { data, info } = await sharp(cells[item]).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const center = (160 * info.width + 160) * info.channels;
      expect(data[center]).toBeCloseTo(40 + item * 25, -1);
      expect(data[center + 3]).toBeGreaterThan(200);
    }
  });
});
