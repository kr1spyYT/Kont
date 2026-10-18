import { useState, type ReactNode } from 'react';

const IMAGE_EXTENSION = /\.(?:avif|gif|jpe?g|png|svg|webp)(?:[?#].*)?$/i;

export function isRenderableImageSource(source?: string): source is string {
  return Boolean(source && (
    /^data:image\//i.test(source)
    || /^https?:\/\//i.test(source)
    || source.startsWith('/')
    || IMAGE_EXTENSION.test(source)
  ));
}

interface GameImageProps {
  source?: string;
  image?: string;
  imageUrl?: string;
  icon?: string;
  alt: string;
  className?: string;
  fallback?: ReactNode;
  onLoad?: () => void;
  onError?: () => void;
  loading?: 'eager' | 'lazy';
}

export default function GameImage({ source, image, imageUrl, icon, alt, className, fallback, onLoad, onError, loading }: GameImageProps) {
  const [failedSource, setFailedSource] = useState<string>();
  const imageSource = [source, imageUrl, image, icon].find(isRenderableImageSource);
  if (!imageSource || failedSource === imageSource) return <>{fallback ?? null}</>;

  return (
    <img
      src={imageSource}
      alt={alt}
      className={className}
      loading={loading}
      onLoad={onLoad}
      onError={() => {
        setFailedSource(imageSource);
        onError?.();
      }}
    />
  );
}
