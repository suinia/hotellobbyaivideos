import {
  DEFAULT_GUEST_SUBSCRIPTION_POPUP_EXPERIMENT_VARIANT,
  GUEST_SUBSCRIPTION_POPUP_EXPERIMENT_COOKIE,
  GUEST_SUBSCRIPTION_POPUP_EXPERIMENT_KEY,
  normalizeGuestSubscriptionPopupExperimentVariant,
  type GuestSubscriptionPopupExperimentVariant
} from "@/lib/socialmedia/guest-subscription-popup-experiment";
import { getClientFlags } from "@/lib/flags/client";

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365 * 2;

export type ClientGuestSubscriptionPopupExperimentAssignment = {
  key: string;
  variant: GuestSubscriptionPopupExperimentVariant;
  source: string;
};

const guestSubscriptionPopupExperimentRequests = new Map<string, Promise<ClientGuestSubscriptionPopupExperimentAssignment>>();

function readCookie(name: string): string {
  if (typeof document === "undefined") return "";
  const prefix = `${name}=`;
  return document.cookie
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(prefix))
    ?.slice(prefix.length) ?? "";
}

function writeCookie(name: string, value: string): void {
  if (typeof document === "undefined") return;
  document.cookie = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    `Max-Age=${COOKIE_MAX_AGE_SECONDS}`,
    "SameSite=Lax",
    "Secure"
  ].join("; ");
}

export function resolveClientGuestSubscriptionPopupExperimentInitial(params: {
  requestedVariant?: string | null;
} = {}): ClientGuestSubscriptionPopupExperimentAssignment {
  const requestedVariant = params.requestedVariant?.trim();
  if (requestedVariant) {
    const variant = normalizeGuestSubscriptionPopupExperimentVariant(requestedVariant);
    writeCookie(GUEST_SUBSCRIPTION_POPUP_EXPERIMENT_COOKIE, variant);
    return { key: GUEST_SUBSCRIPTION_POPUP_EXPERIMENT_KEY, variant, source: "request" };
  }

  const existing = readCookie(GUEST_SUBSCRIPTION_POPUP_EXPERIMENT_COOKIE);
  if (existing) {
    const decoded = decodeURIComponent(existing);
    const variant = normalizeGuestSubscriptionPopupExperimentVariant(decoded);
    if (variant !== decoded.trim().toLowerCase()) {
      writeCookie(GUEST_SUBSCRIPTION_POPUP_EXPERIMENT_COOKIE, variant);
    }
    return { key: GUEST_SUBSCRIPTION_POPUP_EXPERIMENT_KEY, variant, source: "cookie" };
  }

  return {
    key: GUEST_SUBSCRIPTION_POPUP_EXPERIMENT_KEY,
    variant: DEFAULT_GUEST_SUBSCRIPTION_POPUP_EXPERIMENT_VARIANT,
    source: "default"
  };
}

export function resolveClientGuestSubscriptionPopupExperimentFallback(params: {
  requestedVariant?: string | null;
} = {}): ClientGuestSubscriptionPopupExperimentAssignment {
  const initial = resolveClientGuestSubscriptionPopupExperimentInitial(params);
  if (initial.source !== "default") return initial;

  writeCookie(GUEST_SUBSCRIPTION_POPUP_EXPERIMENT_COOKIE, DEFAULT_GUEST_SUBSCRIPTION_POPUP_EXPERIMENT_VARIANT);
  return {
    key: GUEST_SUBSCRIPTION_POPUP_EXPERIMENT_KEY,
    variant: DEFAULT_GUEST_SUBSCRIPTION_POPUP_EXPERIMENT_VARIANT,
    source: "default"
  };
}

export async function resolveClientGuestSubscriptionPopupExperimentFromServer(params: {
  requestedVariant?: string | null;
} = {}): Promise<ClientGuestSubscriptionPopupExperimentAssignment> {
  const searchParams = new URLSearchParams();
  const requestedVariant = params.requestedVariant?.trim();
  if (!requestedVariant) {
    const data = await getClientFlags();
    const flag = data.flags.find((item) => item.key === GUEST_SUBSCRIPTION_POPUP_EXPERIMENT_KEY);
    if (!flag?.variant) {
      throw new Error("Failed to resolve guest subscription popup experiment from client flags.");
    }
    return {
      key: flag.key,
      variant: normalizeGuestSubscriptionPopupExperimentVariant(flag.variant),
      source: typeof flag.source === "string" && flag.source.trim() ? flag.source : "server"
    };
  }

  if (requestedVariant) searchParams.set("guest_subscription_popup_variant", requestedVariant);

  const suffix = searchParams.size ? `?${searchParams.toString()}` : "";
  const requestKey = suffix;
  const existingRequest = guestSubscriptionPopupExperimentRequests.get(requestKey);
  if (existingRequest) return existingRequest;

  const request = (async () => {
    const response = await fetch(`/api/v1/flags/${GUEST_SUBSCRIPTION_POPUP_EXPERIMENT_KEY}${suffix}`, {
      cache: "no-store",
      credentials: "same-origin",
      headers: { accept: "application/json" }
    });
    const data = await response.json().catch(() => ({})) as {
      key?: unknown;
      variant?: unknown;
      source?: unknown;
    };
    if (!response.ok) {
      throw new Error("Failed to resolve guest subscription popup experiment from server.");
    }

    return {
      key: typeof data.key === "string" && data.key.trim() ? data.key : GUEST_SUBSCRIPTION_POPUP_EXPERIMENT_KEY,
      variant: normalizeGuestSubscriptionPopupExperimentVariant(typeof data.variant === "string" ? data.variant : null),
      source: typeof data.source === "string" && data.source.trim() ? data.source : "server"
    };
  })();

  guestSubscriptionPopupExperimentRequests.set(requestKey, request);
  request.then(
    () => {
      if (guestSubscriptionPopupExperimentRequests.get(requestKey) === request) {
        guestSubscriptionPopupExperimentRequests.delete(requestKey);
      }
    },
    () => {
      if (guestSubscriptionPopupExperimentRequests.get(requestKey) === request) {
        guestSubscriptionPopupExperimentRequests.delete(requestKey);
      }
    }
  );
  return request;
}
