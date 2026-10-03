"use client";

import { localizeUiTree, useUiLocale } from "@/lib/i18n/ui-locale";
import { t } from "@/lib/i18n/catalog";

import Image from "next/image";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Download, X } from "lucide-react";
import {
  type GeneratedImage
} from "../app-subscription-model";
import { AppLoadingSpinner } from "../app-loading-spinner";
import {
  normalizeAuthEmail,
  sendSupabaseEmailOtp,
  verifySupabaseEmailOtp
} from "@/lib/supabase/email-otp";
import { supabaseConfig } from "@/lib/supabase/config";
import { clearGuestClaimIntent } from "@/lib/auth/guest-claim";
import { captureAnalyticsEvent } from "@/lib/analytics/posthog";
import { trackClientEvent } from "@/lib/telemetry/client";
import {
  buildImagePreviewFailureReason,
  useRetryingImagePreview
} from "../use-retrying-image-preview";
import { RetryingPreviewImage } from "../retrying-preview-image";
import { GateImagePreviewOverlay } from "../gate-image-preview-overlay";
import styles from "./index.module.css";

export type SignupGateModalProps = {
  image?: GeneratedImage | null;
  selectableImages?: GeneratedImage[];
  onImageSelect?: (image: GeneratedImage) => void;
  previewBadge?: string;
  title: string;
  copy: string;
  onClose: () => void;
  onProviderSelect: (provider: "google" | "apple") => void;
  onEmailStart: () => boolean | Promise<boolean>;
  onEmailSuccess: () => Promise<void> | void;
  onFallbackSignup?: () => void;
  onContinueWithWatermark?: () => Promise<void>;
};

export function SignupGateModal({
  image,
  selectableImages,
  onImageSelect,
  previewBadge,
  title,
  copy,
  onClose,
  onProviderSelect,
  onEmailStart,
  onEmailSuccess,
  onFallbackSignup,
  onContinueWithWatermark
}: SignupGateModalProps) {
  const uiLocale = useUiLocale();
  const [downloadingWatermarked, setDownloadingWatermarked] = useState(false);
  const [expandedPreviewOpen, setExpandedPreviewOpen] = useState(false);
  const preview = useRetryingImagePreview(image?.url);
  const previewLoadStartedAtRef = useRef(Date.now());
  const [emailAddress, setEmailAddress] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [emailPending, setEmailPending] = useState(false);
  const [emailMessage, setEmailMessage] = useState("");
  const [emailError, setEmailError] = useState("");
  const supportsGoogleAuth = supabaseConfig.authProviders.includes("google");
  const supportsAppleAuth = supabaseConfig.authProviders.includes("apple");
  const supportsEmailAuth = supabaseConfig.authProviders.includes("email");
  const canShowAuthOptions = supportsGoogleAuth || supportsAppleAuth || supportsEmailAuth;
  const previewChoices = (selectableImages ?? []).filter((item) => item.url);
  const showPreviewChoices = previewChoices.length > 1;
  const hasPreview = Boolean(image?.url);

  const closeAuthModal = () => {
    void clearGuestClaimIntent();
    onClose();
  };

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    previewLoadStartedAtRef.current = Date.now();
  }, [image?.url]);

  async function continueWithWatermark() {
    if (!onContinueWithWatermark || downloadingWatermarked) return;
    setDownloadingWatermarked(true);
    try {
      await onContinueWithWatermark();
    } finally {
      setDownloadingWatermarked(false);
    }
  }

  async function sendEmailCode() {
    if (!supportsEmailAuth || emailPending || !(await onEmailStart())) return;

    const email = normalizeAuthEmail(emailAddress);
    const emailRedirectTo =
      typeof window === "undefined"
        ? "/auth/callback"
        : `${window.location.origin}/auth/callback?next=${encodeURIComponent(`${window.location.pathname}${window.location.search}`)}`;

    setEmailPending(true);
    setEmailError("");
    setEmailMessage("");
    const result = await sendSupabaseEmailOtp({
      email,
      emailRedirectTo,
      shouldCreateUser: true,
      locale: uiLocale,
      analytics: { entry: "app_thread_watermarked_signup" }
    });
    setEmailPending(false);

    if (!result.ok) {
      setEmailError(result.error);
      return;
    }

    setEmailAddress(email);
    setEmailCode("");
    setEmailOtpSent(true);
    setEmailMessage(t(uiLocale, "workbench.auth.codeSent", { email }));
  }

  async function verifyEmailCode() {
    if (!supportsEmailAuth || emailPending) return;

    setEmailPending(true);
    setEmailError("");
    const result = await verifySupabaseEmailOtp({
      email: emailAddress,
      token: emailCode,
      locale: uiLocale
    });

    if (!result.ok) {
      setEmailPending(false);
      setEmailError(result.error);
      setEmailMessage("");
      return;
    }

    setEmailMessage("");
    await onEmailSuccess();
    setEmailPending(false);
    setEmailCode("");
  }

  function handleEmailSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void (emailOtpSent ? verifyEmailCode() : sendEmailCode());
  }

  return localizeUiTree((
    <>
    <div className={styles.overlay} role="presentation" onClick={closeAuthModal}>
      <div className={`${styles.shell} ${!hasPreview ? styles.shellNoPreview : ""}`} role="dialog" aria-modal="true" aria-labelledby="signup-gate-title" onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          className={styles.close}
          onClick={closeAuthModal}
          aria-label="Close sign-up dialog"
        >
          <X size={18} aria-hidden="true" />
        </button>

        {hasPreview && image ? (
          <div className={styles.preview}>
            {previewBadge ? <span className={styles.previewBadge}>{previewBadge}</span> : null}
            {!preview.loaded && !preview.failed ? (
              <div className={styles.previewStatus} role="status" aria-busy="true">
                <span className={styles.previewLoadingRow}>
                  <AppLoadingSpinner variant="ring" size={16} className={styles.previewSpinner} />
                  <span className={styles.previewLoading}>
                    {preview.retrying ? "Retrying preview..." : "Loading preview..."}
                  </span>
                </span>
              </div>
            ) : null}
            {preview.failed ? (
              <div className={styles.previewStatus} role="alert">
                <span className={styles.previewLoading}>Image preview unavailable</span>
                <button type="button" className={styles.previewRetry} onClick={preview.retry}>
                  Retry preview
                </button>
              </div>
            ) : null}
            <button
              type="button"
              className={styles.previewImageButton}
              onClick={() => setExpandedPreviewOpen(true)}
              disabled={!preview.loaded}
              aria-label="Open enlarged image preview"
              title={preview.loaded ? "Open preview" : undefined}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={preview.requestKey}
                className={preview.loaded ? styles.imageLoaded : styles.imageHidden}
                src={preview.src}
                data-i18n-preserve="alt"
                alt={image.promptSummary || `Generated image ${image.imageIndex + 1}`}
                width={image.width}
                height={image.height}
                draggable={false}
                onLoad={() => {
                  preview.handleLoad();
                  captureAnalyticsEvent("generation_preview_loaded", {
                    action: "load_preview",
                    stage: "preview",
                    status: "success",
                    duration_ms: Math.max(0, Date.now() - previewLoadStartedAtRef.current),
                    modal_variant: image.previewVariant === "masked_blur"
                      ? "guest_signup_unlock"
                      : "watermarked_signup_modal",
                    asset_id: image.assetId,
                    image_index: image.imageIndex,
                    preview_variant: image.previewVariant,
                    access_variant: image.accessVariant
                  });
                }}
                onError={() => {
                  if (preview.handleError() === "failed") {
                    trackClientEvent("socialmedia.image_preview.failed", {
                      action: "load_preview",
                      stage: "preview",
                      status: "failed",
                      reason: buildImagePreviewFailureReason(image.assetId)
                    });
                  }
                }}
              />
            </button>
            {showPreviewChoices ? (
              <div className={styles.previewStrip} aria-label="Choose image to preview">
                {previewChoices.map((item, index) => {
                  const selected = item.assetId
                    ? item.assetId === image.assetId
                    : item.url === image.url;
                  return (
                    <button
                      type="button"
                      key={item.assetId || `${item.imageIndex}-${index}`}
                      className={selected ? `${styles.previewThumb} ${styles.previewThumbSelected}` : styles.previewThumb}
                      onClick={() => onImageSelect?.(item)}
                      aria-label={`Preview image ${index + 1} of ${previewChoices.length}`}
                      aria-pressed={selected}
                    >
                      <RetryingPreviewImage
                        sourceUrl={item.url}
                        alt=""
                        width={item.width}
                        height={item.height}
                      />
                      <span>{index + 1}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className={styles.content}>
          <div className={styles.brand}>
            <Image src="/brand/icon-192.png" alt="" width={32} height={32} />
            <span>Hotel Lobby AI</span>
          </div>
          <div className={styles.copy}>
            <h2 id="signup-gate-title">{title}</h2>
            <p>{copy}</p>
          </div>

          {emailError || emailMessage ? (
            <p className={emailError ? styles.authError : styles.authNotice}>
              {emailError || emailMessage}
            </p>
          ) : null}

          {canShowAuthOptions ? (
            <div className={styles.authActions}>
              {supportsGoogleAuth ? (
                <button
                  type="button"
                  className={styles.authOauthButton}
                  onClick={() => onProviderSelect("google")}
                  disabled={emailPending}
                >
                  <span className={styles.authOauthIconSlot} aria-hidden="true">
                    <Image src="/assets/logos/google.png" alt="" width={18} height={18} className={styles.authOauthIcon} />
                  </span>
                  <span>Continue with Google</span>
                </button>
              ) : null}
              {supportsAppleAuth ? (
                <button
                  type="button"
                  className={styles.authOauthButton}
                  onClick={() => onProviderSelect("apple")}
                  disabled={emailPending}
                >
                  <span className={styles.authOauthIconSlot} aria-hidden="true">
                    <Image src="/assets/logos/apple.png" alt="" width={18} height={18} className={styles.authOauthIconApple} />
                  </span>
                  <span>Continue with Apple</span>
                </button>
              ) : null}
              {supportsEmailAuth ? (
                <>
                  <div className={styles.authDivider} aria-hidden="true">
                    <span>or</span>
                  </div>
                  <form className={styles.authEmailForm} onSubmit={handleEmailSubmit}>
                    <input
                      className={styles.authInput}
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      placeholder="Enter your email"
                      value={emailAddress}
                      onChange={(event) => {
                        setEmailAddress(event.target.value);
                        if (emailOtpSent) {
                          setEmailOtpSent(false);
                          setEmailCode("");
                          setEmailMessage("");
                        }
                      }}
                      disabled={emailPending}
                    />
                    {emailOtpSent ? (
                      <input
                        className={styles.authInput}
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        placeholder="6-digit code"
                        value={emailCode}
                        onChange={(event) => setEmailCode(event.target.value)}
                        disabled={emailPending}
                      />
                    ) : null}
                    <button type="submit" className={styles.authEmailSubmit} disabled={emailPending || !emailAddress.trim()}>
                      {emailPending
                        ? emailOtpSent ? "Verifying code..." : "Sending code..."
                        : emailOtpSent ? "Verify code" : "Continue with email"}
                    </button>
                  </form>
                </>
              ) : null}
            </div>
          ) : onFallbackSignup ? (
            <button
              type="button"
              className={styles.authEmailSubmit}
              onClick={onFallbackSignup}
              disabled={emailPending}
            >
              Sign up free
            </button>
          ) : null}

          <div className={styles.footer}>
            <span>Free account · No credit card required · 10-second sign-up</span>
            {onContinueWithWatermark ? (
              <button type="button" onClick={() => void continueWithWatermark()} disabled={downloadingWatermarked}>
                {!downloadingWatermarked ? <Download size={13} aria-hidden="true" /> : null}
                <span>{downloadingWatermarked ? "Downloading..." : "Download with watermark"}</span>
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
    {expandedPreviewOpen && image ? (
      <GateImagePreviewOverlay image={{ ...image, url: preview.src }} onClose={() => setExpandedPreviewOpen(false)} />
    ) : null}
    </>
  ), uiLocale);
}
