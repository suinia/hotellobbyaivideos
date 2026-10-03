"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";

type AppFallbackImageProps = Omit<ImageProps, "src" | "onError" | "onLoad" | "unoptimized"> & {
  src: string;
  unoptimized?: boolean;
  onLoad?: ImageProps["onLoad"];
  onError?: ImageProps["onError"];
};

export function AppFallbackImage({
  src,
  alt,
  unoptimized = false,
  onError,
  ...props
}: AppFallbackImageProps) {
  const [fallbackState, setFallbackState] = useState({
    src: "",
    enabled: false
  });
  const fallbackEnabled = !unoptimized && fallbackState.src === src && fallbackState.enabled;

  return (
    <Image
      key={fallbackEnabled ? `original:${src}` : `optimized:${src}`}
      {...props}
      src={src}
      alt={alt}
      unoptimized={unoptimized || fallbackEnabled}
      onError={(event) => {
        if (!unoptimized && !fallbackEnabled) {
          setFallbackState({ src, enabled: true });
          return;
        }
        onError?.(event);
      }}
    />
  );
}
