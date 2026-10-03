"use client";

/**
 * Meta Pixel (Facebook Pixel) integration.
 *
 * Tracks events: PageView, Lead, CompleteRegistration.
 * Requires NEXT_PUBLIC_META_PIXEL_ID to be set.
 * Automatically disabled on localhost.
 */

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() || "";

function isLocalhost(): boolean {
  if (typeof window === "undefined") return false;
  const hostname = window.location.hostname.trim().toLowerCase();
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function getPixel(): typeof window.fbq | null {
  if (!META_PIXEL_ID || isLocalhost()) return null;
  return typeof window.fbq === "function" ? window.fbq : null;
}

/**
 * Fire a Meta Pixel event.
 * Safe to call even when the pixel is not loaded.
 */
export function trackMetaEvent(
  eventName: string,
  params?: Record<string, unknown>
): void {
  try {
    const fbq = getPixel();
    if (!fbq) return;
    fbq("track", eventName, params);
  } catch {
    // Ignore all pixel errors — never break the user flow.
  }
}

/**
 * Fire a Meta Pixel Custom Event (for advanced matching).
 */
export function trackMetaCustomEvent(
  eventName: string,
  params?: Record<string, unknown>
): void {
  try {
    const fbq = getPixel();
    if (!fbq) return;
    fbq("trackCustom", eventName, params);
  } catch {
    // Ignore all pixel errors — never break the user flow.
  }
}

/**
 * Inject the Meta Pixel base script into the document head.
 * Call this once, e.g. from a Next.js Script component with afterInteractive.
 */
export const META_PIXEL_SCRIPT = `
  !function(f,b,e,v,n,t,s)
  {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};
  if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
  n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];
  s.parentNode.insertBefore(t,s)}(window, document,'script','https://connect.facebook.net/en_US/fbevents.js');
  fbq('init', '${META_PIXEL_ID}');
  fbq('track', 'PageView');
`;
