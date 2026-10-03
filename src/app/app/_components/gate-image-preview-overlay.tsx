"use client";

import { useEffect, useState } from "react";
import { X, ZoomIn, ZoomOut } from "lucide-react";
import { localizeUiTree, useUiLocale } from "@/lib/i18n/ui-locale";
import type { GeneratedImage } from "./app-subscription-model";
import styles from "./subscription-gate-modal/index.module.css";

export function GateImagePreviewOverlay({
  image,
  onClose
}: {
  image: GeneratedImage;
  onClose: () => void;
}) {
  const uiLocale = useUiLocale();
  const [zoom, setZoom] = useState(1);
  const alt = image.promptSummary || `Generated image ${image.imageIndex + 1}`;

  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const zoomOut = () => setZoom((current) => Math.max(0.5, Number((current - 0.25).toFixed(2))));
  const zoomIn = () => setZoom((current) => Math.min(3, Number((current + 0.25).toFixed(2))));

  return localizeUiTree((
    <div
      className={styles.imagePreviewOverlay}
      role="dialog"
      aria-modal="true"
      aria-label="Image preview"
      onClick={onClose}
    >
      <div className={styles.imagePreviewToolbar}>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            zoomOut();
          }}
          aria-label="Zoom out"
          title="Zoom out"
        >
          <ZoomOut size={20} aria-hidden="true" />
        </button>
        <span>{Math.round(zoom * 100)}%</span>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            zoomIn();
          }}
          aria-label="Zoom in"
          title="Zoom in"
        >
          <ZoomIn size={20} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onClose();
          }}
          aria-label="Close image preview"
          title="Close"
        >
          <X size={20} aria-hidden="true" />
        </button>
      </div>

      <div className={styles.imagePreviewStage}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image.url}
          alt={alt}
          style={{ transform: `scale(${zoom})` }}
          onClick={(event) => event.stopPropagation()}
          draggable={false}
        />
      </div>
    </div>
  ), uiLocale);
}
