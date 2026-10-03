"use client";

import { localizeUiTree, useUiLocale } from "@/lib/i18n/ui-locale";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { AppLoadingSpinner } from "./app-loading-spinner";
import styles from "./inspiration-preview.module.css";

export function InspirationPreview({ title, imageUrl, videoUrl, prompt, onClose, onTry }: {
  title: string;
  imageUrl: string;
  videoUrl?: string;
  prompt: string;
  onClose: () => void;
  onTry: (prompt: string) => void;
}) {
  const uiLocale = useUiLocale();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [imageStatus, setImageStatus] = useState<"loading" | "loaded" | "failed">("loading");

  useEffect(() => {
    const dialog = dialogRef.current;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog?.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = previousOverflow;
      trigger?.focus({ preventScroll: true });
    };
  }, []);

  return createPortal(
    localizeUiTree(<dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby={titleId}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div className={styles.panel}>
        <button type="button" className={styles.close} aria-label="Close preview" onClick={onClose} autoFocus>
          <X size={22} aria-hidden />
        </button>
        <div className={styles.imageStage} aria-busy={imageStatus === "loading"}>
          {imageStatus === "loading" ? <span className={styles.loading} role="status"><AppLoadingSpinner size={28} /><span className={styles.srOnly}>Loading preview</span></span> : null}
          {imageStatus === "failed" ? <p className={styles.error} role="status">Unable to load this preview. You can still try its prompt.</p> : null}
          {videoUrl ? (
            <video src={videoUrl} poster={imageUrl} controls autoPlay playsInline preload="metadata"
              onLoadedData={() => setImageStatus("loaded")} onError={() => setImageStatus("failed")}
              hidden={imageStatus === "failed"} aria-label={title} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img data-i18n-skip src={imageUrl} alt={title} onLoad={() => setImageStatus("loaded")} onError={() => setImageStatus("failed")} hidden={imageStatus === "failed"} />
          )}
        </div>
        <div className={styles.details}>
          <h2 data-i18n-skip id={titleId}>{title}</h2>
          <button type="button" className={styles.tryButton} disabled={!prompt.trim()} onClick={() => {
            dialogRef.current?.close();
            onTry(prompt);
            onClose();
          }}>Try it now</button>
        </div>
      </div>
    </dialog>, uiLocale),
    document.body
  );
}
