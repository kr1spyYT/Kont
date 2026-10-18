import type { Container } from '../../types/game';
import { isRenderableImageSource } from '../GameImage';

type ContainerArtworkSource = Pick<Container, 'image' | 'icon'>;

const preloadedImages = new Map<string, HTMLImageElement>();

export function preloadContainerImages(
  containers: readonly ContainerArtworkSource[],
  createImage: () => HTMLImageElement = () => new Image(),
): void {
  for (const container of containers) {
    const source = [container.image, container.icon].find(isRenderableImageSource);
    if (!source || preloadedImages.has(source)) continue;

    const image = createImage();
    image.decoding = 'async';
    image.loading = 'eager';
    image.onerror = () => {
      preloadedImages.delete(source);
      image.onerror = null;
    };
    preloadedImages.set(source, image);
    image.src = source;
  }
}
