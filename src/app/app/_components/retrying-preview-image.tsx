"use client";

import type { ComponentPropsWithoutRef } from "react";
import { useRetryingImagePreview } from "./use-retrying-image-preview";

type RetryingPreviewImageProps = Omit<
  ComponentPropsWithoutRef<"img">,
  "src" | "alt" | "onLoad" | "onError"
> & {
  alt: string;
  sourceUrl: string;
};

export function RetryingPreviewImage({
  alt,
  sourceUrl,
  ...imageProps
}: RetryingPreviewImageProps) {
  const preview = useRetryingImagePreview(sourceUrl);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      {...imageProps}
      key={preview.requestKey}
      src={preview.src}
      alt={alt}
      onLoad={preview.handleLoad}
      onError={() => void preview.handleError()}
    />
  );
}
