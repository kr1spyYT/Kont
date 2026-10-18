import { describe, expect, it } from 'vitest';
import { preloadContainerImages } from './preloadContainerImages';

describe('preloadContainerImages', () => {
  it('starts eager requests for every catalog image and reuses them', () => {
    const loadedImages: HTMLImageElement[] = [];
    const createImage = () => {
      const image = { src: '', decoding: 'auto', loading: 'auto', onerror: null } as unknown as HTMLImageElement;
      loadedImages.push(image);
      return image;
    };
    const containers = [
      { image: 'data:image/webp;base64,container-clothing-preload-test', icon: '👕' },
      { image: '/assets/container-car-preload-test.webp', icon: '🚗' },
      { image: 'containers/plate-preload-test.png', icon: '🔢' },
    ];

    preloadContainerImages(containers, createImage);
    preloadContainerImages(containers, createImage);

    expect(loadedImages.map((image) => image.src)).toEqual(containers.map((container) => container.image));
    expect(loadedImages.every((image) => image.loading === 'eager' && image.decoding === 'async')).toBe(true);
  });
});
